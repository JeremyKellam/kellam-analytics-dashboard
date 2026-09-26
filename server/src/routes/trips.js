const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all trips, optionally filtered by year
router.get('/', async (req, res) => {
  const { year } = req.query;
  let query = 'SELECT * FROM trips';
  const params = [];
  if (year) {
    query += ' WHERE EXTRACT(YEAR FROM trip_date) = $1';
    params.push(year);
  }
  query += ' ORDER BY trip_date DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Get mileage summary by year
router.get('/summary', async (req, res) => {
  const { year } = req.query;
  const params = year ? [year] : [];
  const whereClause = year ? 'WHERE EXTRACT(YEAR FROM trip_date) = $1' : '';
  const result = await pool.query(
    `SELECT
      EXTRACT(YEAR FROM trip_date) as year,
      COUNT(*) as trip_count,
      SUM(miles) as total_miles,
      SUM(miles) * 0.70 as estimated_deduction
     FROM trips ${whereClause}
     GROUP BY EXTRACT(YEAR FROM trip_date)
     ORDER BY year DESC`,
    params
  );
  res.json(result.rows);
});

// Log a trip
router.post('/', async (req, res) => {
  const { trip_date, miles, purpose } = req.body;
  const result = await pool.query(
    'INSERT INTO trips (trip_date, miles, purpose) VALUES ($1, $2, $3) RETURNING *',
    [trip_date, miles, purpose]
  );
  res.json(result.rows[0]);
});

// Update a trip
router.put('/:id', async (req, res) => {
  const { trip_date, miles, purpose } = req.body;
  const result = await pool.query(
    'UPDATE trips SET trip_date=$1, miles=$2, purpose=$3 WHERE id=$4 RETURNING *',
    [trip_date, miles, purpose, req.params.id]
  );
  res.json(result.rows[0]);
});

// Delete a trip
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM trips WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
