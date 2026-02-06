# Error Log API Documentation

## Overview

This API allows external servers (e.g., Koyeb deployments) to send error logs to the BotBatman database for centralized monitoring.

---

## Authentication

All API endpoints require an API key for authentication.

**Method:** Include API key in request headers

**Header Name:** `X-API-Key` or `Authorization`

**Example:**
```
X-API-Key: your_secret_api_key_here
```

**Configuration:**
Set the API key in `.env` file:
```env
API_KEY=your_secret_api_key_here
```

---

## Base URL

**Local Development:**
```
http://localhost:8080
```

**Production (Koyeb):**
```
https://your-app-name.koyeb.app
```

---

## Endpoints

### 1. Save Error Log

**POST** `/api/saveerrorlog`

Save an error log to the database.

#### Request Headers
```
Content-Type: application/json
X-API-Key: your_secret_api_key_here
```

#### Request Body
```json
{
  "data": "{\"error\": \"Database connection failed\", \"timestamp\": \"2026-02-04T11:00:00Z\", \"service\": \"payment-api\"}",
  "type_data": "api_error"
}
```

**Fields:**
- `data` (required, string): JSON string or text containing error details
- `type_data` (optional, string): Category/type of error (e.g., "api_error", "database_error", "timeout")

#### Response (Success - 201)
```json
{
  "success": true,
  "message": "Error log saved successfully",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_date": "2026-02-04T11:00:00.000Z"
}
```

#### Response (Error - 400)
```json
{
  "success": false,
  "error": "Missing required field: data"
}
```

#### Response (Error - 401)
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing API key"
}
```

---

### 2. Get All Error Logs

**GET** `/api/error-log`

Retrieve all error logs (for debugging purposes).

#### Request Headers
```
X-API-Key: your_secret_api_key_here
```

#### Response (Success - 200)
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "created_date": "2026-02-04T11:00:00.000Z",
      "data": "{\"error\": \"Database connection failed\"}",
      "type_data": "api_error"
    }
  ]
}
```

---

### 3. Get Error Log by ID

**GET** `/api/error-log/:id`

Retrieve a specific error log by its UUID.

#### Request Headers
```
X-API-Key: your_secret_api_key_here
```

#### URL Parameters
- `id` (UUID): The error log ID

#### Response (Success - 200)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "created_date": "2026-02-04T11:00:00.000Z",
    "data": "{\"error\": \"Database connection failed\"}",
    "type_data": "api_error"
  }
}
```

#### Response (Error - 404)
```json
{
  "success": false,
  "error": "Error log not found"
}
```

---

## Postman Examples

### Example 1: Send Error Log

**Request:**
```http
POST http://localhost:8080/api/saveerrorlog
Content-Type: application/json
X-API-Key: your_secret_api_key_here

{
  "data": "{\"error\": \"Payment processing failed\", \"amount\": 1000, \"currency\": \"IDR\", \"timestamp\": \"2026-02-04T11:00:00Z\"}",
  "type_data": "payment_error"
}
```

**cURL Command:**
```bash
curl -X POST http://localhost:8080/api/saveerrorlog \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_api_key_here" \
  -d '{
    "data": "{\"error\": \"Payment processing failed\", \"amount\": 1000, \"currency\": \"IDR\"}",
    "type_data": "payment_error"
  }'
```

---

### Example 2: Send Simple Text Error

**Request:**
```http
POST http://localhost:8080/api/saveerrorlog
Content-Type: application/json
X-API-Key: your_secret_api_key_here

{
  "data": "Server crashed at 11:00 AM - OutOfMemoryError",
  "type_data": "server_crash"
}
```

---

### Example 3: Get All Logs

**Request:**
```http
GET http://localhost:8080/api/error-log
X-API-Key: your_secret_api_key_here
```

**cURL Command:**
```bash
curl -X GET http://localhost:8080/api/error-log \
  -H "X-API-Key: your_secret_api_key_here"
```

---

## Telegram Bot Commands

View error logs directly in Telegram using these commands:

### `/errorlog`
Shows the latest 10 error logs

**Example:**
```
/errorlog
```

**Output:**
```
📋 Error Logs (25 total, showing latest 10)

🔸 ID: 550e8400-e29b-41d4-a716-446655440000
   📅 04/02/26, 11:00
   🏷️ Type: payment_error
   📝 {"error": "Payment processing failed", "amount": 1000...

...
```

### `/errorlog <id>`
Shows detailed information for a specific error log

**Example:**
```
/errorlog 550e8400-e29b-41d4-a716-446655440000
```

**Output:**
```
📋 Error Log Details

🔸 ID: 550e8400-e29b-41d4-a716-446655440000
📅 Date: 04 Februari 2026, 11:00:00
🏷️ Type: payment_error

📝 Data:
```
{"error": "Payment processing failed", "amount": 1000, "currency": "IDR"}
```
```

---

## Database Schema

### Table: `error_msg_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `created_date` | TIMESTAMP | Auto-set to current timestamp |
| `data` | TEXT | Error data (JSON string or plain text) |
| `type_data` | VARCHAR(255) | Optional category/type of error |

**SQL:**
```sql
CREATE TABLE error_msg_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data TEXT NOT NULL,
  type_data VARCHAR(255)
);
```

---

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | OK - Request successful (GET) |
| 201 | Created - Error log saved successfully (POST) |
| 400 | Bad Request - Missing required fields |
| 401 | Unauthorized - Invalid or missing API key |
| 404 | Not Found - Error log with given ID not found |
| 500 | Internal Server Error - Database or server error |

---

## Security Notes

1. **API Key Storage:** Store the API key in environment variables, never in code
2. **HTTPS:** Use HTTPS in production to encrypt API keys in transit
3. **Rate Limiting:** Consider implementing rate limiting for production use
4. **Data Validation:** All input is validated before storage
5. **Size Limit:** Request body limited to 10MB

---

## Integration Example (Node.js)

```javascript
const axios = require('axios');

async function sendErrorLog(error, type) {
  try {
    const response = await axios.post('http://localhost:8080/api/saveerrorlog', {
      data: JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }),
      type_data: type
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.API_KEY
      }
    });

    console.log('Error log sent:', response.data.id);
  } catch (err) {
    console.error('Failed to send error log:', err.message);
  }
}

// Usage
try {
  // Your code here
} catch (error) {
  await sendErrorLog(error, 'api_error');
}
```

---

## Testing Checklist

- [ ] Test POST with valid API key
- [ ] Test POST without API key (should return 401)
- [ ] Test POST with invalid API key (should return 401)
- [ ] Test POST without `data` field (should return 400)
- [ ] Test POST with JSON data
- [ ] Test POST with plain text data
- [ ] Test GET all logs with valid API key
- [ ] Test GET specific log by ID
- [ ] Test GET with invalid ID (should return 404)
- [ ] Test Telegram `/errorlog` command
- [ ] Test Telegram `/errorlog <id>` command

---

**Last Updated:** February 04, 2026
