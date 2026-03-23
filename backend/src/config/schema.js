const pool = require('./db');

const initSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('buyer', 'carrier')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS auctions (
        id SERIAL PRIMARY KEY,
        rfq_name VARCHAR(255) NOT NULL,
        buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        forced_end_time TIMESTAMP NOT NULL,
        pickup_date DATE NOT NULL,
        trigger_window INTEGER NOT NULL DEFAULT 5,
        extension_duration INTEGER NOT NULL DEFAULT 5,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'force_closed')),
        current_end_time TIMESTAMP NOT NULL,
        lowest_bid NUMERIC(15, 2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bids (
        id SERIAL PRIMARY KEY,
        auction_id INTEGER REFERENCES auctions(id) ON DELETE CASCADE,
        carrier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        carrier_name VARCHAR(255) NOT NULL,
        freight_charges NUMERIC(15, 2) NOT NULL DEFAULT 0,
        origin_charges NUMERIC(15, 2) NOT NULL DEFAULT 0,
        destination_charges NUMERIC(15, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(15, 2) NOT NULL,
        transit_time VARCHAR(100) NOT NULL,
        quote_validity DATE NOT NULL,
        rank INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS auction_logs (
        id SERIAL PRIMARY KEY,
        auction_id INTEGER REFERENCES auctions(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
      CREATE INDEX IF NOT EXISTS idx_auctions_buyer ON auctions(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
      CREATE INDEX IF NOT EXISTS idx_bids_carrier ON bids(carrier_id);
      CREATE INDEX IF NOT EXISTS idx_logs_auction ON auction_logs(auction_id);
    `);
    console.log('✅ Database schema initialized');
  } catch (err) {
    console.error('Schema init error:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = initSchema;
