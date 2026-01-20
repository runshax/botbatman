const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { encryptPassword } = require('./services/passwordEncryption');
const { parseFormula, addCustomFunction } = require('./services/formulaParser');
const { getTodayHoliday, getTomorrowHoliday, getUpcomingHolidays, formatDateIndonesian } = require('./services/indonesianHolidays');
const { initDatabase, addCredential, getCredential, getCredentialBySfgo, getAllCredentials, deleteCredential } = require('./services/database');
require('dotenv').config();

// Initialize database on startup
initDatabase();

// Store message IDs for deletion
const botMessages = new Map(); // chatId -> array of messageIds

// Store pending formulas waiting for variable values
const pendingFormulas = new Map(); // chatId -> {formula, variables}

// Helper function to format complex formulas for readability
const formatFormula = (formula) => {
  let formatted = formula;
  let indentLevel = 0;
  let result = '';
  let i = 0;

  while (i < formatted.length) {
    const char = formatted[i];

    if (char === '(') {
      result += char + '\n';
      indentLevel++;
      result += '  '.repeat(indentLevel);
    } else if (char === ')') {
      indentLevel--;
      result += '\n' + '  '.repeat(indentLevel) + char;
    } else if (char === ',') {
      result += char + '\n' + '  '.repeat(indentLevel);
    } else {
      result += char;
    }

    i++;
  }

  return result.trim();
};

// Helper function to detect unknown variables in formula
const detectVariables = (formula) => {
  // Known functions to exclude
  const knownFunctions = ['IF', 'SUM', 'MAX', 'MIN', 'AVERAGE', 'ROUND', 'ABS', 'CEILING', 'FLOOR',
    'DOUBLE', 'TRIPLE', 'OR', 'AND', 'NOT', 'CONCATENATE', 'LEN', 'UPPER', 'LOWER', 'TRIM'];

  // Remove strings in quotes first
  const formulaWithoutStrings = formula.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');

  // Find all word-like tokens that are not numbers or strings
  const tokens = formulaWithoutStrings.match(/[A-Z_][A-Z0-9_]*/gi) || [];

  // Filter out known functions
  const variables = [...new Set(tokens.filter(token =>
    !knownFunctions.includes(token.toUpperCase())
  ))];

  return variables;
};

// Helper function to substitute variables in formula
const substituteVariables = (formula, variableValues) => {
  let result = formula;

  for (const [varName, value] of Object.entries(variableValues)) {
    // Always treat as string and add quotes
    // User can provide numbers without quotes if they want numeric comparison
    const replacement = `"${value}"`;

    // Replace all occurrences of the variable
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    result = result.replace(regex, replacement);
  }

  return result;
};

// Helper function to parse keywords from markdown
const fs = require('fs');
const path = require('path');

