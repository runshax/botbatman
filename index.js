const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { encryptPassword } = require('./services/passwordEncryption');
const { parseFormula, addCustomFunction } = require('./services/formulaParser');
require('dotenv').config();

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

// Morning Reminder: 8:05 AM (Mon-Fri)
cron.schedule('5 8 * * 1-5', () => {
  const today = new Date();
  const isMonday = today.getDay() === 1;

  let message = "☀️ *Good Morning!*\nTime to start working. Let's have a productive day!";

  if (isMonday) {
    message += "\n\nPlease check and fix last week's tickets!";
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
  bot.sendMessage(chatId, "📝 *Reminder:*\nDon't forget to fill in your timesheet!", { parse_mode: 'Markdown' })
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
  const helpMessage = `🤖 *Bot Command List*\n\n` +
    `*Available Commands:*\n\n` +

    `1️⃣ */help*\n` +
    `   Show this help message\n` +
    `   _Example:_ \`/help\`\n\n` +

    `2️⃣ */dev [country]*\n` +
    `   Show dev credentials for all countries or specific country\n` +
    `   _Countries:_ my, id, th, vn, vn2, ph\n` +
    `   _Examples:_\n` +
    `   \`/dev\` - show all credentials\n` +
    `   \`/dev my\` - show Malaysia only\n\n` +

    `3️⃣ */reset username password*\n` +
    `   Generate encrypted password hash for database\n` +
    `   _Example:_\n` +
    `   \`/reset email@gmail.com pass1234\`\n\n` +

    `4️⃣ */parse formula*\n` +
    `   Calculate mathematical formulas and functions\n` +
    `   _Examples:_\n` +
    `   \`/parse 1+1\`\n` +
    `   \`/parse SUM(10,20,30)\`\n` +
    `   \`/parse ROUND(3.14159, 2)\`\n` +
    `   \`/parse MAX(100,50,75)\`\n\n` +

    `5️⃣ */clear*\n` +
    `   Delete all bot messages in this chat\n` +
    `   _Example:_ \`/clear\`\n\n` +

    `6️⃣ *Auto SFGO Formatter*\n` +
    `   Type "sfgo" + number to auto-format\n` +
    `   _Example:_\n` +
    `   Type: \`sfgo11199\`\n` +
    `   Result: \`sfgo11199-dev-gd|http://localhost:3001\`\n\n` +

    `💡 _Tip: Type any command without parameters to see usage examples!_`;

  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending help message:", err));
});

bot.onText(/^\/dev(?:\s+(.+))?$/, (msg, match) => {
  const userId = msg.from.id.toString();

  const subCommand = match[1] ? match[1].toLowerCase().trim() : null;

  // Function to format credentials with full details (for specific country)
  const formatCredFull = (credString, flag) => {
    if (!credString || credString.includes("Not set")) {
      return `${flag}: Not set`;
    }

    // Split by "/" and trim each part
    const parts = credString.split('/').map(p => p.trim());

    if (parts.length >= 3) {
      // Wrap in backticks to prevent Markdown parsing issues
      return `${flag}\nUsername: \`${parts[0]}\`\nPassword: \`${parts[1]}\`\nSFGO: \`${parts[2]}\``;
    }

    return `${flag}\n${credString}`;
  };

  // Function to format credentials - only show SFGO (for all countries list)
  const formatCredShort = (credString, flag) => {
    if (!credString || credString.includes("Not set")) {
      return `${flag}: Not set`;
    }

    // Split by "/" and trim each part
    const parts = credString.split('/').map(p => p.trim());

    if (parts.length >= 3) {
      // Only show flag and SFGO
      return `${flag}\n${parts[2]}`;
    }

    return `${flag}\n${credString}`;
  };

  let response = "";

  if (subCommand) {
    // Specific country requested - show full credentials
    const credsFull = {
      my: formatCredFull(process.env.DEVMY, "🇲🇾 MY"),
      id: formatCredFull(process.env.DEVID, "🇮🇩 ID"),
      th: formatCredFull(process.env.DEVTH, "🇹🇭 TH"),
      vn: formatCredFull(process.env.DEVVN, "🇻🇳 VN"),
      vn2: formatCredFull(process.env.DEVVN2, "🇻🇳 VN2"),
      ph: formatCredFull(process.env.DEVPH, "🇵🇭 PH")
    };

    if (credsFull[subCommand]) {
      response = `🔐 *Dev Credential (${subCommand.toUpperCase()})*\n\n${credsFull[subCommand]}`;
    } else {
      response = `❌ *Country not found!*\n\nAvailable: my, id, th, vn, vn2, ph`;
    }
  } else {
    // No country specified - show only SFGO for all
    const credsShort = {
      my: formatCredShort(process.env.DEVMY, "🇲🇾 MY"),
      id: formatCredShort(process.env.DEVID, "🇮🇩 ID"),
      th: formatCredShort(process.env.DEVTH, "🇹🇭 TH"),
      vn: formatCredShort(process.env.DEVVN, "🇻🇳 VN"),
      vn2: formatCredShort(process.env.DEVVN2, "🇻🇳 VN2"),
      ph: formatCredShort(process.env.DEVPH, "🇵🇭 PH")
    };

    response = `🔐 *All Regional Credentials*\n---------------------------\n\n` +
      Object.values(credsShort).join('\n\n---------------------------\n\n') +
      `\n\n_Type "/dev my" for full credentials._`;
  }

  bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending dev credentials:", err));
});

// ==================== NEW ENHANCEMENT: PASSWORD RESET ====================
bot.onText(/^\/reset(?:\s+(.+))?$/, async (msg, match) => {
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
// Auto-detect "sfgo" followed by numbers (e.g., "sfgo11199")
bot.onText(/sfgo(\d+)/i, async (msg, match) => {
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
  try {
    const chatIdToClean = msg.chat.id;

    if (!botMessages.has(chatIdToClean)) {
      return bot.sendMessage(chatIdToClean, "✅ No bot messages to delete in this chat.")
        .then(msg => trackMessage(msg.chat.id, msg.message_id))
        .catch(err => console.error("Error sending clear response:", err));
    }

    const messageIds = botMessages.get(chatIdToClean) || [];
    let deletedCount = 0;
    let failedCount = 0;

    // Send initial status message
    const statusMsg = await bot.sendMessage(chatIdToClean, "🗑️ *Deleting bot messages...*", { parse_mode: 'Markdown' });

    // Delete all tracked messages
    for (const messageId of messageIds) {
      try {
        await bot.deleteMessage(chatIdToClean, messageId);
        deletedCount++;
      } catch (err) {
        failedCount++;
        // Message might be too old or already deleted
      }
    }

    // Clear the tracked messages for this chat
    botMessages.delete(chatIdToClean);

    // Update status message with result
    const resultMessage = `✅ *Cleanup Complete*\n\n` +
      `Deleted: ${deletedCount} messages\n` +
      (failedCount > 0 ? `Failed: ${failedCount} messages (too old or already deleted)` : '');

    await bot.editMessageText(resultMessage, {
      chat_id: chatIdToClean,
      message_id: statusMsg.message_id,
      parse_mode: 'Markdown'
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
