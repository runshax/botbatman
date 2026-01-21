const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { encryptPassword } = require('./services/passwordEncryption');
const { parseFormula, addCustomFunction } = require('./services/formulaParser');
const { getTodayHoliday, getTomorrowHoliday, getUpcomingHolidays, formatDateIndonesian } = require('./services/indonesianHolidays');
const { initDatabase, addCredential, getCredential, getCredentialBySfgo, getAllCredentials, deleteCredential } = require('./services/database');
require('dotenv').config();

// Verify fetch is available (Node.js 18+ has it built-in)
if (typeof fetch === 'undefined') {
  console.error('CRITICAL: fetch is not available! Please use Node.js 18 or higher.');
  process.exit(1);
}

// Initialize database on startup
initDatabase();

// Store message IDs for deletion
const botMessages = new Map(); // chatId -> array of messageIds

// Store pending formulas waiting for variable values
const pendingFormulas = new Map(); // chatId -> {formula, variables}

// Store user Bearer tokens in memory (lost on redeploy)
// Auto-cleared after 5 minutes of inactivity for security
const userTokens = new Map(); // userId -> {bearerToken, loginTime, timeoutId}

// Auto-clear credentials after 5 minutes
const CREDENTIAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

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
      let yamlExamples = [];
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
            yamlExamples = [];
          } else if (line.startsWith('related_keywords:')) {
            currentSection = 'related';
          } else if (line.startsWith('  - ') && currentSection === 'aliases') {
            keyword.aliases.push(line.replace('  - ', '').trim().replace(/['"]/g, ''));
          } else if (line.startsWith('  - ') && currentSection === 'yaml_examples') {
            yamlExamples.push(line.replace('  - ', '').trim().replace(/['"]/g, ''));
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

      if (yamlExamples.length > 0) {
        keyword.yamlExamples = yamlExamples;
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

// Initialize bot with polling disabled initially
const bot = new TelegramBot(token, { polling: false });

console.log("Telegram bot is starting...");

// Handle polling errors (409 conflicts during deployment)
bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.response && error.response.body && error.response.body.error_code === 409) {
    console.log('Polling conflict detected (409). Stopping polling and will retry in 10 seconds...');
    // Stop polling and retry after delay
    bot.stopPolling().then(() => {
      setTimeout(() => {
        console.log('Retrying polling...');
        bot.startPolling();
      }, 10000);
    }).catch(err => {
      console.error('Error stopping polling:', err);
      setTimeout(() => {
        console.log('Retrying polling anyway...');
        bot.startPolling();
      }, 10000);
    });
  } else {
    console.error('Polling error:', error.code, error.message);
  }
});

// Wait 5 seconds before starting polling to let old instances die
setTimeout(() => {
  console.log('Starting polling after delay...');
  bot.startPolling();
}, 5000);

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

    `8️⃣ */ask*\n` +
    `   Browse formula documentation by category or keyword\n` +
    `   _Examples:_\n` +
    `   \`/ask\` - Show all categories\n` +
    `   \`/ask PAYFORM\` - List payroll keywords\n` +
    `   \`/ask BASE\` - Get BASE keyword details\n` +
    `   \`/ask JOINDATE\` - Employee join date info\n\n` +

    `9️⃣ */ticket*\n` +
    `   Manage and respond to tickets\n` +
    `   _Examples:_\n` +
    `   \`/ticket\` - Show all team tickets\n` +
    `   \`/ticket me\` - Show only your tickets\n` +
    `   \`/ticket res HDTKT-2601-00020563 Bearer eyJ0eXAi...\` - Respond with token\n` +
    `   \`/ticket res HDTKT-2601-00020563\` - Respond (uses stored token)\n` +
    `   \`/ticket logout\` - Clear Bearer token\n` +
    `   🔒 Response feature: Private chat only. Tokens auto-clear after 5 min.\n\n` +

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

    // Sort by country
    dbCreds.sort((a, b) => a.country.localeCompare(b.country));

    const allCreds = [];

    // Add database credentials with username
    for (const cred of dbCreds) {
      const sfgoOnly = cred.sfgo.split('|')[0].replace('-dev-gd', '');
      allCreds.push(`🌐 ${cred.country.toUpperCase()}\n${cred.username}\n${sfgoOnly}`);
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

  try {
    const query = match[1];
    const keywords = parseKeywordsFromMarkdown();

    if (!keywords || keywords.length === 0) {
      return bot.sendMessage(msg.chat.id,
        '⚠️ Error: Unable to load keywords documentation.\nPlease try again later.',
        { parse_mode: 'Markdown' }
      ).then(m => trackMessage(m.chat.id, m.message_id));
    }

    // No parameter - show all categories
    if (!query) {
      const categorized = {};
      keywords.forEach(kw => {
        const cat = kw.category || 'UNCATEGORIZED';
        if (!categorized[cat]) {
          categorized[cat] = [];
        }
        categorized[cat].push(kw.name);
      });

      const categoryDescriptions = {
        'ATTINTF': 'Attendance integration (overtime, work hours)',
        'ATTSTATUS': 'Attendance status tracking',
        'DEFFORM': 'Built-in functions (IF, SUM, DATEDIFF, etc.)',
        'EMPDATA': 'Employee master data',
        'EMPFORM': 'Employee data (join date, service length)',
        'PAYFORM': 'Component codes (AL_001, SALARY), BASE, component references',
        'PAYVAR': 'Pay variables'
      };

      let response = `📚 <b>Formula Keywords</b>\n\n`;
      response += `Total: ${keywords.length} keywords\n\n`;

      const sortedCategories = Object.keys(categorized).sort();
      for (const cat of sortedCategories) {
        const desc = categoryDescriptions[cat] || '';
        response += `<b>${cat}</b> (${categorized[cat].length})\n`;
        response += `${desc}\n\n`;
      }

      response += `<b>How to use:</b>\n`;
      response += `Type /ask CATEGORY to see keywords\n\n`;
      response += `<b>Examples:</b>\n`;
      response += `/ask PAYFORM\n`;
      response += `/ask DEFFORM\n`;
      response += `/ask ATTINTF`;

      return bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' })
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending categories:", err));
    }

    // Check if query is a category
    const categorized = {};
    keywords.forEach(kw => {
      const cat = kw.category || 'UNCATEGORIZED';
      if (!categorized[cat]) {
        categorized[cat] = [];
      }
      categorized[cat].push(kw.name);
    });

    const queryUpper = query.toUpperCase().trim();
    const matchedCategory = Object.keys(categorized).find(cat =>
      cat.toUpperCase() === queryUpper || cat.toUpperCase().includes(queryUpper)
    );

    // If it's a category, show keywords with descriptions
    if (matchedCategory) {
      const kwNames = categorized[matchedCategory].sort();

      // Get category description
      const categoryDescriptions = {
        'ATTINTF': 'Attendance integration keywords - Returns numbers for overtime and work hours',
        'ATTSTATUS': 'Attendance status tracking - Returns numbers for days worked, absences, etc.',
        'DEFFORM': 'Built-in functions for formulas (IF, SUM, DATEDIFF, ROUND, etc.)',
        'EMPDATA': 'Employee master data fields - Returns text values (name, position, grade)',
        'EMPFORM': 'Employee date fields (JOINDATE, etc.) - Returns dates or numbers',
        'PAYFORM': 'Component codes (AL_001, SALARY), BASE (component value), component references (get calculated result). Example: SALARY=BASE*2, BASE=10, then result=20',
        'PAYVAR': 'Pay period variables - Returns values for current pay period'
      };

      let response = `📚 <b>${matchedCategory}</b> (${kwNames.length} keywords)\n`;
      response += `<i>${categoryDescriptions[matchedCategory] || ''}</i>\n\n`;

      // Get full keyword objects with descriptions
      const kwObjects = kwNames.map(name =>
        keywords.find(k => k.name === name)
      ).filter(k => k);

      for (const kw of kwObjects) {
        response += `<b>${kw.name}</b>\n`;
        if (kw.description) {
          const shortDesc = kw.description.length > 80
            ? kw.description.substring(0, 80) + '...'
            : kw.description;
          // Escape HTML special characters
          const escapedDesc = shortDesc
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          response += `${escapedDesc}\n`;
        }

        // Add first YAML example if available
        if (kw.yamlExamples && kw.yamlExamples.length > 0) {
          // Escape HTML in examples
          const escapedExample = kw.yamlExamples[0]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          response += `<i>Example:</i> <code>${escapedExample}</code>\n`;
        }
        response += `\n`;

        // Check if response is getting too long (Telegram limit ~4096 chars)
        if (response.length > 3500) {
          await bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' })
            .then(m => trackMessage(m.chat.id, m.message_id));
          response = `📚 <b>${matchedCategory}</b> (continued)\n\n`;
        }
      }

      return bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' })
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending category list:", err));
    }

    // Otherwise, search for keyword
    const keyword = searchKeyword(query);

    if (!keyword) {
      return bot.sendMessage(msg.chat.id,
        `❌ "${query}" not found.\n\n` +
        "Try:\n" +
        "• \`/ask\` to see all categories\n" +
        "• \`/ask PAYFORM\` to list keywords\n" +
        "• Check keyword spelling",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
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
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(err => {
        console.error("Error sending keyword info:", err);
        bot.sendMessage(msg.chat.id, "Error displaying keyword information.")
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(e => console.error("Error sending error message:", e));
      });
  } catch (error) {
    console.error("Error in /ask command:", error);
    bot.sendMessage(msg.chat.id, '⚠️ An error occurred. Please try again.')
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(e => console.error("Error sending error message:", e));
  }
});

// ==================== NEW ENHANCEMENT: FORMULA CALCULATOR ====================
bot.onText(/^\/parse/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    // Extract formula from message text (everything after /parse)
    const messageText = msg.text || '';
    let formula = messageText.replace(/^\/parse\s*/, '').trim();

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

    // Clean up multi-line formulas: remove line breaks and extra spaces
    formula = formula.replace(/\n/g, '').replace(/\s+/g, ' ').trim();

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
          const varName = match[1].toUpperCase(); // Convert to uppercase for case-insensitive matching
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
        const varName = match[1].toUpperCase(); // Convert to uppercase for case-insensitive matching
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

    // Check if all required variables are provided (case-insensitive)
    const missingVars = pending.variables.filter(v => !(v.toUpperCase() in variableValues));

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

// ==================== TICKET COMMAND ====================
// Telegram username to work username mapping
const telegramToWorkUsername = {
  'anDimsky': 'andhikaputra',
  'jemmy33': 'jemmy',
  'joolllmn': 'joel',
  'rmdhnt6': 'herdiansyah'
};

bot.onText(/^\/ticket(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  const userId = msg.from.id.toString();
  const input = match[1];

  try {
    // SUBCOMMAND: logout - Clear Bearer token
    if (input === 'logout') {
      if (!userTokens.has(userId)) {
        return bot.sendMessage(msg.chat.id,
          `❌ You don't have a stored Bearer token`,
          { parse_mode: 'Markdown' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      // Clear the auto-clear timer
      const tokenData = userTokens.get(userId);
      if (tokenData && tokenData.timeoutId) {
        clearTimeout(tokenData.timeoutId);
      }

      userTokens.delete(userId);

      return bot.sendMessage(msg.chat.id,
        `✅ *Logged out successfully*\n\nBearer token cleared from memory`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // SUBCOMMAND: res <ticket_id> [Bearer token] - Respond to ticket
    if (input && input.startsWith('res ')) {
      // Check if this is a private chat
      if (msg.chat.type !== 'private') {
        return bot.sendMessage(msg.chat.id,
          `⚠️ *Security Warning*\n\n` +
          `Please use this command in a private chat with the bot to protect your Bearer token.\n\n` +
          `Bearer tokens will auto-clear after 5 minutes.`,
          { parse_mode: 'Markdown' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      // Validate user has permission (only mapped Telegram users can respond)
      const telegramUsername = msg.from.username;
      console.log(`[/ticket res] Username check: Telegram username = "${telegramUsername}"`);

      if (!telegramUsername) {
        console.log(`[/ticket res] ERROR: User has no Telegram username set`);
        return bot.sendMessage(msg.chat.id,
          `❌ *Username Required*\n\n` +
          `You need to set a Telegram username in your profile to use this command.\n\n` +
          `Go to Telegram Settings → Edit Profile → Username`,
          { parse_mode: 'Markdown' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      if (!telegramToWorkUsername[telegramUsername]) {
        console.log(`[/ticket res] ERROR: Username "${telegramUsername}" not in allowed list`);
        return bot.sendMessage(msg.chat.id,
          `❌ *Access Denied*\n\n` +
          `You don't have permission to respond to tickets.\n\n` +
          `Only authorized team members can use this feature.`,
          { parse_mode: 'Markdown' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      const resInput = input.substring(4).trim(); // Remove "res "
      const parts = resInput.split(/\s+/);
      const ticketCode = parts[0];

      if (!ticketCode || !ticketCode.startsWith('HDTKT-')) {
        return bot.sendMessage(msg.chat.id,
          `❌ *Invalid ticket ID*\n\n` +
          `Format: \`/ticket res HDTKT-2601-00020563 Bearer eyJ0eXAi...\`\n\n` +
          `Or use \`/ticket logout\` to clear stored token`,
          { parse_mode: 'Markdown' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      // Check if Bearer token is provided in this command
      let bearerToken = null;
      if (parts.length >= 2 && parts[1] === 'Bearer') {
        // Token provided: /ticket res HDTKT-2601-00020563 Bearer eyJ0eXAi...
        bearerToken = parts.slice(2).join(' ');

        // Clear existing timeout if user is providing new token
        const existing = userTokens.get(userId);
        if (existing && existing.timeoutId) {
          clearTimeout(existing.timeoutId);
        }

        // Set auto-clear timer (5 minutes)
        const timeoutId = setTimeout(() => {
          userTokens.delete(userId);
          console.log(`[Security] Auto-cleared Bearer token for user ${userId} after 5 minutes of inactivity`);
        }, CREDENTIAL_TIMEOUT);

        // Store in memory with timeout
        userTokens.set(userId, {
          bearerToken: bearerToken,
          loginTime: new Date(),
          timeoutId: timeoutId
        });
      } else {
        // No token provided, check if we have one stored
        const tokenData = userTokens.get(userId);

        if (!tokenData) {
          return bot.sendMessage(msg.chat.id,
            `❌ *No Bearer token found*\n\n` +
            `Please provide your Bearer token:\n` +
            `/ticket res ${ticketCode} Bearer eyJ0eXAi...\n\n` +
            `🔒 Token will auto-clear after 5 minutes.`,
            { parse_mode: 'Markdown' }
          )
            .then(m => trackMessage(m.chat.id, m.message_id))
            .catch(err => console.error("Error:", err));
        }

        bearerToken = tokenData.bearerToken;
      }

      // Step 1: GET ticket details to get TASK_ID
      console.log(`[/ticket res] Fetching ticket details for ${ticketCode}...`);
      const getResponse = await fetch('https://sf7doffice.dataon.com/hrm-go/v1/helpdesk/myticket/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'acc-name': 'indodevniaga',
          'company-code': 'pii',
          'company-id': '148',
          'coid': '148',
          'language': 'en'
        },
        body: JSON.stringify({
          TASK_CODE: ticketCode
        })
      });

      if (!getResponse.ok) {
        console.log(`[/ticket res] GET failed: ${getResponse.status} ${getResponse.statusText}`);
        let errorMsg = `API Error: ${getResponse.status} ${getResponse.statusText}`;
        if (getResponse.status === 401) {
          errorMsg = 'Authentication failed. Your Bearer token may be expired or invalid.';
        } else if (getResponse.status === 404) {
          errorMsg = `Ticket ${ticketCode} not found.`;
        }
        throw new Error(errorMsg);
      }

      const ticketData = await getResponse.json();

      // Extract TASK_ID from response
      const taskId = ticketData?.DATA?.LIST?.TASK_ID;

      if (!taskId) {
        console.log(`[/ticket res] Failed to extract TASK_ID from response`);
        throw new Error(`Unable to get TASK_ID from ticket ${ticketCode}. Response structure may have changed.`);
      }

      console.log(`[/ticket res] Got TASK_ID: ${taskId} for ticket ${ticketCode}`);

      // Step 2: UPDATE ticket status to "Responded"
      console.log(`[/ticket res] Updating ticket ${ticketCode} (TASK_ID: ${taskId}) to "Responded"...`);
      const updateResponse = await fetch('https://sf7doffice.dataon.com/hrm-go/v1/helpdesk/admin/ticket/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'acc-name': 'indodevniaga',
          'company-code': 'pii',
          'company-id': '148',
          'coid': '148',
          'language': 'en'
        },
        body: JSON.stringify({
          STATUS: 'Responded',
          TASK_ID: taskId
        })
      });

      if (!updateResponse.ok) {
        console.log(`[/ticket res] UPDATE failed: ${updateResponse.status} ${updateResponse.statusText}`);
        let errorMsg = `Failed to update ticket: ${updateResponse.status} ${updateResponse.statusText}`;
        if (updateResponse.status === 401) {
          errorMsg = 'Authentication failed. Your Bearer token may be expired or invalid.';
        } else if (updateResponse.status === 403) {
          errorMsg = 'Permission denied. You may not have access to update this ticket.';
        }
        throw new Error(errorMsg);
      }

      const updateResult = await updateResponse.json();
      console.log(`[/ticket res] ✅ SUCCESS! Ticket ${ticketCode} marked as "Responded"`);

      return bot.sendMessage(msg.chat.id,
        `✅ *Ticket Responded Successfully*\n\n` +
        `*Ticket:* ${ticketCode}\n` +
        `*Task ID:* ${taskId}\n` +
        `*Status:* Responded\n\n` +
        `🔒 Bearer token will auto-clear in 5 minutes.`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // SUBCOMMAND: me - Show only user's tickets
    const filterMe = input === 'me';
    let filterUsername = null;

    // If "me" is specified, get the user's work username
    if (filterMe) {
      const telegramUsername = msg.from.username;
      filterUsername = telegramToWorkUsername[telegramUsername];

      if (!filterUsername) {
        return bot.sendMessage(msg.chat.id,
          `❌ <b>Username Not Mapped</b>\n\n` +
          `Your Telegram username (@${telegramUsername}) is not mapped to a work username.\n\n` +
          `Please contact admin to add your mapping.`,
          { parse_mode: 'HTML' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    const payload = {
      startDate: todayStr,
      endDate: todayStr,
      username: 'jemmy', // Always use jemmy to get all team data
      includeTeam: true
    };

    // Send request to API
    const response = await fetch('https://apidoffice.dataon.com/tickets/api/resource-planning/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Debug: Log the API response structure
    console.log('API Response:', JSON.stringify(data, null, 2));
    console.log('Today string:', todayStr);

    // Check if data exists
    if (!data || !data.allocation || data.allocation.length === 0) {
      return bot.sendMessage(msg.chat.id,
        `📋 <b>No Tickets Found</b>\n\n` +
        `No tickets scheduled for today (${todayStr})\n\n` +
        `<i>API returned empty data or no allocations</i>`,
        { parse_mode: 'HTML' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    console.log(`Total allocations received: ${data.allocation.length}`);

    // Group tickets by username
    const userTickets = new Map();
    let totalTickets = 0;

    for (const allocation of data.allocation) {
      const userName = allocation.username || 'unknown';
      const fullName = allocation.full_name || userName;

      // Check if user has tickets array
      if (allocation.tickets && Array.isArray(allocation.tickets)) {
        for (const ticket of allocation.tickets) {
          // Check if ticket's start_date matches today
          if (ticket.start_date === todayStr || ticket.end_date === todayStr) {
            if (!userTickets.has(userName)) {
              userTickets.set(userName, {
                fullName: fullName,
                tickets: []
              });
            }

            userTickets.get(userName).tickets.push({
              documentNo: ticket.documentNo || 'N/A',
              subject: ticket.subject || 'Unknown Task',
              status: ticket.status || 'Unknown',
              taskType: ticket.task_type || 'Unknown',
              link: ticket.link || null
            });
            totalTickets++;
          }
        }
      }
    }

    // Build response grouped by user
    let responseText = `📋 <b>Today's Tickets (${todayStr})</b>`;
    if (filterMe) {
      responseText += ` - <i>My Tickets</i>`;
    }
    responseText += `\n\n`;

    if (totalTickets === 0) {
      if (filterMe) {
        responseText += `<i>You have no tickets for today</i>`;
      } else {
        responseText += `<i>No tickets found for today</i>`;
      }
    } else {
      let userCount = 0;
      const sortedUsers = Array.from(userTickets.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      for (const [userName, userData] of sortedUsers) {
        // If filtering by "me", only show tickets for the current user
        if (filterMe && userName !== filterUsername) {
          continue;
        }

        if (userData.tickets.length > 0) {
          userCount++;
          responseText += `<b>${userCount}. ${userData.fullName}</b> - ${userData.tickets.length} ticket${userData.tickets.length > 1 ? 's' : ''}\n\n`;
          responseText += `<pre>`;
          responseText += `Ticket ID            | Title                                      | Type              | Status\n`;
          responseText += `---------------------|--------------------------------------------|--------------------|--------\n`;

          for (const ticket of userData.tickets) {
            // For table format, we can't use HTML links inside <pre>, so use plain text
            const ticketId = ticket.documentNo.padEnd(20);
            const title = (ticket.subject.length > 42 ? ticket.subject.substring(0, 39) + '...' : ticket.subject).padEnd(43);
            const type = ticket.taskType.padEnd(18);
            const status = ticket.status;

            responseText += `${ticketId} | ${title} | ${type} | ${status}\n`;
          }

          responseText += `</pre>\n\n`;
        }
      }

      responseText += `<b>Total: ${totalTickets} ticket(s) | ${userCount} user(s)</b>`;
    }

    return bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'HTML' })
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(err => console.error("Error:", err));

  } catch (error) {
    console.error("Error fetching tickets:", error);

    let errorMessage = '❌ <b>Failed to fetch tickets</b>\n\n';

    if (error.message.includes('status')) {
      errorMessage += `API Error: ${error.message}\n\n`;
      errorMessage += `The ticket API might be down or credentials are invalid.`;
    } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
      errorMessage += `Request timeout. The API is taking too long to respond.\n\n`;
      errorMessage += `Please try again later.`;
    } else if (error.message.includes('fetch')) {
      errorMessage += `Network error. Unable to reach the ticket API.\n\n`;
      errorMessage += `Check your internet connection or the API URL.`;
    } else {
      errorMessage += `${error.message}\n\n`;
      errorMessage += `Please try again or contact support.`;
    }

    return bot.sendMessage(msg.chat.id, errorMessage, { parse_mode: 'HTML' })
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(err => console.error("Error:", err));
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
