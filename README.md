# 🦇 BotBatman - Telegram Bot

**Last Updated:** February 04, 2026
**Version:** 1.0.0
**Node.js:** >=18.x

---

## ⚠️ IMPORTANT - Documentation Policy

**This README is the source of truth for the entire project.**

### Documentation Rules:
1. ✅ **Every feature MUST be documented here**
   - If a feature exists in code, it MUST be in this README
   - Include command syntax, examples, and behavior

2. ❌ **If a feature is removed from code, remove it from README**
   - Keep documentation in sync with actual code
   - No orphaned documentation for removed features

3. 📝 **Current Work Section**
   - See [Current Work in Progress](#current-work-in-progress) section below
   - Updated after every session
   - Helps AI resume context when switching chats

4. 🔄 **Update on Every Change**
   - Feature added? → Document it
   - Feature removed? → Remove docs
   - Feature modified? → Update docs

---

## 📋 Table of Contents
1. [Current Work in Progress](#current-work-in-progress)
2. [Overview](#overview)
3. [Features](#features)
4. [Architecture](#architecture)
5. [Installation & Setup](#installation--setup)
6. [Commands Reference](#commands-reference)
7. [Scheduled Jobs](#scheduled-jobs)
8. [Data Files](#data-files)
9. [Services](#services)
10. [Configuration](#configuration)
11. [Development](#development)
12. [Current Status](#current-status)

---

## 🚧 Current Work in Progress

> **📌 AI Context Section:** When starting a new chat session, read this section first to understand where we left off. Update this section after every work session.

**Last Session:** February 04, 2026 10:40 AM

### What Was Just Completed:
1. ✅ Created lunch menu notification system (10:40 AM daily)
2. ✅ Changed from multiple JSON files to single unified `lunch-menu.json`
3. ✅ Added holiday check for lunch notifications
4. ✅ Created `/lunch` command to view today's menu
5. ✅ Made `/dev` credentials display compact (single line per credential)
6. ✅ Added `/sfgo` QA environment support (`/sfgo[number] qa`)
7. ✅ Completed comprehensive documentation for entire project

### Next Steps (Pending):
1. ⏳ **Investigate ticket link field from API**
   - Quick Links section currently shows ticket IDs
   - Need to verify if API returns `link` field
   - May need to check for alternative field names (`url`, `ticket_link`, etc.)
   - Added debug logging to check API response structure

2. ⏳ **Add March 2026 lunch menu**
   - Edit `data/lunch-menu.json`
   - Add new month object under `"2026"` → `"03"`
   - Follow same structure as February

3. ⏳ **Test lunch notification**
   - Wait for 10:40 AM to verify notification works
   - Or manually test `/lunch` command

### Active Issues:
- **Ticket Links:** API may not be returning `link` field consistently
  - Workaround: Users can use `/ticket login` to set up browser integration
  - Debug logging added to investigate API response

### Context for Next Session:
- Bot is running and fully functional
- All scheduled jobs configured (8:05 AM, 10:40 AM, 4:45 PM)
- Lunch menu uses unified file: `data/lunch-menu.json`
- Structure: `Year → Month → Schedule → Date`
- No code changes needed to add new months, just edit JSON

---

---

## 🎯 Overview

BotBatman is a comprehensive Telegram bot designed for internal team productivity. It manages daily work activities, credentials, tickets, formulas, lunch menus, and provides automated reminders.

**Key Capabilities:**
- 🔔 Automated scheduled reminders (morning, afternoon, lunch)
- 🔐 Encrypted credential management with PostgreSQL
- 🎫 Ticket management with browser integration
- 📊 Excel formula parser for database queries
- 🍽️ Daily lunch menu notifications
- 🗓️ Indonesian holiday awareness
- 🧹 Smart message cleanup

---

## 🚀 Features

### 1. Scheduled Reminders

#### Morning Reminder (8:05 AM, Mon-Fri)
- Sends motivational message to start the day
- **Monday Special:** Includes ticket reminder
- Automatically skips on public holidays

**Message Format:**
```
☀️ Good morning! Time to show the world what you're made of.
Remember to check your tickets and plan your day!
```

#### Afternoon Reminder (4:45 PM, Mon-Fri)
- Timesheet reminder before end of day
- Warns about upcoming holidays
- Automatically skips on public holidays

**Message Format:**
```
😂 Siap-siap pulang! Inget isi timesheet sebelum lupa diri sendiri.

⚠️ Besok libur: [Holiday Name]
Biarkan repo damai.
```

#### Lunch Menu Notification (10:40 AM, Mon-Fri) ✅
- Auto-sends daily lunch menu
- Holiday-aware (skips automatically)
- Silent if no menu exists for the day
- Uses unified menu file structure

**Message Format:**
```
🍽️ Tuesday, 03 Februari 2026

• Nasi: Nasi
• Pagi: Chicken Sweet Sour
• Lauk 1: Tahu Goreng tepung
• Lauk 2: salad sayuran
• Sayur: Risol
• Sambal: Sambal
• Buah: Buah

Selamat makan! 😋
```

---

### 2. Credential Management (`/dev`)

PostgreSQL-backed credential storage with encryption support.

#### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/dev` | List all credentials (compact) | `/dev` |
| `/dev [country]` | Show country credentials | `/dev MY` |
| `/dev [sfgoXXXX]` | Show SFGO credentials | `/dev sfgo8879` |
| `/dev [XXXX]` | Show SFGO by number only | `/dev 8879` |
| `/dev add` | Add/update credential | `/dev add MY / champion / pass123 / sfgo8879` |
| `/dev delete` | Delete credential | `/dev delete sfgo8879` |

#### Features
- **Auto-URL Generation:** `sfgoXXXX-dev-gd|http://localhost:3001`
- **Compact Display Format:** `🌐 Country | Username | SFGO`
- **CRUD Operations:** Full create, read, update, delete support
- **Flexible Input:** Works with/without "sfgo" prefix
- **Update Support:** Adding existing SFGO updates the record

#### Display Format

**List View:**
```
🔐 All Regional Credentials

🌐 ID | sfgo11095|16660 | sfgo11095
🌐 ID | sfgo11601 | sfgo11601
🌐 MY | champion | sfgo8879
🌐 PH | gdphone@mailinator.com | sfgo6160

Type "/dev XXXX" or "/dev sfgoXXXX" for password.
Type "/dev add country / username / password / sfgo" to add.
```

**Detail View:**
```
🔐 Dev Credential (MY)

🌐 MY
Username: champion
Password: pass1234
SFGO: sfgo8879
URL: sfgo8879-dev-gd|http://localhost:3001
```

---

### 3. Password Reset (`/reset`)

Quick credential formatter for password resets.

#### Command
```
/reset [username] [password]
```

#### Output Format
```
Username | Password | 2
```

**Example:**
```
Input:  /reset john.doe pass123
Output: john.doe | pass123 | 2
```

---

### 4. Region Info (`/reg`)

Get region information for supported countries.

#### Command
```
/reg [country_code]
```

#### Supported Regions
- **ID** - Indonesia
- **MY** - Malaysia
- **PH** - Philippines
- **SG** - Singapore
- **TH** - Thailand
- **VN** - Vietnam

**Example Output:**
```
🌏 Region: Malaysia (MY)
📍 Capital: Kuala Lumpur
💱 Currency: MYR (Ringgit)
🕐 Timezone: UTC+8
```

---

### 5. Formula Parser (`/formula`)

Convert Excel formulas to PostgreSQL JSON query format.

#### How It Works
1. Type `/formula` to enter parsing mode
2. Paste your Excel formula
3. Bot detects nested brackets and converts to COALESCE format
4. Auto-cleanup after 1 minute

#### Features
- **Nested Bracket Detection:** `[Gross Salary]`, `[[Overtime Hours]]`
- **Complex Formula Support:** Handles IF, SUM, nested functions
- **Context-Aware:** Remembers you're in formula mode
- **Auto-Cleanup:** Clears state after 1 minute of inactivity

#### Examples

**Input:**
```
[Gross Salary] + [Overtime Pay]
```

**Output:**
```
COALESCE(payrollSalary->>grossSalary, '0') + COALESCE(payrollSalary->>overtimePay, '0')
```

**Input:**
```
IF([Status]="Active", [Basic Pay], 0)
```

**Output:**
```
IF(COALESCE(payrollSalary->>status, '0')="Active", COALESCE(payrollSalary->>basicPay, '0'), 0)
```

---

### 6. Ticket Management (`/ticket`) ✅

Comprehensive ticket viewing and response system with browser integration.

#### Commands

| Command | Description | Access |
|---------|-------------|--------|
| `/ticket` | Show all team tickets | All chats |
| `/ticket me` | Show only your tickets | All chats |
| `/ticket login` | Browser setup instructions | All chats |
| `/ticket res [ID] [token]` | Respond with Bearer token | Private only |
| `/ticket res [ID]` | Respond with stored token | Private only |
| `/ticket logout` | Clear stored token | Private only |

#### Features
- **Table Format Display:** Clean, organized ticket table
- **Quick Links:** Clickable ticket IDs that open in browser
- **Token Storage:** Bearer tokens cached for 5 minutes
- **Security:** Response commands only work in private chat
- **Holiday-Aware:** Respects Indonesian public holidays
- **Browser Integration:** Links open directly in default browser

#### Display Format

```
📋 Today's Tickets (2026-02-04)

1. Andhikaputra Dimas Wicaksana - 3 tickets

Ticket ID            | Title                                      | Type              | Status
---------------------|--------------------------------------------|--------------------|--------
HDTKT-2601-00021074  | [sfgo11601] - Memunculkan Debt Date pad... | Support           | Responded
HDTKT-2602-00022566  | [Payrollv2] BE - BNI & Mandiri Bank Fil... | Inventory of Work | Open
HDTKT-2602-00022579  | [Payrollv2] BE - UOB Filename BankFile     | Inventory of Work | Open

Quick Links:
  • HDTKT-2601-00021074
  • HDTKT-2602-00022566
  • HDTKT-2602-00022579

Total: 9 ticket(s) | 1 user(s)
```

#### Response Workflow

**Step 1: Get Bearer Token**
```
1. Open SF7D Office in browser
2. Login to your account
3. Open Developer Tools (F12)
4. Go to Network tab
5. Find any API request
6. Copy Bearer token from Authorization header
```

**Step 2: Respond to Ticket**
```
/ticket res HDTKT-2601-00020563 Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

**Step 3: Subsequent Responses (same session)**
```
/ticket res HDTKT-2601-00020564
(Uses stored token automatically)
```

**Token Auto-Expiry:** 5 minutes after last use

---

### 7. Lunch Menu (`/lunch`) ✅

Daily lunch menu notifications with unified menu management.

#### Command
```
/lunch
```

#### Features
- **Auto-Notification:** Daily at 10:40 AM (Mon-Fri)
- **Holiday Check:** Automatically skips holidays
- **Silent Mode:** No notification if menu doesn't exist
- **Single File:** Unified `lunch-menu.json` for all months
- **Easy Updates:** Just edit JSON to add new months

#### Menu File Structure

```json
{
  "2026": {
    "02": {
      "month_name": "February 2026",
      "schedule": {
        "2026-02-02": {
          "day": "Monday, 02 Februari 2026",
          "meals": {
            "Nasi": "Nasi",
            "Pagi": "Ikan Kembung sambal dhabu dhabu",
            "Lauk 1": "tempe goreng tepung",
            "Lauk 2": "lalapan",
            "Sayur": "tumis bayam",
            "Sambal": "Sambal",
            "Buah": "Buah"
          }
        }
      }
    },
    "03": {
      "month_name": "March 2026",
      "schedule": {
        "2026-03-02": {
          "day": "Monday, 02 March 2026",
          "meals": { ... }
        }
      }
    }
  }
}
```

#### Adding New Months

Simply add a new month object under the year in `data/lunch-menu.json`:

```json
{
  "2026": {
    "02": { ... },
    "03": {
      "month_name": "March 2026",
      "schedule": {
        "2026-03-02": { ... }
      }
    }
  }
}
```

No code changes needed!

---

### 8. Holiday Info (`/holiday`)

Check Indonesian public holiday information.

#### Command
```
/holiday
```

#### Features
- Shows today's holiday status
- Shows tomorrow's holiday (if applicable)
- Lists 5 upcoming holidays
- Formatted in Indonesian date format

#### Output Format
```
🗓️ Indonesian Public Holidays

📍 Today: Not a holiday

⚠️ Tomorrow: Tahun Baru Imlek 2577
17 Februari 2026

Upcoming Holidays:
1. Tahun Baru Imlek 2577
   17 Februari 2026
2. Hari Suci Nyepi (Tahun Baru Saka 1948)
   19 Maret 2026
...
```

---

### 9. SFGO Formatter (`/sfgo`) ✅

Quick SFGO URL formatter for dev and QA environments.

#### Commands

| Command | Output | Environment |
|---------|--------|-------------|
| `/sfgo[number]` | `sfgoXXXX-dev-gd\|http://localhost:3001` | Development |
| `/sfgo[number] qa` | `sfgoXXXX-gd\|https://payroll.greatdayhr.com/payrollqa4` | QA |

#### Examples

```
Input:  /sfgo11199
Output: sfgo11199-dev-gd|http://localhost:3001

Input:  /sfgo11199 qa
Output: sfgo11199-gd|https://payroll.greatdayhr.com/payrollqa4
```

---

### 10. Base64 Decoder (`/de64`)

Decode and filter database credentials from base64-encoded JSON.

#### Command
```
/de64 [base64_string]
```

#### Features
- Decodes base64 to JSON
- Filters `_fin` and `_admin` credentials only
- Returns prettified JSON
- Handles complex nested structures

#### Example

**Input:**
```
/de64 W3siREJFTkdJTkUiOiJwb3N0Z3Jlc3FsIiwiREI...
```

**Output:**
```json
[
  {
    "DBENGINE": "postgresql",
    "DBNAME": "payroll_fin",
    "DBUSER": "admin_user",
    "DBPASSWORD": "encrypted_pass"
  }
]
```

---

### 11. Message Cleanup (`/clear`)

Delete all bot messages in the current chat.

#### Command
```
/clear
```

#### Features
- Automatic message tracking
- Deletes only bot-sent messages
- Preserves user messages
- Works in all chat types

**Use Case:** Clean up the chat after testing or when too many bot messages accumulate.

---

## 🏗️ Architecture

### Project Structure

```
botbatman/
├── index.js                      # Main bot application
├── package.json                  # Dependencies & scripts
├── .env                          # Environment variables (not committed)
├── README.md                     # This documentation
│
├── data/                         # Data files
│   └── lunch-menu.json          # Unified lunch menu (all months)
│
└── services/                     # Service modules
    ├── database.js              # PostgreSQL connection & queries
    ├── formulaParser.js         # Excel formula parser logic
    ├── indonesianHolidays.js    # Holiday data & helpers
    └── passwordEncryption.js    # Encryption utilities
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ | JavaScript runtime |
| Bot Framework | node-telegram-bot-api | Telegram Bot API wrapper |
| Database | PostgreSQL | Credential storage |
| Scheduler | node-cron | Scheduled reminders |
| Formula Parser | hot-formula-parser | Excel formula parsing |
| Web Server | Express | Health check endpoint |
| Environment | dotenv | Configuration management |

---

## 📦 Installation & Setup

### Prerequisites
- Node.js >= 18.x
- PostgreSQL database (optional, for `/dev` commands)
- Telegram Bot Token

### Step 1: Clone & Install

```bash
cd d:\Projects\botbatman
npm install
```

### Step 2: Environment Configuration

Create `.env` file:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
CHAT_ID=your_default_chat_id

# Database Configuration (optional)
DATABASE_URL=postgresql://user:password@host:5432/database

# Optional Settings
NODE_ENV=production
PORT=8080
```

### Step 3: Database Setup (Optional)

If using credential management features:

```sql
CREATE TABLE dev_credentials (
  id SERIAL PRIMARY KEY,
  sfgo VARCHAR(255) UNIQUE NOT NULL,
  country VARCHAR(50),
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The bot auto-creates this table on startup if it doesn't exist.

### Step 4: Start the Bot

```bash
npm start
# or
node index.js
```

**Expected Output:**
```
Telegram bot is starting...
Health check server is listening on port 8080
Database table initialized successfully
Starting polling after delay...
```

---

## 📖 Commands Reference

### Quick Reference Table

| Command | Description | Access | Example |
|---------|-------------|--------|---------|
| `/help` | Show all commands | All | `/help` |
| `/dev` | Manage credentials | All | `/dev MY` |
| `/reset` | Format password reset | All | `/reset user pass` |
| `/reg` | Region info | All | `/reg MY` |
| `/formula` | Parse Excel formulas | All | `/formula` |
| `/ticket` | View/respond tickets | All/Private | `/ticket me` |
| `/lunch` | Today's lunch menu | All | `/lunch` |
| `/holiday` | Holiday information | All | `/holiday` |
| `/sfgo` | SFGO formatter | All | `/sfgo11199 qa` |
| `/de64` | Decode base64 | All | `/de64 W3si...` |
| `/clear` | Delete bot messages | All | `/clear` |

---

## ⏰ Scheduled Jobs

All scheduled jobs use **Asia/Jakarta (GMT+7)** timezone.

### Schedule Overview

| Time | Day | Job | Description |
|------|-----|-----|-------------|
| 08:05 AM | Mon-Fri | Morning Reminder | Start of day message + Monday ticket reminder |
| 10:40 AM | Mon-Fri | Lunch Menu | Daily lunch menu notification |
| 04:45 PM | Mon-Fri | Afternoon Reminder | Timesheet reminder + tomorrow holiday warning |

### Cron Expressions

```javascript
// Morning Reminder: 8:05 AM (Mon-Fri)
cron.schedule('5 8 * * 1-5', () => { ... }, { timezone: 'Asia/Jakarta' });

// Lunch Menu: 10:40 AM (Mon-Fri)
cron.schedule('40 10 * * 1-5', () => { ... }, { timezone: 'Asia/Jakarta' });

// Afternoon Reminder: 4:45 PM (Mon-Fri)
cron.schedule('45 16 * * 1-5', () => { ... }, { timezone: 'Asia/Jakarta' });
```

### Holiday Awareness

All scheduled jobs automatically check for Indonesian public holidays:

```javascript
const holiday = getTodayHoliday();
if (holiday) {
  console.log(`Skipping reminder - Today is ${holiday.name}`);
  return;
}
```

---

## 📄 Data Files

### 1. Lunch Menu (`data/lunch-menu.json`)

**Purpose:** Store lunch menu schedules for all months

**Structure:**
```json
{
  "YEAR": {
    "MONTH": {
      "month_name": "Month YYYY",
      "schedule": {
        "YYYY-MM-DD": {
          "day": "Day, DD Month YYYY",
          "meals": {
            "Category": "Item"
          }
        }
      }
    }
  }
}
```

**Location:** `d:\Projects\botbatman\data\lunch-menu.json`

**Update Instructions:**
1. Open `data/lunch-menu.json`
2. Add new month under the year
3. Add menu entries with dates as keys
4. No code changes needed

---

## 🛠️ Services

### 1. Database Service (`services/database.js`)

**Purpose:** PostgreSQL connection and credential CRUD operations

**Functions:**
- `initDatabase()` - Create credentials table
- `addCredential(sfgo, country, username, password, url)` - Add/update credential
- `getCredentialBySfgo(sfgo)` - Get credential by SFGO
- `getCredential(country)` - Get credential by country
- `getAllCredentials()` - Get all credentials
- `deleteCredential(sfgo)` - Delete credential

**Database Schema:**
```sql
CREATE TABLE dev_credentials (
  id SERIAL PRIMARY KEY,
  sfgo VARCHAR(255) UNIQUE NOT NULL,
  country VARCHAR(50),
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. Indonesian Holidays Service (`services/indonesianHolidays.js`)

**Purpose:** Manage Indonesian public holiday data and date utilities

**Functions:**
- `isHoliday(date)` - Check if date is a holiday
- `getTodayHoliday()` - Get today's holiday
- `getTomorrowHoliday()` - Get tomorrow's holiday
- `getHolidaysForYear(year)` - Get all holidays for a year
- `getUpcomingHolidays(count)` - Get next N holidays
- `formatDateIndonesian(dateStr)` - Format date in Indonesian

**Holiday Data (2026):**
- New Year (Jan 1)
- Isra Mi'raj (Jan 16)
- Chinese New Year (Feb 17)
- Nyepi (Mar 19)
- Eid al-Fitr (Mar 21-22)
- Good Friday (Apr 3)
- Labor Day (May 1)
- Ascension Day (May 15)
- Eid al-Adha (May 28)
- Pancasila Day (Jun 1)
- Islamic New Year (Jun 18)
- Independence Day (Aug 17)
- Mawlid (Aug 27)
- Christmas (Dec 24)

---

### 3. Formula Parser Service (`services/formulaParser.js`)

**Purpose:** Parse Excel formulas to PostgreSQL JSONB query format

**Features:**
- Detects square bracket patterns: `[Field]`, `[[Nested]]`
- Converts to COALESCE format: `COALESCE(payrollSalary->>field, '0')`
- Handles nested formulas
- Preserves Excel functions (IF, SUM, etc.)

**Example Transformation:**
```javascript
Input:  "[Gross Salary] + [Allowance]"
Output: "COALESCE(payrollSalary->>grossSalary, '0') + COALESCE(payrollSalary->>allowance, '0')"
```

---

### 4. Password Encryption Service (`services/passwordEncryption.js`)

**Purpose:** Encrypt/decrypt sensitive credentials

**Functions:**
- `encryptPassword(password)` - Encrypt plaintext password
- `decryptPassword(encryptedPassword)` - Decrypt encrypted password

**Note:** Currently used for future encryption features. Basic storage uses PostgreSQL's built-in security.

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Telegram bot token from @BotFather |
| `CHAT_ID` | Yes | - | Default chat ID for notifications |
| `DATABASE_URL` | No | - | PostgreSQL connection string |
| `PORT` | No | 8080 | Health check server port |
| `NODE_ENV` | No | development | Environment mode |

### Timezone Configuration

```javascript
const timezone = "Asia/Jakarta"; // GMT+7
```

All scheduled jobs use this timezone.

### Bot Configuration

```javascript
// Bot initialization
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
  polling_retry_count: 3,
  polling_retry_delay: 1000
});

// Health check server
const app = express();
app.get('/health', (req, res) => {
  res.status(200).send('Bot is running');
});
app.listen(process.env.PORT || 8080);
```

---

## 👨‍💻 Development

### Code Structure

**index.js** contains:
1. **Initialization** (lines 1-100)
   - Dependencies
   - Bot instance
   - Database connection
   - Express server

2. **Scheduled Jobs** (lines 300-420)
   - Morning reminder
   - Lunch menu notification
   - Afternoon reminder

3. **Command Handlers** (lines 420-1800)
   - `/help`, `/dev`, `/reset`, `/reg`
   - `/formula`, `/ticket`, `/lunch`
   - `/holiday`, `/sfgo`, `/de64`, `/clear`

4. **Message Listeners** (lines 1800+)
   - Formula parsing mode
   - Message tracking

### Adding New Commands

```javascript
// 1. Add command handler
bot.onText(/^\/newcommand$/, async (msg) => {
  trackCommand(msg.chat.id, msg.message_id);
  try {
    // Your command logic here
    bot.sendMessage(msg.chat.id, "Response", { parse_mode: 'Markdown' })
      .then(m => trackMessage(m.chat.id, m.message_id))
      .catch(err => console.error("Error:", err));
  } catch (err) {
    console.error("Error in /newcommand:", err);
  }
});

// 2. Add to help text
// Update the /help command with your new command
```

### Adding New Scheduled Jobs

```javascript
cron.schedule('*/30 * * * *', () => {
  // Runs every 30 minutes
  const holiday = getTodayHoliday();
  if (holiday) return; // Skip on holidays

  // Your job logic here
}, {
  scheduled: true,
  timezone: timezone
});
```

### Testing

```bash
# Test bot locally
node index.js

# Send test commands in Telegram
/help
/dev
/lunch
```

### Documentation Workflow

**IMPORTANT:** Follow this workflow for every code change:

1. **Adding a Feature:**
   ```
   Step 1: Write the code
   Step 2: Test the feature
   Step 3: Document it in README (Features section)
   Step 4: Update "Current Work in Progress" section
   Step 5: Commit changes (code + README together)
   ```

2. **Removing a Feature:**
   ```
   Step 1: Remove the code
   Step 2: Remove feature from README (Features section)
   Step 3: Remove from Commands Reference table
   Step 4: Update "Current Work in Progress" section
   Step 5: Commit changes (code + README together)
   ```

3. **Modifying a Feature:**
   ```
   Step 1: Modify the code
   Step 2: Test the changes
   Step 3: Update feature documentation in README
   Step 4: Update "Current Work in Progress" section
   Step 5: Commit changes (code + README together)
   ```

4. **End of Session:**
   ```
   Step 1: Update "What Was Just Completed" section
   Step 2: Update "Next Steps (Pending)" section
   Step 3: Update "Context for Next Session" section
   Step 4: Update "Last Session" timestamp
   ```

**Golden Rule:** Code and documentation must ALWAYS be in sync. No exceptions.

---

## 📊 Current Status

### ✅ Completed Features

- [x] **Core Bot Framework**
  - Telegram bot initialization
  - Polling and error handling
  - Health check endpoint
  - Message tracking system

- [x] **Scheduled Reminders**
  - Morning reminder (8:05 AM)
  - Afternoon reminder (4:45 PM)
  - Lunch menu notification (10:40 AM)
  - Holiday awareness for all reminders

- [x] **Credential Management**
  - PostgreSQL database integration
  - CRUD operations (add, view, delete)
  - Compact display format
  - Auto-URL generation

- [x] **Ticket Management**
  - Team ticket viewing
  - Personal ticket filtering (`/ticket me`)
  - Clickable Quick Links
  - Token-based response system
  - Browser setup instructions
  - 5-minute token auto-expiry

- [x] **Lunch Menu System**
  - Daily auto-notification (10:40 AM)
  - Unified JSON file structure
  - Holiday check integration
  - Silent mode (no notification if no menu)
  - Manual `/lunch` command

- [x] **Utility Commands**
  - Password reset formatter (`/reset`)
  - Region info (`/reg`)
  - Formula parser (`/formula`)
  - Holiday checker (`/holiday`)
  - SFGO formatter with QA support (`/sfgo`)
  - Base64 decoder (`/de64`)
  - Message cleanup (`/clear`)

### 🚧 Known Issues

1. **PostgreSQL Connection**
   - Error on startup if database not running
   - Expected behavior, doesn't affect other features
   - Only impacts `/dev` commands

2. **Ticket Links**
   - Quick Links section shows ticket IDs
   - API may not consistently return `link` field
   - Links may be empty from API response
   - **Workaround:** Use `/ticket login` for browser setup

3. **Formula Parser**
   - State cleanup after 1 minute may interrupt long formulas
   - **Workaround:** Send formula within 1 minute of `/formula` command

### 📝 Pending Tasks

- [ ] **Lunch Menu**
  - Add March 2026 menu
  - Add April 2026 menu
  - Add remaining 2026 months

- [ ] **Ticket API**
  - Investigate `link` field from API
  - Determine if field name is different
  - Add fallback link generation if needed

- [ ] **Enhancements**
  - Add `/dev export` to export all credentials
  - Add `/formula save` to save parsed formulas
  - Add `/ticket stats` for ticket statistics

- [ ] **Documentation**
  - Create video tutorial for ticket response workflow
  - Add troubleshooting guide
  - Create quick reference card

### 🎯 Future Roadmap

**Q1 2026:**
- [ ] Add more regional holidays (2027)
- [ ] Implement credential encryption
- [ ] Add backup/restore for credentials

**Q2 2026:**
- [ ] Web dashboard for menu management
- [ ] Ticket assignment notifications
- [ ] Custom reminder scheduling

**Q3 2026:**
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Integration with project management tools

---

## 🔒 Security Considerations

1. **Environment Variables**
   - Never commit `.env` file
   - Use strong database passwords
   - Rotate bot token periodically

2. **Bearer Tokens**
   - Auto-expire after 5 minutes
   - Stored in memory only (not persisted)
   - Clear with `/ticket logout`

3. **Database**
   - Use SSL for PostgreSQL connections
   - Regular backups recommended
   - Limit database access to bot only

4. **Private Chat Only**
   - Ticket response commands restricted to private chat
   - Prevents token exposure in group chats

---

## 📞 Support & Maintenance

### Getting Help
- Use `/help` command in Telegram
- Check this README for detailed documentation
- Review error messages in bot console

### Reporting Issues
1. Note the command that failed
2. Check console output for errors
3. Verify environment variables are set
4. Ensure database is running (for `/dev` commands)

### Maintenance Tasks

**Daily:**
- Check bot health at http://localhost:8080/health
- Monitor console for errors

**Weekly:**
- Review lunch menu for upcoming week
- Verify scheduled reminders are working
- Check database backups (if applicable)

**Monthly:**
- Add next month's lunch menu
- Update holiday data if needed
- Review and clear old credentials

**Documentation:**
- Update [Current Work in Progress](#current-work-in-progress) after each session
- Remove feature documentation when features are removed from code
- Add feature documentation immediately when new features are added
- Keep README in sync with actual codebase at all times

---

## 📝 License & Credits

**Developed for:** Internal team productivity
**Maintained by:** Development Team
**Last Updated:** February 04, 2026

**Dependencies:**
- node-telegram-bot-api (Telegram integration)
- node-cron (Scheduled jobs)
- hot-formula-parser (Formula parsing)
- pg (PostgreSQL client)
- express (Web server)
- dotenv (Environment management)

---

## 🎓 Changelog

### Version 1.0.0 (Feb 04, 2026)
- ✅ Initial release
- ✅ All core features implemented
- ✅ Lunch menu system with unified file
- ✅ Ticket management with clickable links
- ✅ Comprehensive documentation

---

## 📋 Quick Update Template

**Use this template when updating the "Current Work in Progress" section:**

```markdown
## 🚧 Current Work in Progress

> **📌 AI Context Section:** When starting a new chat session, read this section first to understand where we left off. Update this section after every work session.

**Last Session:** [Date & Time]

### What Was Just Completed:
1. ✅ [Task description]
2. ✅ [Task description]

### Next Steps (Pending):
1. ⏳ **[Task Name]**
   - [Details]
   - [File paths if relevant]
   - [Dependencies or blockers]

### Active Issues:
- **[Issue Name]:** [Description]
  - Workaround: [If any]

### Context for Next Session:
- [Important information to remember]
- [Current state of the project]
- [Any manual steps needed]
```

---

**For questions or support, contact the development team.**

🦇 **BotBatman** - Your daily productivity companion
