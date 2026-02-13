const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const { encryptPassword } = require('./services/passwordEncryption');
const { parseFormula, addCustomFunction, getSupportedFunctions } = require('./services/formulaParser');


const { getTodayHoliday, getTomorrowHoliday, getUpcomingHolidays, formatDateIndonesian } = require('./services/indonesianHolidays');
const { initDatabase, addCredential, getCredential, getCredentialBySfgo, getAllCredentials, deleteCredential, saveErrorLog, saveErrorLogBatch, getAllErrorLogs, getErrorLogById, deleteErrorLog, deleteAllErrorLogs, getUnremindedErrorLogs, markErrorLogsAsReminded, getErrorLogsByDate, deleteOldErrorLogs } = require('./services/database');
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
  // Known functions to exclude (dynamically fetched)
  const knownFunctions = getSupportedFunctions();

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

// 1. HEALTH CHECK SERVER & API (Required for Koyeb)
// Koyeb needs to see a "website" running on port 8080 or it will restart the bot.
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies up to 10MB
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Auth middleware for API endpoints
const authenticateAPI = (req, res, next) => {
  const authKey = req.headers['x-api-key'] || req.headers['authorization'];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      success: false,
      error: 'API key not configured on server'
    });
  }

  if (!authKey || authKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key'
    });
  }

  next();
};

// Health check endpoint (no auth needed)
app.get('/', async (req, res) => {
  res.send('Bot is online and healthy! 🚀');

  // Auto-send unreminded error logs to Telegram (only if REMINDER_ERROR is true)
  const reminderEnabled = process.env.REMINDER_ERROR === 'true';

  if (!reminderEnabled) {
    return; // Skip auto-reminder if disabled
  }

  // Active window: 8:00 AM to 7:30 PM (Asia/Jakarta)
  // Before 8 AM: skip (7:30 AM cron handles previous day)
  // After 7:30 PM: skip (next morning report will cover it)
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const currentHour = jakartaTime.getHours();
  const currentMinute = jakartaTime.getMinutes();

  const isAfter8AM = currentHour >= 8;
  const isBefore730PM = currentHour < 19 || (currentHour === 19 && currentMinute < 30);

  if (!isAfter8AM || !isBefore730PM) {
    console.log(`Skipping auto-reminder outside active window (current Jakarta time: ${currentHour}:${String(currentMinute).padStart(2, '0')})`);
    return;
  }

  try {
    const unremindedLogs = await getUnremindedErrorLogs();

    // Filter out query/database errors - only show actual application errors
    const actualErrors = unremindedLogs.filter(log => {
      try {
        const parsed = JSON.parse(log.data);

        // Skip if it's a database/query error (check file field)
        // Exception: allow DEADLOCK errors through
        if (parsed.file && (
          parsed.file.includes('QueryFailedError') ||
          parsed.file.includes('ConnectionError') ||
          parsed.file.includes('DatabaseError')
        )) {
          if (parsed.message && parsed.message.toUpperCase().includes('DEADLOCK')) {
            return true;
          }
          return false;
        }

        // Skip if message contains database error keywords
        if (parsed.message) {
          const msgLower = parsed.message.toLowerCase();
          if (msgLower.includes('duplicate entry') ||
              msgLower.includes('connection refused') ||
              msgLower.includes('query failed') ||
              msgLower.includes('database error')) {
            return false;
          }
        }

        return true; // It's an actual application error
      } catch (e) {
        // If not valid JSON, include it (plain text errors)
        return true;
      }
    });

    if (actualErrors.length > 0) {
      console.log(`Found ${actualErrors.length} actual error logs (filtered from ${unremindedLogs.length} total), sending to Telegram...`);

      // Show only first 5 from actual errors
      const displayLogs = actualErrors.slice(0, 5);
      const remainingLogs = actualErrors.slice(5);

      // Prepare message - same format as /errorlog command
      let message = `🚨 <b>New Error Logs</b> (${actualErrors.length} total, showing 5)\n\n`;

      for (const log of displayLogs) {
        const date = toJakartaDate(log.created_date);

        let companyCode = '';
        let msgText = '';
        let queryPreview = '';
        try {
          const parsed = JSON.parse(log.data);
          companyCode = parsed.companyCode || '';
          msgText = parsed.message || '';
          if (parsed.query) {
            queryPreview = parsed.query.length > 150
              ? parsed.query.substring(0, 150) + '...'
              : parsed.query;
          }
        } catch (e) {
          msgText = log.data;
        }

        // Escape HTML special characters
        const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        message += `🔸 <b>ID:</b> <code>${log.id.substring(0, 8)}</code>\n`;
        message += `   📅 ${date}\n`;
        if (companyCode) message += `   🏢 ${esc(companyCode)}\n`;
        message += `   💬 ${esc(msgText)}\n`;
        if (queryPreview) message += `   🗄 <code>${esc(queryPreview)}</code>\n`;
        message += '\n';
      }

      // If there are more than 5, show remaining IDs (limit to 10)
      if (remainingLogs.length > 0) {
        const idsToShow = remainingLogs.slice(0, 10);
        const remainingIds = idsToShow.map(log => log.id.substring(0, 8)).join(', ');
        const hiddenCount = remainingLogs.length > 10 ? remainingLogs.length - 10 : 0;

        message += `\n<i>⚠️ Additional ${remainingLogs.length} error(s) not shown:</i>\n`;
        message += `<code>${remainingIds}</code>`;

        if (hiddenCount > 0) {
          message += `\n<i>... and ${hiddenCount} more</i>`;
        }

        message += `\n<i>Use /errorlog &lt;id&gt; to view and mark as reminded</i>`;
      }

      // Send to Telegram
      const chatId = process.env.CHAT_ID;
      if (chatId) {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

        // Mark ONLY the displayed 5 as reminded
        const displayedIds = displayLogs.map(log => log.id);
        await markErrorLogsAsReminded(displayedIds);

        console.log(`Sent ${displayLogs.length} error logs to Telegram and marked as reminded. ${remainingLogs.length} remaining.`);
      }
    }
  } catch (err) {
    console.error('Error in health check auto-reminder:', err);
  }
});

