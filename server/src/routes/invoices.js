const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const { uploadFile, getFileUrl, deleteFile } = require('../storage');
const Anthropic = require('@anthropic-ai/sdk');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Get all invoices, optionally filtered by year
router.get('/', async (req, res) => {
  const { year } = req.query;
  let query = 'SELECT * FROM invoices';
  const params = [];
  if (year) {
    query += ' WHERE EXTRACT(YEAR FROM invoice_date) = $1';
    params.push(year);
  }
  query += ' ORDER BY invoice_date DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Create invoice
router.post('/', async (req, res) => {
  const { client, invoice_number, invoice_date, due_date, amount } = req.body;
  const result = await pool.query(
    `INSERT INTO invoices (client, invoice_number, invoice_date, due_date, amount)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [client, invoice_number, invoice_date, due_date || null, amount]
  );
  res.json(result.rows[0]);
});

// Update invoice
router.put('/:id', async (req, res) => {
  const { client, invoice_number, invoice_date, due_date, amount } = req.body;
  const result = await pool.query(
    `UPDATE invoices SET client=$1, invoice_number=$2, invoice_date=$3, due_date=$4, amount=$5, updated_at=NOW()
     WHERE id=$6 RETURNING *`,
    [client, invoice_number, invoice_date, due_date || null, amount, req.params.id]
  );
  res.json(result.rows[0]);
});

// Toggle paid status
router.patch('/:id/paid', upload.single('receipt'), async (req, res) => {
  const current = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ error: 'Not found' });

  const invoice = current.rows[0];
  const newPaid = !invoice.paid;

  let receiptPath = invoice.receipt_path;

  // If marking paid and a receipt file is uploaded, store it
  if (newPaid && req.file) {
    // Delete old receipt if exists
    if (receiptPath) {
      await deleteFile('invoices', receiptPath).catch(() => {});
    }
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    receiptPath = await uploadFile('invoices', fileName, req.file.buffer, req.file.mimetype);
  }

  // If unmarking paid, optionally remove receipt
  if (!newPaid && receiptPath) {
    await deleteFile('invoices', receiptPath).catch(() => {});
    receiptPath = null;
  }

  const result = await pool.query(
    'UPDATE invoices SET paid=$1, receipt_path=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
    [newPaid, receiptPath, req.params.id]
  );
  res.json(result.rows[0]);
});

// Get signed URL for an invoice receipt
router.get('/:id/receipt', async (req, res) => {
  const result = await pool.query('SELECT receipt_path FROM invoices WHERE id = $1', [req.params.id]);
  if (!result.rows[0]?.receipt_path) return res.status(404).json({ error: 'No receipt' });
  const url = await getFileUrl('invoices', result.rows[0].receipt_path);
  res.json({ url });
});

// Delete invoice
router.delete('/:id', async (req, res) => {
  const current = await pool.query('SELECT receipt_path FROM invoices WHERE id = $1', [req.params.id]);
  if (current.rows[0]?.receipt_path) {
    await deleteFile('invoices', current.rows[0].receipt_path).catch(() => {});
  }
  await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Parse invoice file with Claude
router.post('/parse', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // Upload file to Supabase Storage
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storedPath = await uploadFile('invoices', fileName, req.file.buffer, req.file.mimetype);

    // Determine media type for Claude
    const mimeMap = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      heic: 'image/heic',
    };
    const mediaType = mimeMap[ext] || req.file.mimetype;
    const base64Data = req.file.buffer.toString('base64');

    const anthropic = new Anthropic();

    let content;
    if (ext === 'pdf') {
      content = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data,
          },
        },
        {
          type: 'text',
          text: `Extract the following fields from this invoice and return them as a JSON object. Only return valid JSON, no other text.

Fields:
- client: the name of the client being billed (or the company issuing the invoice)
- invoice_number: the invoice number/ID
- invoice_date: the invoice date in YYYY-MM-DD format
- due_date: the due date in YYYY-MM-DD format (null if not found)
- amount: the total amount as a number (no currency symbols)

Example response:
{"client": "Acme Corp", "invoice_number": "INV-001", "invoice_date": "2025-01-15", "due_date": "2025-02-15", "amount": 5000.00}`,
        },
      ];
    } else {
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        },
        {
          type: 'text',
          text: `Extract the following fields from this invoice and return them as a JSON object. Only return valid JSON, no other text.

Fields:
- client: the name of the client being billed (or the company issuing the invoice)
- invoice_number: the invoice number/ID
- invoice_date: the invoice date in YYYY-MM-DD format
- due_date: the due date in YYYY-MM-DD format (null if not found)
- amount: the total amount as a number (no currency symbols)

Example response:
{"client": "Acme Corp", "invoice_number": "INV-001", "invoice_date": "2025-01-15", "due_date": "2025-02-15", "amount": 5000.00}`,
        },
      ];
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    });

    const responseText = message.content[0].text;
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Could not parse invoice', raw: responseText });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ ...parsed, receipt_path: storedPath });
  } catch (err) {
    console.error('Invoice parse error:', err);
    res.status(500).json({ error: 'Failed to parse invoice', details: err.message });
  }
});

module.exports = router;
