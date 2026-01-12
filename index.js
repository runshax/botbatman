const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { encryptPassword } = require('./services/passwordEncryption');
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

// Send a test message on startup
// bot.sendMessage(chatId, "🤖 Test message: Bot is now online! via docker")
//   .then(() => console.log("Test message sent successfully!"))
//   .catch(err => console.error("Error sending test message:", err));

// 3. SCHEDULED REMINDERS (Mon-Fri)
const timezone = "Asia/Jakarta";

// Morning Reminder: 8:00 AM
cron.schedule('0 8 * * 1-5', () => {
  bot.sendMessage(chatId, "☀️ *Good Morning!*\nTime to start working. Let's have a productive day!", { parse_mode: 'Markdown' })
    .catch(err => console.error("Error sending morning reminder:", err));
  console.log("Morning reminder sent at 8:00 AM");
}, {
  scheduled: true,
  timezone: timezone
});

// Afternoon Reminder: 4:45 PM
cron.schedule('45 16 * * 1-5', () => {
  bot.sendMessage(chatId, "📝 *Reminder:*\nPlease don't forget to enter your *time sheet* before you log off!", { parse_mode: 'Markdown' })
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
bot.onText(/^\/resetpass(?:\s+(.+))?$/, async (msg, match) => {
  try {
    const input = match[1];

    if (!input) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\n*Usage:*\n`/resetpass username password`\n\n*Example:*\n`/resetpass email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      ).catch(err => console.error("Error sending resetpass help:", err));
    }

    const parts = input.trim().split(/\s+/);

    if (parts.length !== 2) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\nHarus ada 2 parameter: username dan password\n\n*Example:*\n`/resetpass email@gmail.com pass1234`",
        { parse_mode: 'Markdown' }
      ).catch(err => console.error("Error sending resetpass error:", err));
    }

    const [username, password] = parts;
    const uuid = process.env.DEFAULT_UUID || 'reset';

    bot.sendMessage(msg.chat.id, "⏳ *Processing...*\nGenerating encrypted password hash...", { parse_mode: 'Markdown' })
      .catch(err => console.error("Error sending processing message:", err));

    const result = await encryptPassword(username, password, uuid);

    bot.sendMessage(msg.chat.id, `\`\`\`\n${result.message}\n\`\`\``, { parse_mode: 'Markdown' })
      .catch(err => console.error("Error sending resetpass result:", err));

  } catch (err) {
    console.error("Error in /resetpass command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while processing your request.", { parse_mode: 'Markdown' })
      .catch(err => console.error("Error sending error message:", err));
  }
});