// API endpoint to save error logs from external servers
app.post('/api/saveerrorlog', authenticateAPI, async (req, res) => {
  try {
    const { data, type_data } = req.body;

    // Validation
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: data'
      });
    }

    // Save to database
    const result = await saveErrorLog(data, type_data || null);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: 'Error log saved successfully',
        id: result.data.id,
        created_date: result.data.created_date
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in /api/error-log:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all error logs (with auth - for debugging)
app.get('/api/error-log', authenticateAPI, async (req, res) => {
  try {
    const logs = await getAllErrorLogs();
    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('Error in GET /api/error-log:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get error log by ID (with auth)
app.get('/api/error-log/:id', authenticateAPI, async (req, res) => {
  try {
    const log = await getErrorLogById(req.params.id);
    if (log) {
      return res.status(200).json({
        success: true,
        data: log
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Error log not found'
      });
    }
  } catch (error) {
    console.error('Error in GET /api/error-log/:id:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Batch insert error logs
app.post('/api/saveerrorlog/batch', authenticateAPI, async (req, res) => {
  try {
    const { errors } = req.body;

    // Validation
    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: errors (must be a non-empty array)'
      });
    }

    // Validate each error object has required fields
    for (let i = 0; i < errors.length; i++) {
      if (!errors[i].data) {
        return res.status(400).json({
          success: false,
          error: `Missing 'data' field in errors[${i}]`
        });
      }
    }

    // Save to database
    const result = await saveErrorLogBatch(errors);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: `${result.count} error logs saved successfully`,
        count: result.count,
        ids: result.data.map(log => log.id)
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in /api/saveerrorlog/batch:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete error log by ID
app.delete('/api/error-log/:id', authenticateAPI, async (req, res) => {
  try {
    const result = await deleteErrorLog(req.params.id);
    if (result.success && result.deleted) {
      return res.status(200).json({
        success: true,
        message: 'Error log deleted successfully',
        data: result.data
      });
    } else if (result.success && !result.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Error log not found'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in DELETE /api/error-log/:id:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete all error logs
app.delete('/api/error-log', authenticateAPI, async (req, res) => {
  try {
    const result = await deleteAllErrorLogs();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `${result.count} error logs deleted successfully`,
        count: result.count
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in DELETE /api/error-log:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Health check server is listening on port ${PORT}`);
  console.log(`API endpoint: POST http://localhost:${PORT}/api/saveerrorlog`);
});

// Helper: format a DB date to Jakarta time (UTC+7) as YYYY-MM-DD HH:MM or YYYY-MM-DD HH:MM:SS
const toJakartaDate = (dbDate, withSeconds = false) => {
  const utc = new Date(dbDate);
  const jakarta = new Date(utc.getTime() + 7 * 60 * 60 * 1000);
  const year = jakarta.getUTCFullYear();
  const month = String(jakarta.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jakarta.getUTCDate()).padStart(2, '0');
  const hours = String(jakarta.getUTCHours()).padStart(2, '0');
  const minutes = String(jakarta.getUTCMinutes()).padStart(2, '0');
  const seconds = String(jakarta.getUTCSeconds()).padStart(2, '0');
  return withSeconds
    ? `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    : `${year}-${month}-${day} ${hours}:${minutes}`;
};

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

// Lunch Menu Notification: 10:40 AM (Mon-Fri)
cron.schedule('40 10 * * 1-5', () => {
  const holiday = getTodayHoliday();

  // Skip notification if today is a public holiday
  if (holiday) {
    console.log(`Skipping lunch menu notification - Today is ${holiday.name}`);
    return;
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  try {
    // Load lunch menu data
    const fs = require('fs');
    const path = require('path');
    const menuFilePath = path.join(__dirname, 'data', 'lunch-menu.json');

    if (!fs.existsSync(menuFilePath)) {
      console.log('Lunch menu file not found:', menuFilePath);
      return;
    }

    const menuData = JSON.parse(fs.readFileSync(menuFilePath, 'utf8'));

    // Extract year and month from todayStr (YYYY-MM-DD)
    const [year, month] = todayStr.split('-');

    // Navigate to the menu: menuData[year][month].schedule[date]
    if (!menuData[year] || !menuData[year][month] || !menuData[year][month].schedule) {
      console.log(`No lunch menu data available for ${year}-${month}`);
      return;
    }

    const todayMenu = menuData[year][month].schedule[todayStr];

    if (!todayMenu) {
      console.log(`No lunch menu found for today: ${todayStr}`);
      return;
    }

    // Format the menu message
    let message = `🍽️ *${todayMenu.day}*\n\n`;

    for (const item of Object.values(todayMenu.meals)) {
      message += `• ${item}\n`;
    }

    message += `\n_Selamat makan! 😋_`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending lunch menu notification:", err));

    console.log(`Lunch menu notification sent at 10:40 AM for ${todayStr}`);
  } catch (error) {
    console.error('Error loading lunch menu:', error);
  }
}, {
  scheduled: true,
  timezone: timezone
});

// Daily 7:30 AM - Send ALL error logs from yesterday (previous day)
cron.schedule('30 7 * * *', async () => {
  try {
    console.log('Running daily error log report at 7:30 AM...');

    // Get yesterday's date in Jakarta timezone (UTC+7)
    const now = new Date();
    const jakartaNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const jakartaYesterday = new Date(jakartaNow.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${jakartaYesterday.getUTCFullYear()}-${String(jakartaYesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(jakartaYesterday.getUTCDate()).padStart(2, '0')}`; // YYYY-MM-DD

    // Get ALL error logs from yesterday (regardless of status_reminder)
    const yesterdayLogs = await getErrorLogsByDate(yesterdayStr);

    // If no logs, don't send anything
    if (yesterdayLogs.length === 0) {
      console.log(`No error logs found for ${yesterdayStr}`);
      return;
    }

    // Generate TXT file content
    const fs = require('fs');
    const path = require('path');

    let txtContent = `Daily Error Logs Report\n`;
    txtContent += `Date: ${yesterdayStr}\n`;
    txtContent += `Generated: ${toJakartaDate(new Date(), true)}\n`;
    txtContent += `Total: ${yesterdayLogs.length} log(s)\n`;
    txtContent += `${'='.repeat(80)}\n\n`;

    for (const log of yesterdayLogs) {
      const date = toJakartaDate(log.created_date, true);

      txtContent += `ID: ${log.id}\n`;
      txtContent += `Date: ${date}\n`;
      if (log.type_data) {
        txtContent += `Type: ${log.type_data}\n`;
      }
      txtContent += `Status: ${log.status_reminder || 'Not reminded'}\n`;
      txtContent += `Data:\n${log.data}\n`;
      txtContent += `${'-'.repeat(80)}\n\n`;
    }

    // Save to temp file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `daily_errorlogs_${yesterdayStr}.txt`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, txtContent, 'utf8');

    // Send file to Telegram
    const chatId = process.env.CHAT_ID;
    if (chatId) {
      await bot.sendDocument(chatId, filePath, {
        caption: `📋 *Daily Error Log Report*\n\nAll error logs from ${yesterdayStr} (${yesterdayLogs.length} total)`,
        parse_mode: 'Markdown'
      });

      console.log(`Sent daily error log report: ${yesterdayLogs.length} logs from ${yesterdayStr}`);
    }

    // Delete temp file
    fs.unlinkSync(filePath);

    // Auto-cleanup: delete error logs older than 5 days
    const cleanup = await deleteOldErrorLogs(5);
    if (cleanup.success && cleanup.deleted > 0) {
      console.log(`Auto-cleanup: deleted ${cleanup.deleted} error log(s) older than 5 days`);
    }

  } catch (error) {
    console.error('Error in daily error log report:', error);
  }
}, {
  scheduled: true,
  timezone: timezone
});

// Error handling for polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

// ==================== TOPIC GUARD ====================
// Only allow user commands in the PayrollBot topic (thread 6119)
const BOT_TOPIC_ID = 6119;


// ==================== HELP COMMAND ====================
bot.onText(/^\/help$/, (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
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
    `   \`/ticket\` - Show all team tickets with clickable links\n` +
    `   \`/ticket me\` - Show only your tickets\n` +
    `   \`/ticket login\` - Web login instructions (for clickable links)\n` +
    `   \`/ticket res HDTKT-2601-00020563 Bearer eyJ0eXAi...\` - Respond with token\n` +
    `   \`/ticket res HDTKT-2601-00020563\` - Respond (uses stored token)\n` +
    `   \`/ticket logout\` - Clear Bearer token\n` +
    `   🔒 Response feature: Private chat only. Tokens auto-clear after 5 min.\n\n` +

    `🔟 */clear*\n` +
    `   Delete all bot messages in this chat\n` +
    `   _Example:_ \`/clear\`\n\n` +

    `1️⃣1️⃣ */lunch*\n` +
    `   Check today's lunch menu (auto-notified at 10:40 AM)\n` +
    `   _Example:_ \`/lunch\`\n\n` +

    `1️⃣2️⃣ */holiday*\n` +
    `   Check Indonesian public holidays\n` +
    `   _Example:_ \`/holiday\`\n\n` +

    `1️⃣3️⃣ */sfgo[number]* or */sfgo[number] qa*\n` +
    `   Auto-format SFGO numbers for dev or QA environment\n` +
    `   _Examples:_\n` +
    `   \`/sfgo11199\` → \`sfgo11199-dev-gd|http://localhost:3001\`\n` +
    `   \`/sfgo11199 qa\` → \`sfgo11199-gd|https://payroll.greatdayhr.com/payrollqa4\`\n\n` +

    `1️⃣4️⃣ */de64*\n` +
    `   Decode base64 database credentials (filters _fin and _admin only)\n` +
    `   _Example:_ \`/de64 W3siREJFTkdJTkUiOi...\`\n` +
    `   _Returns:_ Prettified JSON with filtered credentials\n\n` +

    `1️⃣5️⃣ */errorlog*\n` +
    `   View error logs from external servers (Koyeb API)\n` +
    `   _Examples:_\n` +
    `   \`/errorlog\` - Show latest 10 logs\n` +
    `   \`/errorlog <id>\` - Show specific log details\n` +
    `   \`/errorlog clear\` - Delete all error logs\n` +
    `   \`/errorlog download 2026-02-06\` - Download logs as TXT file\n\n` +

    `💡 _Tip: Type any command without parameters to see usage examples!_`;

  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' })
    .then(msg => trackMessage(msg.chat.id, msg.message_id))
    .catch(err => console.error("Error sending help message:", err));
});

bot.onText(/^\/dev(?:\s+(.+))?$/, async (msg, match) => {
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
  // Only track if it's not a forwarded message with URL (containing ://)
  if (!msg.text.includes('://')) {
    trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
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
    try {
      const dbCreds = await getAllCredentials();

      // Sort by country
      dbCreds.sort((a, b) => a.country.localeCompare(b.country));

      const allCreds = [];

      // Add database credentials with username (compact format)
      for (const cred of dbCreds) {
        const sfgoOnly = cred.sfgo.split('|')[0].replace('-dev-gd', '');
        // Use || as separator (double pipe) - won't conflict with | in usernames
        // Format: Country || Username || SFGO
        allCreds.push(`🌐 ${cred.country.toUpperCase()} || ${cred.username} || ${sfgoOnly}`);
      }

      if (allCreds.length > 0) {
        response = `🔐 All Regional Credentials\n\n` +
          allCreds.join('\n') +
          `\n\nType "/dev XXXX" or "/dev sfgoXXXX" for password.\nType "/dev add country / username / password / sfgo" to add.`;
        useMarkdown = false; // Don't use Markdown to avoid parsing errors
      } else {
        response = `❌ No credentials found!\n\nUse /dev add COUNTRY / username / password / sfgoXXXX to add`;
        useMarkdown = false;
      }
    } catch (err) {
      console.error('Error getting credentials:', err);
      response = `❌ *Database error!*\n\nCould not retrieve credentials. Please check logs.`;
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
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
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
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }

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

    // Helper function to escape special markdown characters
    const escapeMarkdown = (text) => {
      if (!text) return text;
      // Escape @ symbol which Telegram interprets as username mentions
      // Also escape other special markdown characters when needed
      return text.replace(/@/g, '\\@');
    };

    // Build response
    let response = `📘 *${escapeMarkdown(keyword.name)}*\n\n`;

    // Add category
    if (keyword.category) {
      response += `*Category:* ${keyword.category}\n`;
    }

    // Add syntax
    if (keyword.syntax) {
      response += `*Syntax:* \`${escapeMarkdown(keyword.syntax)}\`\n\n`;
    }

    // Add description
    if (keyword.description) {
      response += `*Description:*\n${escapeMarkdown(keyword.description)}\n\n`;
    } else if (keyword.fullDescription) {
      const desc = keyword.fullDescription.substring(0, 300);
      response += `*Description:*\n${escapeMarkdown(desc)}${keyword.fullDescription.length > 300 ? '...' : ''}\n\n`;
    }

    // Add examples (limit to 2)
    if (keyword.examples && keyword.examples.length > 0) {
      response += `*Example Usage:*\n`;
      const examplesLimit = Math.min(2, keyword.examples.length);
      for (let i = 0; i < examplesLimit; i++) {
        const ex = keyword.examples[i];
        response += `\n${i + 1}. *${escapeMarkdown(ex.title)}*\n`;
        if (ex.formula) {
          response += `   Formula: \`${escapeMarkdown(ex.formula)}\`\n`;
        }
        if (ex.description) {
          response += `   ${escapeMarkdown(ex.description)}\n`;
        }
      }
    }

    // Add aliases
    if (keyword.aliases && keyword.aliases.length > 0) {
      response += `\n*Aliases:* ${escapeMarkdown(keyword.aliases.join(', '))}`;
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
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
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
// Auto-detect "/sfgo" followed by numbers (e.g., "/sfgo11199" or "/sfgo11199 qa")
bot.onText(/^\/sfgo(\d+)(?:\s+(qa))?$/i, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
  try {
    const number = match[1];
    const isQa = match[2]; // Will be "qa" if present, undefined otherwise

    let result;
    if (isQa) {
      // QA environment URL
      result = `sfgo${number}-gd|https://payroll.greatdayhr.com/payrollqa4`;
    } else {
      // Dev environment URL (default)
      result = `sfgo${number}-dev-gd|http://localhost:3001`;
    }

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
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
  const userId = msg.from.id.toString();
  const input = match[1];

  try {
    // SUBCOMMAND: login - Show web login instructions
    if (input === 'login') {
      return bot.sendMessage(msg.chat.id,
        `🔐 <b>Web Login Instructions</b>\n\n` +
        `To click ticket links and have them open automatically in Chrome:\n\n` +
        `<b>Step 1: Set Chrome as Default Browser (Windows)</b>\n` +
        `   1. Open Windows Settings (Win + I)\n` +
        `   2. Go to "Apps" → "Default apps"\n` +
        `   3. Find "Web browser" and click on it\n` +
        `   4. Select "Google Chrome" from the list\n` +
        `   ✅ All links will now open in Chrome!\n\n` +
        `<b>Step 2: Login to Web Interfaces</b>\n` +
        `   • SF7D Office: <a href="https://sf7doffice.dataon.com">sf7doffice.dataon.com</a>\n` +
        `   • SF Support: <a href="https://sfsupport.dataon.com">sfsupport.dataon.com</a>\n` +
        `   Keep Chrome open to stay logged in\n\n` +
        `<b>Step 3: Test It!</b>\n` +
        `   Use <code>/ticket</code> or <code>/ticket me</code> to see tickets\n` +
        `   Click any ticket ID → Opens in Chrome (already logged in!)\n\n` +
        `💡 <i>Do this once and you're set! No Bearer tokens needed for viewing tickets.</i>`,
        { parse_mode: 'HTML', disable_web_page_preview: true }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

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

            // Debug: Log ticket object to see available fields
            if (totalTickets === 0) {
              console.log('Sample ticket object:', JSON.stringify(ticket, null, 2));
            }

            userTickets.get(userName).tickets.push({
              documentNo: ticket.documentNo || 'N/A',
              subject: ticket.subject || 'Unknown Task',
              status: ticket.status || 'Unknown',
              taskType: ticket.task_type || 'Unknown',
              link: ticket.link || ticket.url || ticket.ticket_link || ticket.ticket_url || null
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
            const ticketId = ticket.documentNo.padEnd(20);
            const title = (ticket.subject.length > 42 ? ticket.subject.substring(0, 39) + '...' : ticket.subject).padEnd(43);
            const type = ticket.taskType.padEnd(18);
            const status = ticket.status;

            responseText += `${ticketId} | ${title} | ${type} | ${status}\n`;
          }

          responseText += `</pre>\n`;

          // Add clickable links below the table
          responseText += `<b>Quick Links:</b>\n`;
          for (const ticket of userData.tickets) {
            if (ticket.link && ticket.link.trim() !== '') {
              responseText += `  • <a href="${ticket.link}">${ticket.documentNo}</a>\n`;
            }
          }
          responseText += `\n`;
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
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
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

// ==================== ERROR LOG COMMAND ====================
bot.onText(/^\/errorlog(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
  try {
    const subCommand = match[1] ? match[1].trim() : null;

    // /errorlog clear - Delete all error logs
    if (subCommand && subCommand.toLowerCase() === 'clear') {
      const result = await deleteAllErrorLogs();
      if (result.success) {
        return bot.sendMessage(msg.chat.id,
          `✅ <b>Deleted ${result.count} error logs</b>`,
          { parse_mode: 'HTML' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      } else {
        return bot.sendMessage(msg.chat.id,
          `❌ <b>Error deleting logs:</b> ${result.error}`,
          { parse_mode: 'HTML' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }
    }

    // /errorlog download YYYY-MM-DD - Download logs from specific date as TXT file
    if (subCommand && subCommand.toLowerCase().startsWith('download')) {
      const dateMatch = subCommand.match(/download\s+(\d{4}-\d{2}-\d{2})/i);

      if (!dateMatch) {
        return bot.sendMessage(msg.chat.id,
          `❌ <b>Invalid format</b>\n\nUsage: <code>/errorlog download 2026-02-06</code>`,
          { parse_mode: 'HTML' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      const targetDate = dateMatch[1];
      const logs = await getErrorLogsByDate(targetDate);

      if (logs.length === 0) {
        return bot.sendMessage(msg.chat.id,
          `📋 <b>No error logs found for ${targetDate}</b>`,
          { parse_mode: 'HTML' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      // Generate TXT file content
      const fs = require('fs');
      const path = require('path');
      let txtContent = `Error Logs for ${targetDate}\n`;
      txtContent += `Total: ${logs.length} log(s)\n`;
      txtContent += `Generated: ${toJakartaDate(new Date(), true)}\n`;
      txtContent += `${'='.repeat(80)}\n\n`;

      for (const log of logs) {
        const date = toJakartaDate(log.created_date, true);

        txtContent += `ID: ${log.id}\n`;
        txtContent += `Date: ${date}\n`;
        if (log.type_data) {
          txtContent += `Type: ${log.type_data}\n`;
        }
        txtContent += `Status Reminder: ${log.status_reminder || 'NULL'}\n`;
        txtContent += `Data:\n${log.data}\n`;
        txtContent += `${'-'.repeat(80)}\n\n`;
      }

      // Save to temp file
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `errorlogs_${targetDate}.txt`;
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, txtContent, 'utf8');

      // Send file to Telegram
      await bot.sendDocument(msg.chat.id, filePath, {
        caption: `📋 Error logs for ${targetDate} (${logs.length} log(s))`
      });

      // Delete temp file
      fs.unlinkSync(filePath);

      return;
    }

    // /errorlog or /errorlog show - Show all error logs
    if (!subCommand || subCommand.toLowerCase() === 'show') {
      const logs = await getAllErrorLogs();

      if (logs.length === 0) {
        return bot.sendMessage(msg.chat.id,
          `📋 <b>Error Logs</b>\n\n<i>No error logs found.</i>`,
          { parse_mode: 'HTML' }
        )
          .then(m => trackMessage(m.chat.id, m.message_id))
          .catch(err => console.error("Error:", err));
      }

      // Show latest 5 logs
      const displayLogs = logs.slice(0, 5);
      let message = `📋 <b>Error Logs</b> (${logs.length} total, showing latest 5)\n\n`;

      for (const log of displayLogs) {
        const date = toJakartaDate(log.created_date);

        // Try to prettify JSON data and format nicely
        let dataPreview = log.data;
        try {
          const parsed = JSON.parse(log.data);
          // Strip large fields not useful for quick triage
          delete parsed.query;
          // Format with indentation, then split into lines
          const formatted = JSON.stringify(parsed, null, 2);
          const lines = formatted.split('\n');

          // Remove opening and closing braces, keep only content
          if (lines[0] === '{' && lines[lines.length - 1] === '}') {
            dataPreview = lines.slice(1, -1).join('\n').trim();
          } else {
            dataPreview = formatted;
          }
        } catch (e) {
          // Not JSON, use as-is
        }

        // Truncate short — 10 items in one message must stay under 4096 chars total
        if (dataPreview.length > 200) {
          dataPreview = dataPreview.substring(0, 200) + '...';
        }

        // Escape HTML special characters only
        dataPreview = dataPreview
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        message += `🔸 <b>ID:</b> <code>${log.id.substring(0, 8)}</code>\n`;
        message += `   📅 ${date}\n`;
        if (log.type_data) {
          message += `   🏷️ Type: ${log.type_data}\n`;
        }
        message += `   📝 ${dataPreview}\n\n`;
      }

      if (logs.length > 10) {
        message += `\n<i>💡 Commands:</i>\n`;
        message += `<code>/errorlog &lt;id&gt;</code> - View full log\n`;
        message += `<code>/errorlog clear</code> - Delete all logs`;
      }

      // Mark the displayed 10 logs as reminded
      const displayedIds = displayLogs
        .filter(log => !log.status_reminder || log.status_reminder !== 'Y')
        .map(log => log.id);

      if (displayedIds.length > 0) {
        await markErrorLogsAsReminded(displayedIds);
        message += `\n\n<i>✅ Marked ${displayedIds.length} log(s) as reminded</i>`;
      }

      return bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' })
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // /errorlog <id> - Show specific log by ID (accepts partial ID)
    const logId = subCommand;
    const logs = await getAllErrorLogs();
    const log = logs.find(l => l.id.startsWith(logId)) || await getErrorLogById(logId);

    if (!log) {
      return bot.sendMessage(msg.chat.id,
        `❌ <b>Error log not found</b>\n\n<i>ID: ${logId}</i>`,
        { parse_mode: 'HTML' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    const date = toJakartaDate(log.created_date, true);

    // Try to prettify JSON data
    let displayData = log.data;
    try {
      const parsed = JSON.parse(log.data);
      displayData = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Not JSON, use as-is
    }

    // Escape HTML special characters in data
    const escapedData = displayData
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    let message = `📋 <b>Error Log Details</b>\n\n`;
    message += `🔸 <b>ID:</b> <code>${log.id}</code>\n`;
    message += `📅 <b>Date:</b> ${date}\n`;
    if (log.type_data) {
      message += `🏷️ <b>Type:</b> ${log.type_data}\n`;
    }
    message += `\n📝 <b>Data:</b>\n<pre>${escapedData}</pre>`;

    // Mark as reminded when viewed
    if (!log.status_reminder || log.status_reminder !== 'Y') {
      await markErrorLogsAsReminded([log.id]);
      message += `\n\n<i>✅ Marked as reminded</i>`;
    }

    return bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' })
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(err => console.error("Error:", err));

  } catch (err) {
    console.error("Error in /errorlog command:", err);
    bot.sendMessage(msg.chat.id, "❌ <b>Error!</b>\nSomething went wrong while fetching error logs.", { parse_mode: 'HTML' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});

// ==================== LUNCH MENU COMMAND ====================
bot.onText(/^\/lunch$/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
  try {
    // Check if today is a holiday
    const holiday = getTodayHoliday();
    if (holiday) {
      return bot.sendMessage(msg.chat.id,
        `🗓️ *Today is ${holiday.name}*\n\n_No lunch menu available on holidays._`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    const fs = require('fs');
    const path = require('path');

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Load lunch menu data
    const menuFilePath = path.join(__dirname, 'data', 'lunch-menu.json');

    if (!fs.existsSync(menuFilePath)) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Menu file not found!*\n\nThe lunch menu data is not available.",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    const menuData = JSON.parse(fs.readFileSync(menuFilePath, 'utf8'));

    // Extract year and month from todayStr (YYYY-MM-DD)
    const [year, month] = todayStr.split('-');

    // Navigate to the menu: menuData[year][month].schedule[date]
    if (!menuData[year] || !menuData[year][month] || !menuData[year][month].schedule) {
      return bot.sendMessage(msg.chat.id,
        `❌ *No menu available*\n\n_No lunch menu data for ${year}-${month}._`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    const menu = menuData[year][month].schedule[todayStr];

    if (!menu) {
      return bot.sendMessage(msg.chat.id,
        `❌ *No menu available today*\n\n_No lunch menu scheduled for ${todayStr}._`,
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // Format the menu message (same as notification)
    let message = `🍽️ *${menu.day}*\n\n`;

    for (const item of Object.values(menu.meals)) {
      message += `• ${item}\n`;
    }

    message += `\n_Selamat makan! 😋_`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' })
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(err => console.error("Error:", err));

  } catch (err) {
    console.error("Error in /lunch command:", err);
    bot.sendMessage(msg.chat.id, "❌ *Error!*\nSomething went wrong while fetching lunch menu.", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});

// ==================== HOLIDAY COMMAND ====================
bot.onText(/^\/holiday$/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
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

// ==================== BASE64 DECODE COMMAND ====================
bot.onText(/^\/de64(?:\s+(.+))?$/, async (msg, match) => {
  trackCommand(msg.chat.id, msg.message_id);
  if (msg.message_thread_id !== BOT_TOPIC_ID) {
    return bot.sendMessage(msg.chat.id, '⚠️ Please use the <b>PayrollBot</b> topic to interact with this bot.', { parse_mode: 'HTML', message_thread_id: BOT_TOPIC_ID });
  }
  try {
    const base64String = match[1];

    if (!base64String) {
      return bot.sendMessage(msg.chat.id,
        "❌ *Format salah!*\n\n*Usage:*\n`/de64 <base64_string>`\n\n*Example:*\n`/de64 W3siREJFTkdJTkUiOi...`\n\n*Description:*\nDecodes base64 string and shows only _fin and _admin database credentials.",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error sending de64 help:", err));
    }

    // Send processing message
    bot.sendMessage(msg.chat.id, "⏳ *Processing...*\nDecoding base64 string...", { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending processing message:", err));

    // Decode base64
    const decodedString = Buffer.from(base64String.trim(), 'base64').toString('utf-8');

    // Parse JSON
    const jsonData = JSON.parse(decodedString);

    // Filter to only show entries with _fin or _admin in USR field
    const allMatches = jsonData.filter(item =>
      item.USR && (item.USR.includes('_fin') || item.USR.includes('_admin'))
    );

    // Deduplicate: Keep only 1 unique credential per type (admin, fin)
    const filtered = [];
    let hasAdmin = false;
    let hasFin = false;

    for (const item of allMatches) {
      if (item.USR.includes('_admin') && !hasAdmin) {
        filtered.push(item);
        hasAdmin = true;
      } else if (item.USR.includes('_fin') && !hasFin) {
        filtered.push(item);
        hasFin = true;
      }

      // Stop once we have both
      if (hasAdmin && hasFin) break;
    }

    if (filtered.length === 0) {
      return bot.sendMessage(msg.chat.id,
        "⚠️ *No results found!*\n\nNo database credentials with _fin or _admin were found in the decoded data.",
        { parse_mode: 'Markdown' }
      )
        .then(m => trackMessage(m.chat.id, m.message_id))
        .catch(err => console.error("Error:", err));
    }

    // Pretty print the result
    const prettyJson = JSON.stringify(filtered, null, 4);

    // Send the result (use code block for formatting)
    const resultMessage = `✅ *Decoded & Filtered (${filtered.length} credentials)*\n\n\`\`\`json\n${prettyJson}\n\`\`\``;

    bot.sendMessage(msg.chat.id, resultMessage, { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending de64 result:", err));

  } catch (err) {
    console.error("Error in /de64 command:", err);

    let errorMsg = "❌ *Error!*\n\n";
    if (err instanceof SyntaxError) {
      errorMsg += "Invalid JSON format in decoded string.\n\nMake sure the base64 string contains valid JSON data.";
    } else if (err.message && err.message.includes('Invalid')) {
      errorMsg += "Invalid base64 string.\n\nMake sure you provided a valid base64-encoded string.";
    } else {
      errorMsg += "Something went wrong while processing your request.\n\n" + err.message;
    }

    bot.sendMessage(msg.chat.id, errorMsg, { parse_mode: 'Markdown' })
      .then(msg => trackMessage(msg.chat.id, msg.message_id))
      .catch(err => console.error("Error sending error message:", err));
  }
});
