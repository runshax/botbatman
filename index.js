const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { encryptPassword } = require('./services/passwordEncryption');
const { parseFormula, addCustomFunction } = require('./services/formulaParser');
require('dotenv').config();

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

    `💡 _Tip: Type any command without parameters to see usage examples!_`;

  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' })
    .catch(err => console.error("Error sending help message:", err));
});

bot.onText(/^\/dev(?:\s+(.+))?$/, (msg, match) => {
  const userId = msg.from.id.toString();

  const subCommand = match[1] ? match[1].toLowerCase().trim() : null;

  // Prepare all your credentials
  const creds = {
    my: process.env.DEVMY || "🇲🇾 MY: Not set",
    id: process.env.DEVID || "🇮🇩 ID: Not set",
    th: process.env.DEVTH || "🇹🇭 TH: Not set",
    vn: process.env.DEVVN || "🇻🇳 VN: Not set",
    vn2: process.env.DEVVN2 || "🇻🇳 VN2: Not set",
    ph: process.env.DEVPH || "🇵🇭 PH: Not set"
  };

  let response = "";

  if (subCommand && creds[subCommand]) {
    // If you typed "/dev my", show only Malaysia
    response = `🔐 **Dev Credential (${subCommand.toUpperCase()})**\n\n${creds[subCommand]}`;
  } else {
    // If you typed just "/dev", show everything
    response = `🔐 **All Regional Credentials**\n---------------------------\n` +
      Object.values(creds).join('\n') +
      `\n\n_Type "/dev my" for specific notes._`;
  }

  bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
});

// ==================== NEW ENHANCEMENT: PASSWORD RESET ====================
bot.onText(/^\/reset(?:\s+(.+))?$/, async (msg, match) => {
  try {
    const input = match[1];

    if (!input) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\n*Usage:*\n`/reset username password`\n\n*Example:*\n`/reset email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      ).catch(err => console.error("Error sending reset help:", err));
    }

    const parts = input.trim().split(/\s+/);

    if (parts.length !== 2) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\nHarus ada 2 parameter: username dan password\n\n*Example:*\n`/reset email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      ).catch(err => console.error("Error sending reset error:", err));
    }

    const [username, password] = parts;
    const uuid = process.env.DEFAULT_UUID || 'reset';

    bot.sendMessage(msg.chat.id, "⏳ *Processing...*\nGenerating encrypted password hash...", { parse_mode: 'Markdown' })
      .catch(err => console.error("Error sending processing message:", err));

    const result = await encryptPassword(username, password, uuid);

    bot.sendMessage(msg.chat.id, `\`\`\`\n${result.message}\n\`\`\``, { parse_mode: 'Markdown' })
      .catch(err => console.error("Error sending reset result:", err));

  } catch (err) {
    console.error("Error in /reset command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while processing your request.", { parse_mode: 'Markdown' })
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
      ).catch(err => console.error("Error sending parse help:", err));
    }

    // Parse the formula
    const result = parseFormula(formula);

    if (result.success) {
      // Success - show result
      bot.sendMessage(msg.chat.id,
        `✅ *Result:* \`${result.result}\`\n\n` +
        `Formula: \`${formula}\``,
        { parse_mode: 'Markdown' }
      ).catch(err => console.error("Error sending parse result:", err));
    } else {
      // Error - show error message
      bot.sendMessage(msg.chat.id,
        `❌ *Formula Error*\n\n` +
        `*Formula:* \`${formula}\`\n` +
        `*Error:* ${result.error}`,
        { parse_mode: 'Markdown' }
      ).catch(err => console.error("Error sending parse error:", err));
    }

  } catch (err) {
    console.error("Error in /parse command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while processing your formula.", { parse_mode: 'Markdown' })
      .catch(err => console.error("Error sending error message:", err));
  }
});
