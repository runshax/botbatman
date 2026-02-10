# Error Log API Documentation

## Overview

This API allows external servers (e.g., Koyeb deployments) to send error logs to the BotBatman database for centralized monitoring via Telegram.

---

## Environment Variables

Configure these variables in your `.env` file:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | - | Telegram bot token |
| `CHAT_ID` | Yes | - | Default Telegram chat ID for notifications |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `API_KEY` | Yes | - | API key for authentication |
| `PORT` | No | `8080` | Server port |
| `REMINDER_ERROR` | No | `true` | Enable/disable auto-reminder (`true` or `false`) |

---

## Authentication

All API endpoints require an API key in the request header.

**Header:** `X-API-Key: your_secret_api_key_here`

---

## Base URL

**Local:** `http://localhost:8080`
**Production:** `https://your-app-name.koyeb.app`

---

## Endpoints

### 1. Save Single Error Log

**POST** `/api/saveerrorlog`

#### Request
```http
POST /api/saveerrorlog
Content-Type: application/json
X-API-Key: your_secret_api_key_here

{
  "data": "{\"error\": \"Payment failed\", \"empId\": \"EMP001\", \"line\": \"42\", \"file\": \"payment.service.js\"}",
  "type_data": "payment_error"
}
```

**Fields:**
- `data` (required): JSON string with error details
- `type_data` (optional): Category of error (e.g., `tax_process_error`, `api_error`)

#### Response (201)
```json
{
  "success": true,
  "message": "Error log saved successfully",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_date": "2026-02-10T08:23:00.000Z"
}
```

#### cURL
```bash
curl -X POST https://your-app.koyeb.app/api/saveerrorlog \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_api_key_here" \
  -d '{
    "data": "{\"error\": \"Payment failed\", \"empId\": \"EMP001\"}",
    "type_data": "payment_error"
  }'
```

---

### 2. Batch Save Error Logs

**POST** `/api/saveerrorlog/batch`

Save multiple error logs in one request. Each error becomes its own row in the database.

#### Request
```http
POST /api/saveerrorlog/batch
Content-Type: application/json
X-API-Key: your_secret_api_key_here

{
  "errors": [
    {
      "data": "{\"error\": \"Employee not found\", \"empId\": \"EMP001\"}",
      "type_data": "employee_error"
    },
    {
      "data": "{\"error\": \"Tax calculation failed\", \"empId\": \"EMP002\"}",
      "type_data": "tax_process_error"
    }
  ]
}
```

#### Response (201)
```json
{
  "success": true,
  "message": "2 error logs saved successfully",
  "count": 2,
  "ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "661f9511-f30c-52e5-b827-557766551111"
  ]
}
```

#### cURL
```bash
curl -X POST https://your-app.koyeb.app/api/saveerrorlog/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_api_key_here" \
  -d '{
    "errors": [
      {"data": "{\"error\": \"Employee not found\", \"empId\": \"EMP001\"}", "type_data": "employee_error"},
      {"data": "{\"error\": \"Tax failed\", \"empId\": \"EMP002\"}", "type_data": "tax_process_error"}
    ]
  }'
```

---

### 3. Get All Error Logs

**GET** `/api/error-log`

```bash
curl -X GET https://your-app.koyeb.app/api/error-log \
  -H "X-API-Key: your_secret_api_key_here"
```

#### Response (200)
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "created_date": "2026-02-10T08:23:00.000Z",
      "data": "{\"error\": \"Payment failed\"}",
      "type_data": "payment_error",
      "status_reminder": "Y"
    }
  ]
}
```

---

### 4. Get Error Log by ID

**GET** `/api/error-log/:id`

```bash
curl -X GET https://your-app.koyeb.app/api/error-log/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your_secret_api_key_here"
```

---

### 5. Delete Error Log by ID

**DELETE** `/api/error-log/:id`

```bash
curl -X DELETE https://your-app.koyeb.app/api/error-log/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your_secret_api_key_here"
```

---

### 6. Delete All Error Logs

**DELETE** `/api/error-log`

```bash
curl -X DELETE https://your-app.koyeb.app/api/error-log \
  -H "X-API-Key: your_secret_api_key_here"
```

---

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/errorlog` | Show latest 10 logs, marks displayed logs as reminded |
| `/errorlog <id>` | Show full details of specific log, marks as reminded |
| `/errorlog clear` | Delete all error logs from database |
| `/errorlog download 2026-02-10` | Download all logs from specific date as TXT file |

---

## Auto-Reminder System

### How It Works

1. External server sends error via API → saved with `status_reminder = NULL`
2. Koyeb health check cron hits `/` endpoint
3. Bot checks for unreminded logs during active window
4. Bot sends up to 10 errors to Telegram
5. Those errors marked as `status_reminder = 'Y'`
6. Next day 7:30 AM → Full report of ALL yesterday's errors as TXT file

### Time Schedule (Asia/Jakarta timezone)

| Time | Action |
|------|--------|
| **7:30 AM** | Daily report: Download ALL error logs from yesterday as TXT file |
| **8:00 AM - 7:30 PM** | Auto-reminder active: sends unreminded errors on health check |
| **After 7:30 PM** | Auto-reminder disabled (next morning report covers it) |

### Auto-Reminder Filters
- Only shows logs where `status_reminder IS NULL OR status_reminder = ''`
- Skips database/query errors (e.g., `file: QueryFailedError.js`)
- Shows max **10** errors per notification
- If more than 10, shows remaining short IDs (up to 10)

### Disable Auto-Reminder
Set in Koyeb environment variables:
```
REMINDER_ERROR=false
```

---

## Database Schema

### Table: `error_msg_log`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `created_date` | TIMESTAMP | `CURRENT_TIMESTAMP` | Auto-set on insert |
| `data` | TEXT | - | Error data (JSON string) |
| `type_data` | VARCHAR(255) | NULL | Optional error category |
| `status_reminder` | VARCHAR(1) | NULL | `NULL/''` = unreminded, `Y` = reminded |

---

## Node.js Integration Example

```javascript
const axios = require('axios');

const BOT_API_URL = 'https://your-app.koyeb.app';
const API_KEY = process.env.BOT_API_KEY;

// Single error
async function sendErrorLog(errorData, type) {
  await axios.post(`${BOT_API_URL}/api/saveerrorlog`, {
    data: JSON.stringify(errorData),
    type_data: type
  }, {
    headers: { 'X-API-Key': API_KEY }
  });
}

// Batch errors (multiple employees/records)
async function sendBatchErrorLogs(errors) {
  const formatted = errors.map(e => ({
    data: JSON.stringify(e.data),
    type_data: e.type
  }));

  await axios.post(`${BOT_API_URL}/api/saveerrorlog/batch`, {
    errors: formatted
  }, {
    headers: { 'X-API-Key': API_KEY }
  });
}

// Usage
try {
  // your code
} catch (error) {
  await sendErrorLog({
    error: error.message,
    empId: 'EMP001',
    line: error.stack?.split('\n')[1],
    file: 'payment.service.js'
  }, 'tax_process_error');
}
```

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 201 | Created - Saved successfully |
| 200 | OK - Request successful |
| 400 | Bad Request - Missing required fields |
| 401 | Unauthorized - Invalid/missing API key |
| 404 | Not Found - Log ID not found |
| 500 | Internal Server Error |

---

**Last Updated:** February 10, 2026
