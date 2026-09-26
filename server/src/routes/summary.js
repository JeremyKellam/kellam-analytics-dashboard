const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get monthly summary: income vs expenses
router.get('/monthly', async (req, res) => {
  const { year } = req.query;
  const params = year ? [year] : [];
  const invoiceWhere = year ? 'WHERE EXTRACT(YEAR FROM invoice_date) = $1' : '';
  const expenseWhere = year ? 'WHERE year = $1' : '';

  const income = await pool.query(
    `SELECT
      EXTRACT(YEAR FROM invoice_date)::int as year,
      EXTRACT(MONTH FROM invoice_date)::int as month,
      SUM(CASE WHEN paid THEN amount ELSE 0 END) as total_collected,
      SUM(amount) as total_invoiced
     FROM invoices ${invoiceWhere}
     GROUP BY EXTRACT(YEAR FROM invoice_date), EXTRACT(MONTH FROM invoice_date)
     ORDER BY year DESC, month DESC`,
    params
  );

  const expenses = await pool.query(
    `SELECT year, month, category, SUM(amount) as total
     FROM expenses ${expenseWhere}
     GROUP BY year, month, category ORDER BY year DESC, month DESC`,
    params
  );

  res.json({ income: income.rows, expenses: expenses.rows });
});

module.exports = router;
