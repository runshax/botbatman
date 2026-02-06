const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Koyeb hosted databases
  }
});

// Initialize database tables
const initDatabase = async () => {
  try {
    // Create dev_credentials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dev_credentials (
        id SERIAL PRIMARY KEY,
        sfgo VARCHAR(255) UNIQUE NOT NULL,
        country VARCHAR(50),
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create error_msg_log table for incoming API data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS error_msg_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data TEXT NOT NULL,
        type_data VARCHAR(255)
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

// Add or update credential
const addCredential = async (sfgo, country, username, password, url) => {
  try {
    const result = await pool.query(
      `INSERT INTO dev_credentials (sfgo, country, username, password, url, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (sfgo)
       DO UPDATE SET country = $2, username = $3, password = $4, url = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [sfgo, country, username, password, url]
    );
    return { success: true, data: result.rows[0] };
  } catch (err) {
    console.error('Error adding credential:', err);
    return { success: false, error: err.message };
  }
};

// Get credential by SFGO
const getCredentialBySfgo = async (sfgo) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dev_credentials WHERE sfgo = $1',
      [sfgo]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error getting credential:', err);
    return null;
  }
};

// Get credential by country
const getCredential = async (country) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dev_credentials WHERE LOWER(country) = $1',
      [country.toLowerCase()]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error getting credential:', err);
    return null;
  }
};

// Get all credentials
const getAllCredentials = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM dev_credentials ORDER BY sfgo'
    );
    return result.rows;
  } catch (err) {
    console.error('Error getting all credentials:', err);
    return [];
  }
};

// Delete credential by SFGO
const deleteCredential = async (sfgo) => {
  try {
    const result = await pool.query(
      'DELETE FROM dev_credentials WHERE sfgo = $1 RETURNING *',
      [sfgo]
    );
    return { success: true, deleted: result.rowCount > 0 };
  } catch (err) {
    console.error('Error deleting credential:', err);
    return { success: false, error: err.message };
  }
};

// ==================== ERROR MESSAGE LOG FUNCTIONS ====================

// Save error log from external API
const saveErrorLog = async (data, typeData) => {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const result = await pool.query(
      'INSERT INTO error_msg_log (data, type_data) VALUES ($1, $2) RETURNING *',
      [dataString, typeData]
    );
    return { success: true, data: result.rows[0] };
  } catch (err) {
    console.error('Error saving error log:', err);
    return { success: false, error: err.message };
  }
};

// Get all error logs
const getAllErrorLogs = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM error_msg_log ORDER BY created_date DESC'
    );
    return result.rows;
  } catch (err) {
    console.error('Error getting error logs:', err);
    return [];
  }
};

// Get error log by ID
const getErrorLogById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM error_msg_log WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error getting error log by ID:', err);
    return null;
  }
};

module.exports = {
  initDatabase,
  addCredential,
  getCredential,
  getCredentialBySfgo,
  getAllCredentials,
  deleteCredential,
  saveErrorLog,
  getAllErrorLogs,
  getErrorLogById
};
