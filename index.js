const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
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
bot.sendMessage(chatId, "🤖 Test message: Bot is now online! via docker")
  .then(() => console.log("Test message sent successfully!"))
  .catch(err => console.error("Error sending test message:", err));

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

// // Optional: Log a message when the bot receives /start
// bot.onText(/\/start/, (msg) => {
//   bot.sendMessage(msg.chat.id, "Bot is active! I will remind you at 8:00 AM and 4:45 PM on weekdays.")
//     .catch(err => console.error("Error sending /start response:", err));
// });
