const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');

// 1. DUMMY WEB SERVER (Important for Render)
const app = express();
app.get('/', (req, res) => res.send('Bot is Awake!'));
app.listen(process.env.PORT || 3000);

// 2. INITIALIZE BOT
const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

// TIMEZONE SETTING
const myTimezone = "Asia/Jakarta"; // Change to your local city (e.g., Asia/Manila, Europe/London)

// 3. MORNING REMINDER: 8:00 AM (Mon-Fri)
cron.schedule('0 8 * * 1-5', () => {
    bot.sendMessage(chatId, "☀️ **Good Morning!**\nTime to start working. Have a productive day!");
}, {
    scheduled: true,
    timezone: myTimezone
});

// AFTERNOON REMINDER: 4:45 PM (Mon-Fri)
cron.schedule('45 16 * * 1-5', () => {
    bot.sendMessage(chatId, "📝 **Reminder:**\nPlease don't forget to enter your **time sheet** before you log off!");
}, {
    scheduled: true,
    timezone: "Asia/Jakarta" // Make sure this matches your city!
});

console.log("Bot started. Reminders scheduled for 8:00 AM and 4:30 PM (Mon-Fri).");