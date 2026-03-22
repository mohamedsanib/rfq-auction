const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ,
});

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('buyer', 'carrier')),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rfqs (
      id SERIAL PRIMARY KEY,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      forced_end_date TIMESTAMP NOT NULL,
      pickup_date DATE NOT NULL,
      trigger_window INTEGER NOT NULL DEFAULT 10,
      extension_time INTEGER NOT NULL DEFAULT 5,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'force_closed')),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bids (
      id SERIAL PRIMARY KEY,
      rfq_id INTEGER NOT NULL REFERENCES rfqs(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      freight_charges NUMERIC(12,2) NOT NULL,
      origin_charges NUMERIC(12,2) NOT NULL,
      destination_charges NUMERIC(12,2) NOT NULL,
      total_cost NUMERIC(12,2) GENERATED ALWAYS AS (freight_charges + origin_charges + destination_charges) STORED,
      transit_time INTEGER NOT NULL,
      validity_of_quote DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      rfq_id INTEGER NOT NULL REFERENCES rfqs(id),
      action VARCHAR(50) NOT NULL CHECK (action IN ('bid', 'bid_extension', 'status_change')),
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Database initialized');
};

module.exports = { pool, initDB };