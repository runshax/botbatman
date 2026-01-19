const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Koyeb hosted databases
  }
});

// Initialize database table
const initDatabase = async () => {
  try {
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
    console.log('Database table initialized successfully');
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

module.exports = {
  initDatabase,
  addCredential,
  getCredential,
  getCredentialBySfgo,
  getAllCredentials,
  deleteCredential
};
