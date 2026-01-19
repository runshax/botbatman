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

    `8️⃣ */clear*\n` +
    `   Delete all bot messages in this chat\n` +
    `   _Example:_ \`/clear\`\n\n` +

    `9️⃣ */holiday*\n` +
    `   Check Indonesian public holidays\n` +
    `   _Example:_ \`/holiday\`\n\n` +

    `🔟 */sfgo[number]*\n` +
    `   Auto-format SFGO numbers\n` +
    `   _Example:_ \`/sfgo11199\`\n` +
    `   _Result:_ \`sfgo11199-dev-gd|http://localhost:3001\`\n\n` +

    `💡 _Tip: Type any command without parameters to see usage examples!_`;

  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending help message:", err));
});

bot.onText(/^\/dev(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
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
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
        .catch(err => console.error("Error sending reset help:", err));
    }

    const parts = input.trim().split(/\s+/);

    if (parts.length !== 2) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\nHarus ada 2 parameter: username dan password\n\n*Example:*\n`/reset email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      )
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
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
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
        .catch(err => console.error("Error sending parse help:", err));
    }

    // Parse the formula
    const result = parseFormula(formula);

    if (result.success) {
      // Success - show result
      bot.sendMessage(msg.chat.id,
        `✅ *Result:* \`${result.result}\`\n\n` +
        `Formula: \`${formula}\``,
        { parse_mode: 'Markdown' }
      )
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
        .catch(err => console.error("Error sending parse result:", err));
    } else {
      // Error - show error message
      bot.sendMessage(msg.chat.id,
        `❌ *Formula Error*\n\n` +
        `*Formula:* \`${formula}\`\n` +
        `*Error:* ${result.error}`,
        { parse_mode: 'Markdown' }
      )
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
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

// ==================== CLEAR COMMAND ====================
bot.onText(/^\/clear$/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    const chatIdToClean = msg.chat.id;

    const messageIds = botMessages.get(chatIdToClean) || [];

    // Check if there are no messages to delete
    if (messageIds.length === 0) {
      return bot.sendMessage(chatIdToClean, "✅ No bot messages to delete in this chat.")
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
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

    // Track the status message so it can be deleted next time
    trackMessage(chatIdToClean, statusMsg.message_id);

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