const parseKeywordsFromMarkdown = () => {
  try {
    const keywordsPath = path.join(__dirname, 'docs', 'formula', 'keywords.md');
    const content = fs.readFileSync(keywordsPath, 'utf8');

    const keywords = [];
    const blocks = content.split(/\n---\nkeyword:/);

    for (let i = 1; i < blocks.length; i++) {
      const block = 'keyword:' + blocks[i];
      const lines = block.split('\n');

      const keyword = {};
      let inYaml = true;
      let description = '';
      let examples = [];
      let captureExamples = false;
      let currentSection = '';

      for (const line of lines) {
        if (line === '---') {
          inYaml = false;
          continue;
        }

        if (inYaml) {
          if (line.startsWith('keyword:')) {
            keyword.name = line.replace('keyword:', '').trim().replace(/['"]/g, '');
            currentSection = 'keyword';
          } else if (line.startsWith('aliases:')) {
            keyword.aliases = [];
            currentSection = 'aliases';
          } else if (line.startsWith('examples:')) {
            currentSection = 'yaml_examples';
          } else if (line.startsWith('related_keywords:')) {
            currentSection = 'related';
          } else if (line.startsWith('  - ') && currentSection === 'aliases') {
            keyword.aliases.push(line.replace('  - ', '').trim().replace(/['"]/g, ''));
          } else if (line.startsWith('category:')) {
            keyword.category = line.replace('category:', '').trim();
            currentSection = 'category';
          } else if (line.startsWith('syntax:')) {
            keyword.syntax = line.replace('syntax:', '').trim().replace(/['"]/g, '');
            currentSection = 'syntax';
          } else if (line.startsWith('description:')) {
            keyword.description = line.replace('description:', '').trim();
            currentSection = 'description';
          }
        } else {
          // Parse description section
          if (line.startsWith('### Description')) {
            captureExamples = false;
            continue;
          }
          if (line.startsWith('### Examples')) {
            captureExamples = true;
            continue;
          }
          if (line.startsWith('**Example') && captureExamples) {
            const exampleMatch = line.match(/\*\*Example \d+: (.+)\*\*/);
            if (exampleMatch) {
              examples.push({ title: exampleMatch[1], lines: [] });
            }
          }
          if (line.startsWith('Formula:') && captureExamples && examples.length > 0) {
            examples[examples.length - 1].formula = line.replace('Formula:', '').trim();
          }
          if (line.startsWith('Description:') && captureExamples && examples.length > 0) {
            examples[examples.length - 1].description = line.replace('Description:', '').trim();
          }

          if (!captureExamples && line.trim() && !line.startsWith('#') && !line.startsWith('```') && description.length < 500) {
            description += line.trim() + ' ';
          }
        }
      }

      if (description.trim()) {
        keyword.fullDescription = description.trim();
      }

      if (examples.length > 0) {
        keyword.examples = examples;
      }

      if (keyword.name) {
        keywords.push(keyword);
      }
    }

    return keywords;
  } catch (error) {
    console.error('Error parsing keywords:', error);
    return [];
  }
};

// Search for a keyword
const searchKeyword = (query) => {
  const keywords = parseKeywordsFromMarkdown();
  const searchTerm = query.toUpperCase().trim();

  // Exact match
  let match = keywords.find(k => k.name.toUpperCase() === searchTerm);

  // Check aliases
  if (!match) {
    match = keywords.find(k =>
      k.aliases && k.aliases.some(a => a.toUpperCase() === searchTerm)
    );
  }

  // Partial match
  if (!match) {
    match = keywords.find(k => k.name.toUpperCase().includes(searchTerm));
  }

  return match;
};

// 1. HEALTH CHECK SERVER (Required for Koyeb)
// Koyeb needs to see a "website" running on port 8080 or it will restart the bot.
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Bot is online and healthy! 🚀');
});

app.listen(PORT, () => {
  console.log(`Health check server is listening on port ${PORT}`);
});

// 2. BOT SETUP
const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

console.log("Telegram bot is starting...");

// 3. SCHEDULED REMINDERS (Mon-Fri)
const timezone = "Asia/Jakarta";

// Helper function to track bot messages
const trackMessage = (chatId, messageId) => {
  if (!botMessages.has(chatId)) {
    botMessages.set(chatId, []);
  }
  botMessages.get(chatId).push(messageId);

  // Keep only last 100 messages per chat to avoid memory issues
  const messages = botMessages.get(chatId);
  if (messages.length > 100) {
    messages.shift();
  }
};

// Helper function to track user command messages (for deletion by /clear)
const trackCommand = (chatId, messageId) => {
  trackMessage(chatId, messageId);
};

// Morning Reminder: 8:05 AM (Mon-Fri)
cron.schedule('5 8 * * 1-5', () => {
  const today = new Date();
  const isMonday = today.getDay() === 1;
  const holiday = getTodayHoliday();

  // Skip reminder if today is a public holiday
  if (holiday) {
    console.log(`Skipping morning reminder - Today is ${holiday.name}`);
    return;
  }

  let message = "😄 Pagi tim Payroll! Hari baru, angka baru, semoga tanpa revisi.";

  if (isMonday) {
    message += "\n\nJangan lupa cek dan perbaiki tiket minggu lalu ya!";
  }

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending morning reminder:", err));
  console.log(`Morning reminder sent at 8:05 AM${isMonday ? ' (with ticket reminder)' : ''}`);
}, {
  scheduled: true,
  timezone: timezone
});

// Afternoon Reminder: 4:45 PM (Mon-Fri)
cron.schedule('45 16 * * 1-5', () => {
  const holiday = getTodayHoliday();

  // Skip reminder if today is a public holiday
  if (holiday) {
    console.log(`Skipping afternoon reminder - Today is ${holiday.name}`);
    return;
  }

  // Check if tomorrow is a public holiday
  const tomorrowHoliday = getTomorrowHoliday();

  let message = "😂 Siap-siap pulang! Inget isi timesheet sebelum lupa diri sendiri.";

  // Add warning if tomorrow is a holiday
  if (tomorrowHoliday) {
    message += `\n\n⚠️ *Besok libur: ${tomorrowHoliday.name}*\nBiarkan repo damai.`;
  }

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending afternoon reminder:", err));
  console.log("Afternoon reminder sent at 4:45 PM");
}, {
  scheduled: true,
  timezone: timezone
});

// Error handling for polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

// ==================== HELP COMMAND ====================
bot.onText(/^\/help$/, (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  const helpMessage = `🤖 *Bot Command List*\n\n` +
    `*Available Commands:*\n\n` +

    `1️⃣ */help*\n` +
    `   Show this help message\n` +
    `   _Example:_ \`/help\`\n\n` +

    `2️⃣ */dev*\n` +
    `   Show all credentials (country list with SFGO)\n` +
    `   _Example:_ \`/dev\`\n\n` +

    `3️⃣ */dev sfgoXXXX* or */dev XXXX*\n` +
    `   Show credential details by SFGO (with or without "sfgo" prefix)\n` +
    `   _Examples:_ \`/dev sfgo8879\` or \`/dev 8879\`\n\n` +

    `4️⃣ */dev add*\n` +
    `   Add or update credential (URL auto-generated)\n` +
    `   _Format:_ \`/dev add country / username / password / sfgo\`\n` +
    `   _Example:_ \`/dev add MY / champion / pass1234 / sfgo8879\`\n` +
    `   _Also works:_ \`/dev add MY/champion/pass1234/sfgo8879\`\n` +
    `   _Note: If SFGO exists, it will be updated_\n\n` +

    `5️⃣ */dev delete*\n` +
    `   Delete credential by SFGO\n` +
    `   _Example:_ \`/dev delete sfgo8879\`\n\n` +

    `6️⃣ */reset username password*\n` +
    `   Generate encrypted password hash for database\n` +
    `   _Example:_ \`/reset email@gmail.com pass1234\`\n\n` +

    `7️⃣ */parse formula*\n` +
    `   Calculate mathematical formulas and functions\n` +
    `   _Examples:_\n` +
    `   \`/parse 1+1\`\n` +
    `   \`/parse SUM(10,20,30)\`\n` +
    `   \`/parse ROUND(3.14159, 2)\`\n` +
    `   \`/parse MAX(100,50,75)\`\n\n` +
    `   *With Variables:*\n` +
    `   \`/parse IF(GRADE="01",7500000,0) | GRADE='01'\`\n` +
    `   \`/parse SALARY*0.7 | SALARY=10000000\`\n\n` +

    `8️⃣ */keywords*\n` +
    `   List all available formula keywords by category\n` +
    `   _Examples:_\n` +
    `   \`/keywords\` - Show all categories\n` +
    `   \`/keywords PAYFORM\` - Show payroll keywords\n` +
    `   \`/keywords EMPFORM\` - Show employee keywords\n\n` +

    `9️⃣ */ask keyword*\n` +
    `   Search payroll formula documentation\n` +
    `   _Examples:_\n` +
    `   \`/ask BASE\` - Get info about BASE keyword\n` +
    `   \`/ask JOINDATE\` - Employee join date\n` +
    `   \`/ask OTRD_FULL\` - Overtime calculations\n\n` +

    `🔟 */clear*\n` +
    `   Delete all bot messages in this chat\n` +
    `   _Example:_ \`/clear\`\n\n` +

    `1️⃣1️⃣ */holiday*\n` +
    `   Check Indonesian public holidays\n` +
    `   _Example:_ \`/holiday\`\n\n` +

    `1️⃣2️⃣ */sfgo[number]*\n` +
    `   Auto-format SFGO numbers\n` +
    `   _Example:_ \`/sfgo11199\`\n` +
    `   _Result:_ \`sfgo11199-dev-gd|http://localhost:3001\`\n\n` +

    `💡 _Tip: Type any command without parameters to see usage examples!_`;

  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending help message:", err));
});

bot.onText(/^\/dev(?:\s+(.+))?$/, async (msg, match) => {
  // Only track if it's not a forwarded message with URL (containing ://)
  if (!msg.text.includes('://')) {
    trackCommand(msg.chat.id, msg.message_id);
  }
  const userId = msg.from.id.toString();

  const input = match[1] ? match[1].trim() : null;

  // Parse command: /dev add country / username / password / sfgo
  if (input && input.startsWith('add ')) {
    const credInput = input.substring(4).trim(); // Remove "add "

    // Split by "/" with optional spaces around it
    const parts = credInput.split(/\s*\/\s*/);

    if (parts.length !== 4) {
      return bot.sendMessage(msg.chat.id,
        `❌ *Format salah!*\n\n*Usage:*\n\`/dev add country / username / password / sfgo\`\n\n*Example:*\n\`/dev add MY / champion / pass1234 / sfgo8879\`\n\n*Or without spaces:*\n\`/dev add MY/champion/pass1234/sfgo8879\`\n\n_Found ${parts.length} parts, need 4_`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    const country = parts[0].trim();
    const username = parts[1].trim();
    const password = parts[2].trim();
    const sfgo = parts[3].trim();

    // Check if SFGO already exists
    const existingCred = await getCredentialBySfgo(sfgo);
    const isUpdate = existingCred !== null;

    // Auto-generate URL: sfgoXXXX-dev-gd|http://localhost:3001
    const url = `${sfgo}-dev-gd|http://localhost:3001`;

    const result = await addCredential(sfgo, country, username, password, url);

    if (result.success) {
      const action = isUpdate ? 'updated' : 'saved';
      const emoji = isUpdate ? '🔄' : '✅';
      return bot.sendMessage(msg.chat.id,
        `${emoji} *Credential ${action}!*\n\nCountry: ${country}\nSFGO: ${sfgo}\nUsername: ${username}\nURL: ${url}\n\nUse \`/dev ${sfgo}\` to view`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    } else {
      return bot.sendMessage(msg.chat.id,
        `❌ *Error saving credential:* ${result.error}`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }
  }

  // Parse command: /dev delete sfgoXXXX
  if (input && input.startsWith('delete ')) {
    const sfgo = input.substring(7).trim();

    const result = await deleteCredential(sfgo);

    if (result.success && result.deleted) {
      return bot.sendMessage(msg.chat.id,
        `✅ *Credential deleted!*\n\nSFGO: ${sfgo}`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    } else if (result.success && !result.deleted) {
      return bot.sendMessage(msg.chat.id,
        `❌ *Credential not found!*\n\nSFGO: ${sfgo}`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    } else {
      return bot.sendMessage(msg.chat.id,
        `❌ *Error deleting credential:* ${result.error}`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }
  }

  const subCommand = input ? input.toLowerCase().trim() : null;

  let response = "";
  let useMarkdown = true;

  if (subCommand) {
    // Check if it's an SFGO lookup (starts with "sfgo" or is just numbers)
    let sfgoToSearch = subCommand;

    // If it's just numbers, prepend "sfgo"
    if (/^\d+$/.test(subCommand)) {
      sfgoToSearch = 'sfgo' + subCommand;
    }

    if (subCommand.startsWith('sfgo') || /^\d+$/.test(subCommand)) {
      const dbCred = await getCredentialBySfgo(sfgoToSearch);

      if (dbCred) {
        // Found in database
        response = `🔐 Dev Credential (${dbCred.country.toUpperCase()})\n\n🌐 ${dbCred.country.toUpperCase()}\nUsername: ${dbCred.username}\nPassword: ${dbCred.password}\nSFGO: ${dbCred.sfgo}\nURL: ${dbCred.url || 'N/A'}`;
        useMarkdown = false;
      } else {
        response = `❌ *SFGO not found!*\n\nUse \`/dev add COUNTRY / username / password / ${sfgoToSearch}\` to add`;
      }
    } else {
      // Specific country requested - check database only
      const dbCred = await getCredential(subCommand);

      if (dbCred) {
        // Found in database
        response = `🔐 Dev Credential (${subCommand.toUpperCase()})\n\n🌐 ${subCommand.toUpperCase()}\nUsername: ${dbCred.username}\nPassword: ${dbCred.password}\nSFGO: ${dbCred.sfgo}\nURL: ${dbCred.url || 'N/A'}`;
        useMarkdown = false;
      } else {
        response = `❌ *Country not found!*\n\nUse \`/dev add ${subCommand.toUpperCase()} / username / password / sfgoXXXX\` to add`;
      }
    }
  } else {
    // No country specified - show all from database only
    const dbCreds = await getAllCredentials();
    const allCreds = [];

    // Add database credentials
    for (const cred of dbCreds) {
      const sfgoOnly = cred.sfgo.split('|')[0].replace('-dev-gd', '');
      allCreds.push(`🌐 ${cred.country.toUpperCase()}\n${sfgoOnly}`);
    }

    if (allCreds.length > 0) {
      response = `🔐 *All Regional Credentials*\n---------------------------\n` +
        allCreds.join('\n---------------------------\n') +
        `\n\n_Type "/dev XXXX" or "/dev sfgoXXXX" for full credentials._\n_Type "/dev add country / username / password / sfgo" to add._`;
    } else {
      response = `❌ *No credentials found!*\n\nUse \`/dev add COUNTRY / username / password / sfgoXXXX\` to add`;
    }
  }

  const options = useMarkdown ? { parse_mode: 'Markdown' } : {};
  bot.sendMessage(msg.chat.id, response, options)
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending dev credentials:", err));
});

// ==================== NEW ENHANCEMENT: PASSWORD RESET ====================
bot.onText(/^\/reset(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    const input = match[1];

    if (!input) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\n*Usage:*\n`/reset username password`\n\n*Example:*\n`/reset email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending reset help:", err));
    }

    const parts = input.trim().split(/\s+/);

    if (parts.length !== 2) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\nHarus ada 2 parameter: username dan password\n\n*Example:*\n`/reset email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending reset error:", err));
    }

    const [username, password] = parts;
    const uuid = process.env.DEFAULT_UUID || 'reset';

    bot.sendMessage(msg.chat.id, "⏳ *Processing...*\nGenerating encrypted password hash...", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending processing message:", err));

    const result = await encryptPassword(username, password, uuid);

    bot.sendMessage(msg.chat.id, `\`\`\`\n${result.message}\n\`\`\``, { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending reset result:", err));

  } catch (err) {
    console.error("Error in /reset command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while processing your request.", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});

// ==================== ASK COMMAND: DOCUMENTATION SEARCH ====================
bot.onText(/^\/ask(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);

  const query = match[1];

  if (!query) {
    return bot.sendMessage(msg.chat.id,
      "❓ *Ask about formula keywords*\n\n" +
      "*Usage:*\n`/ask KEYWORD`\n\n" +
      "*Examples:*\n" +
      "`/ask BASE`\n" +
      "`/ask JOINDATE`\n" +
      "`/ask OTRD_FULL`\n" +
      "`/ask @COMPONENT_CODE`",
      { parse_mode: 'Markdown' }
    );
  }

  const keyword = searchKeyword(query);

  if (!keyword) {
    return bot.sendMessage(msg.chat.id,
      `❌ Keyword "${query}" not found.\n\n` +
      "Try:\n" +
      "• Check spelling\n" +
      "• Use uppercase (e.g., BASE, JOINDATE)\n" +
      "• Try `/ask` without parameters to see usage",
      { parse_mode: 'Markdown' }
    );
  }

  // Build response
  let response = `📘 *${keyword.name}*\n\n`;

  // Add category
  if (keyword.category) {
    response += `*Category:* ${keyword.category}\n`;
  }

  // Add syntax
  if (keyword.syntax) {
    response += `*Syntax:* \`${keyword.syntax}\`\n\n`;
  }

  // Add description
  if (keyword.description) {
    response += `*Description:*\n${keyword.description}\n\n`;
  } else if (keyword.fullDescription) {
    const desc = keyword.fullDescription.substring(0, 300);
    response += `*Description:*\n${desc}${keyword.fullDescription.length > 300 ? '...' : ''}\n\n`;
  }

  // Add examples (limit to 2)
  if (keyword.examples && keyword.examples.length > 0) {
    response += `*Example Usage:*\n`;
    const examplesLimit = Math.min(2, keyword.examples.length);
    for (let i = 0; i < examplesLimit; i++) {
      const ex = keyword.examples[i];
      response += `\n${i + 1}. *${ex.title}*\n`;
      if (ex.formula) {
        response += `   Formula: \`${ex.formula}\`\n`;
      }
      if (ex.description) {
        response += `   ${ex.description}\n`;
      }
    }
  }

  // Add aliases
  if (keyword.aliases && keyword.aliases.length > 0) {
    response += `\n*Aliases:* ${keyword.aliases.join(', ')}`;
  }

  bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' })
    .catch(err => {
      console.error("Error sending keyword info:", err);
      bot.sendMessage(msg.chat.id, "Error displaying keyword information.");
    });
});

// ==================== KEYWORDS LIST COMMAND ====================
bot.onText(/^\/keywords(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);

  const category = match[1] ? match[1].toUpperCase().trim() : null;

  const keywords = parseKeywordsFromMarkdown();

  if (keywords.length === 0) {
    return bot.sendMessage(msg.chat.id, "❌ No keywords found in documentation.");
  }

  // Group keywords by category
  const categorized = {};
  keywords.forEach(kw => {
    const cat = kw.category || 'UNCATEGORIZED';
    if (!categorized[cat]) {
      categorized[cat] = [];
    }
    categorized[cat].push(kw.name);
  });

  // If specific category requested
  if (category) {
    const matchedCategory = Object.keys(categorized).find(cat =>
      cat.toUpperCase() === category || cat.toUpperCase().includes(category)
    );

    if (!matchedCategory) {
      return bot.sendMessage(msg.chat.id,
        `❌ Category "${category}" not found.\n\n` +
        `*Available categories:*\n${Object.keys(categorized).sort().join('\n')}\n\n` +
        `Use \`/keywords CATEGORY\` to see keywords in that category.`,
        { parse_mode: 'Markdown' }
      );
    }

    const kwList = categorized[matchedCategory].sort();
    let response = `📚 *${matchedCategory}* (${kwList.length} keywords)\n\n`;

    // Split into chunks if too many
    const chunkSize = 30;
    for (let i = 0; i < kwList.length; i += chunkSize) {
      const chunk = kwList.slice(i, i + chunkSize);
      response += chunk.map(kw => `• \`${kw}\``).join('\n') + '\n';

      if (i + chunkSize < kwList.length) {
        response += `\n_...continued in next message_\n`;
        bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
        response = `📚 *${matchedCategory}* (continued)\n\n`;
      }
    }

    response += `\n💡 _Use_ \`/ask KEYWORD\` _to learn more_`;
    return bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
  }

  // Show all categories with counts
  let response = `📚 *Formula Keywords by Category*\n\n`;
  response += `Total: ${keywords.length} keywords\n\n`;

  const sortedCategories = Object.keys(categorized).sort();
  for (const cat of sortedCategories) {
    response += `*${cat}* (${categorized[cat].length})\n`;
  }

  response += `\n*Usage:*\n`;
  response += `• \`/keywords\` - Show all categories\n`;
  response += `• \`/keywords CATEGORY\` - List keywords in category\n`;
  response += `• \`/ask KEYWORD\` - Get keyword details\n\n`;
  response += `*Examples:*\n`;
  response += `\`/keywords PAYFORM\`\n`;
  response += `\`/keywords EMPFORM\`\n`;
  response += `\`/keywords ATTINTF\``;

  bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' })
    .catch(err => console.error("Error sending keywords list:", err));
});

// ==================== NEW ENHANCEMENT: FORMULA CALCULATOR ====================
bot.onText(/^\/parse(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    const formula = match[1];

    // Check if formula is provided
    if (!formula) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\n*Usage:*\n`/parse FORMULA`\n\n*Examples:*\n" +
        "`/parse 1+1`\n" +
        "`/parse SUM(10,20,30)`\n" +
        "`/parse ROUND(3.14159, 2)`\n" +
        "`/parse MAX(100,50,75,200)`\n" +
        "`/parse (5+10)*2`\n\n" +
        "*Custom Functions:*\n" +
        "`/parse DOUBLE(21)` - multiply by 2\n" +
        "`/parse TRIPLE(10)` - multiply by 3",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending parse help:", err));
    }

    // Check if formula contains variables (format: /parse formula | VAR1=value | VAR2=value)
    let actualFormula = formula;
    let variableValues = {};

    if (formula.includes('|')) {
      const parts = formula.split('|').map(p => p.trim());
      actualFormula = parts[0];

      // Parse variable assignments
      for (let i = 1; i < parts.length; i++) {
        const assignment = parts[i].trim();
        const match = assignment.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);
        if (match) {
          const varName = match[1];
          let value = match[2].trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          variableValues[varName] = value;
        }
      }
    }

    // Detect unknown variables in the formula
    const detectedVars = detectVariables(actualFormula);
    const missingVars = detectedVars.filter(v => !(v in variableValues));

    // If there are missing variables, ask user to provide values
    if (missingVars.length > 0) {
      const formattedFormula = formatFormula(actualFormula);

      // Store the pending formula
      pendingFormulas.set(msg.chat.id, {
        formula: actualFormula,
        variables: missingVars
      });

      const exampleValues = missingVars.map((v, i) => {
        if (i === 0) return `${v}='02'`;
        return `${v}='Yes'`;
      }).join(' | ');

      return bot.sendMessage(msg.chat.id,
        `⚠️ *Variables detected!*\n\n` +
        `*Formatted Formula:*\n\`\`\`\n${formattedFormula}\n\`\`\`\n\n` +
        `*Missing values for:* ${missingVars.join(', ')}\n\n` +
        `*Please reply with variable values:*\n` +
        `Format: \`${exampleValues}\`\n\n` +
        `_You can also use the full command:_\n` +
        `\`/parse ${actualFormula} | ${exampleValues}\`\n\n` +
        `_Type "cancel" or use any other command to cancel._`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // Substitute variables if provided
    const formulaWithValues = Object.keys(variableValues).length > 0
      ? substituteVariables(actualFormula, variableValues)
      : actualFormula;

    // Parse the formula
    const result = parseFormula(formulaWithValues);

    if (result.success) {
      const formattedWithValues = Object.keys(variableValues).length > 0
        ? formatFormula(formulaWithValues)
        : null;

      let response = `✅ *Result:* \`${result.result}\`\n\n`;

      if (Object.keys(variableValues).length > 0) {
        response += `*Variables:*\n`;
        for (const [varName, value] of Object.entries(variableValues)) {
          response += `• ${varName} = \`${value}\`\n`;
        }
        response += `\n*With Values:*\n\`\`\`\n${formattedWithValues}\n\`\`\``;
      }

      bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' })
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending parse result:", err));
    } else {
      // Error - show error message
      const formattedFormula = formatFormula(actualFormula);

      bot.sendMessage(msg.chat.id,
        `❌ *Formula Error*\n\n` +
        `*Formatted Formula:*\n\`\`\`\n${formattedFormula}\n\`\`\`\n` +
        `*Error:* ${result.error}`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending parse error:", err));
    }

  } catch (err) {
    console.error("Error in /parse command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while processing your formula.", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});

// ==================== NEW ENHANCEMENT: SFGO FORMATTER ====================
// Auto-detect "/sfgo" followed by numbers (e.g., "/sfgo11199")
bot.onText(/^\/sfgo(\d+)/i, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    const number = match[1];
    const result = `sfgo${number}-dev-gd|http://localhost:3001`;

    bot.sendMessage(msg.chat.id, result)
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending sfgo result:", err));

  } catch (err) {
    console.error("Error in sfgo auto-format:", err);
  }
});

// ==================== MESSAGE LISTENER FOR PENDING FORMULAS ====================
bot.on('message', async (msg) => {
  // If it's a command (starts with /), clear any pending formulas for this chat
  if (msg.text && msg.text.startsWith('/')) {
    if (pendingFormulas.has(msg.chat.id)) {
      pendingFormulas.delete(msg.chat.id);
    }
    return;
  }

  // Check if user has a pending formula
  const pending = pendingFormulas.get(msg.chat.id);
  if (!pending) {
    return;
  }

  try {
    const userInput = msg.text.trim();

    // Check if user wants to cancel
    if (userInput.toLowerCase() === 'cancel' || userInput.toLowerCase() === 'nevermind') {
      pendingFormulas.delete(msg.chat.id);
      return bot.sendMessage(msg.chat.id, '✅ Formula calculation cancelled.')
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // Check if message looks like variable assignment (contains = or |)
    if (!userInput.includes('=') && !userInput.includes('|')) {
      // Not a variable assignment, just ignore and let user continue chatting
      return;
    }

    // Parse variable assignments from user input
    const variableValues = {};
    const assignments = userInput.split('|').map(p => p.trim());

    for (const assignment of assignments) {
      const match = assignment.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);
      if (match) {
        const varName = match[1];
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        variableValues[varName] = value;
      }
    }

    // If no valid variable assignments found, ignore
    if (Object.keys(variableValues).length === 0) {
      return;
    }

    // Check if all required variables are provided
    const missingVars = pending.variables.filter(v => !(v in variableValues));

    if (missingVars.length > 0) {
      return bot.sendMessage(msg.chat.id,
        `❌ *Still missing values for:* ${missingVars.join(', ')}\n\n` +
        `Please provide all variables in format:\n` +
        `\`${pending.variables.map(v => `${v}=value`).join(' | ')}\``,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // All variables provided, clear pending and calculate
    pendingFormulas.delete(msg.chat.id);

    // Substitute variables
    const formulaWithValues = substituteVariables(pending.formula, variableValues);

    // Parse the formula
    const result = parseFormula(formulaWithValues);

    if (result.success) {
      const formattedWithValues = formatFormula(formulaWithValues);

      let response = `✅ *Result:* \`${result.result}\`\n\n`;
      response += `*Variables:*\n`;
      for (const [varName, value] of Object.entries(variableValues)) {
        response += `• ${varName} = \`${value}\`\n`;
      }
      response += `\n*With Values:*\n\`\`\`\n${formattedWithValues}\n\`\`\``;

      bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' })
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    } else {
      bot.sendMessage(msg.chat.id,
        `❌ *Formula Error*\n\n*Error:* ${result.error}`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }
  } catch (err) {
    console.error("Error handling pending formula:", err);
  }
});

// ==================== CLEAR COMMAND ====================
bot.onText(/^\/clear$/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    const chatIdToClean = msg.chat.id;

    const messageIds = botMessages.get(chatIdToClean) || [];

    // Check if there are no messages to delete
    if (messageIds.length === 0) {
      return bot.sendMessage(chatIdToClean, "✅ No bot messages to delete in this chat.")
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending clear response:", err));
    }

    let deletedCount = 0;

    // Send initial status message
    const statusMsg = await bot.sendMessage(chatIdToClean, "🗑️ *Deleting bot messages...*", { parse_mode: 'Markdown' });

    // Delete all bot messages
    for (const messageId of messageIds) {
      try {
        await bot.deleteMessage(chatIdToClean, messageId);
        deletedCount++;
      } catch (err) {
        // Message might be too old or already deleted
      }
    }

    // Clear the tracked messages for this chat
    botMessages.delete(chatIdToClean);

    // Update status message with result
    const resultMessage = `✅ Deleted ${deletedCount} messages`;

    await bot.editMessageText(resultMessage, {
      chat_id: chatIdToClean,
      message_id: statusMsg.message_id
    });

    // Don't track the status message - let it persist

  } catch (err) {
    console.error("Error in /clear command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while clearing messages.", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});

// ==================== HOLIDAY COMMAND ====================
bot.onText(/^\/holiday$/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    const today = getTodayHoliday();
    const tomorrow = getTomorrowHoliday();
    const upcoming = getUpcomingHolidays(5);

    let message = "🗓️ *Indonesian Public Holidays*\n\n";

    // Today's holiday status
    if (today) {
      message += `📍 *Today:* ${today.name}\n${formatDateIndonesian(today.date)}\n\n`;
    } else {
      message += `📍 *Today:* Not a holiday\n\n`;
    }

    // Tomorrow's holiday status
    if (tomorrow) {
      message += `⚠️ *Tomorrow:* ${tomorrow.name}\n${formatDateIndonesian(tomorrow.date)}\n\n`;
    }

    // Upcoming holidays
    if (upcoming.length > 0) {
      message += `*Upcoming Holidays:*\n`;
      upcoming.forEach((holiday, index) => {
        message += `${index + 1}. ${holiday.name}\n   ${formatDateIndonesian(holiday.date)}\n`;
      });
    }

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending holiday info:", err));

  } catch (err) {
    console.error("Error in /holiday command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while fetching holiday information.", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});
