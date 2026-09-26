const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const { uploadFile, getFileUrl, deleteFile } = require('../storage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Get expenses, optionally filtered by year/month
router.get('/', async (req, res) => {
  const { year, month } = req.query;
  let query = 'SELECT * FROM expenses';
  const params = [];
  if (year && month) {
    query += ' WHERE year = $1 AND month = $2';
    params.push(year, month);
  } else if (year) {
    query += ' WHERE year = $1';
    params.push(year);
  }
  query += ' ORDER BY expense_date DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Get signed URL for a receipt
router.get('/:id/receipt', async (req, res) => {
  const result = await pool.query('SELECT receipt_path FROM expenses WHERE id = $1', [req.params.id]);
  if (!result.rows[0]?.receipt_path) return res.status(404).json({ error: 'No receipt' });
  const url = await getFileUrl('receipts', result.rows[0].receipt_path);
  res.json({ url });
});

// Add an expense (with optional receipt)
router.post('/', upload.single('receipt'), async (req, res) => {
  const { year, month, category, amount, description, expense_date } = req.body;
  let receiptPath = null;
  if (req.file) {
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    receiptPath = await uploadFile('receipts', fileName, req.file.buffer, req.file.mimetype);
  }
  const result = await pool.query(
    `INSERT INTO expenses (year, month, category, amount, description, expense_date, receipt_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [year, month, category, amount, description, expense_date, receiptPath]
  );
  res.json(result.rows[0]);
});

// Update an expense (with optional receipt)
router.put('/:id', upload.single('receipt'), async (req, res) => {
  const { category, amount, description, expense_date, remove_receipt } = req.body;
  const [year, monthNum] = expense_date.split('-').map(Number);

  // Get current receipt path
  const current = await pool.query('SELECT receipt_path FROM expenses WHERE id = $1', [req.params.id]);
  let receiptPath = current.rows[0]?.receipt_path || null;

  // Delete old receipt if replacing or removing
  if ((req.file || remove_receipt === 'true') && receiptPath) {
    await deleteFile('receipts', receiptPath).catch(() => {});
    receiptPath = null;
  }

  // Upload new receipt if provided
  if (req.file) {
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    receiptPath = await uploadFile('receipts', fileName, req.file.buffer, req.file.mimetype);
  }

  const result = await pool.query(
    `UPDATE expenses SET category=$1, amount=$2, description=$3, expense_date=$4, year=$5, month=$6, receipt_path=$7 WHERE id=$8 RETURNING *`,
    [category, amount, description, expense_date, year, monthNum, receiptPath, req.params.id]
  );
  res.json(result.rows[0]);
});

// Delete an expense
router.delete('/:id', async (req, res) => {
  const current = await pool.query('SELECT receipt_path FROM expenses WHERE id = $1', [req.params.id]);
  if (current.rows[0]?.receipt_path) {
    await deleteFile('receipts', current.rows[0].receipt_path).catch(() => {});
  }
  await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
