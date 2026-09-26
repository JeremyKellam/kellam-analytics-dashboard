require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'db error' });
  }
});

app.use((req, res, next) => {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/api/years', async (req, res) => {
  const result = await db.query(`
    SELECT DISTINCT year FROM (
      SELECT EXTRACT(YEAR FROM invoice_date)::int AS year FROM invoices
      UNION SELECT year FROM expenses
      UNION SELECT EXTRACT(YEAR FROM trip_date)::int AS year FROM trips
    ) y ORDER BY year DESC
  `);
  res.json(result.rows.map(r => r.year));
});

app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/export', require('./routes/export'));

const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      client VARCHAR(255) NOT NULL,
      invoice_number VARCHAR(100),
      invoice_date DATE NOT NULL,
      due_date DATE,
      amount NUMERIC(10,2) NOT NULL,
      paid BOOLEAN DEFAULT false,
      receipt_path TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      category VARCHAR(50) NOT NULL CHECK (category IN (
        'advertising', 'contract_labor', 'depreciation', 'professional_fees',
        'office_expense', 'supplies', 'taxes_licenses', 'travel', 'meals',
        'utilities', 'other'
      )),
      amount NUMERIC(10,2) NOT NULL,
      description TEXT,
      expense_date DATE,
      receipt_path TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      trip_date DATE NOT NULL,
      miles NUMERIC(10,1) NOT NULL,
      purpose TEXT
    )
  `);
};

const PORT = process.env.PORT || 4000;
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error('DB init failed:', err);
  process.exit(1);
});
