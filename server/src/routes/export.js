const express = require('express');
const router = express.Router();
const pool = require('../db');
const ExcelJS = require('exceljs');

const CATEGORY_LABELS = {
  advertising:       'Advertising',
  contract_labor:    'Contract Labor',
  depreciation:      'Depreciation',
  professional_fees: 'Legal & Professional Fees',
  office_expense:    'Office Expense',
  supplies:          'Supplies',
  taxes_licenses:    'Taxes & Licenses',
  travel:            'Travel',
  meals:             'Meals',
  utilities:         'Utilities',
  other:             'Other',
};

// Schedule C line mapping for summary sheet
const SCHEDULE_C_LINES = [
  { label: 'Contract Labor',            key: 'contract_labor',    line: 'Line 11' },
  { label: 'Depreciation',              key: 'depreciation',      line: 'Line 13' },
  { label: 'Legal & Professional Fees', key: 'professional_fees', line: 'Line 17' },
  { label: 'Office Expense',            key: 'office_expense',    line: 'Line 18' },
  { label: 'Supplies',                  key: 'supplies',          line: 'Line 22' },
  { label: 'Taxes & Licenses',          key: 'taxes_licenses',    line: 'Line 23' },
  { label: 'Travel',                    key: 'travel',            line: 'Line 24a' },
  { label: 'Meals',                     key: 'meals',             line: 'Line 24b' },
  { label: 'Utilities',                 key: 'utilities',         line: 'Line 25' },
  { label: 'Other (Advertising + Other)', key: '__other_combined', line: 'Line 27a' },
];

const IRS_RATE = 0.70;

router.get('/', async (req, res) => {
  const { year } = req.query;
  const yearFilter = year ? parseInt(year) : null;

  const invoiceWhere = yearFilter ? 'WHERE EXTRACT(YEAR FROM invoice_date) = $1' : '';
  const expenseWhere = yearFilter ? 'WHERE year = $1' : '';
  const tripWhere = yearFilter ? 'WHERE EXTRACT(YEAR FROM trip_date) = $1' : '';
  const params = yearFilter ? [yearFilter] : [];

  const [invoices, expenses, trips] = await Promise.all([
    pool.query(`SELECT client, invoice_number, invoice_date, amount, paid FROM invoices ${invoiceWhere} ORDER BY invoice_date`, params),
    pool.query(`SELECT expense_date, category, description, amount FROM expenses ${expenseWhere} ORDER BY expense_date`, params),
    pool.query(`SELECT trip_date, miles, purpose FROM trips ${tripWhere} ORDER BY trip_date`, params),
  ]);

  const workbook = new ExcelJS.Workbook();

  // --- Summary sheet ---
  const summarySheet = workbook.addWorksheet('Summary (Schedule C)');
  summarySheet.columns = [
    { key: 'label', width: 36 },
    { key: 'line',  width: 12 },
    { key: 'amount', width: 16 },
  ];

  const addSummaryHeader = (text) => {
    const row = summarySheet.addRow({ label: text });
    row.font = { bold: true, size: 12 };
    row.getCell('label').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    summarySheet.mergeCells(`A${row.number}:C${row.number}`);
  };

  const addSummaryRow = (label, line, amount) => {
    const row = summarySheet.addRow({ label, line, amount });
    row.getCell('amount').numFmt = '"$"#,##0.00';
    return row;
  };

  const addSummaryTotal = (label, amount) => {
    const row = summarySheet.addRow({ label, amount });
    row.font = { bold: true };
    row.getCell('amount').numFmt = '"$"#,##0.00';
    return row;
  };

  summarySheet.addRow({ label: yearFilter ? `Tax Year ${yearFilter} — Schedule C Summary` : 'All Years — Schedule C Summary' }).font = { bold: true, size: 14 };
  summarySheet.addRow({});

  // Income
  addSummaryHeader('INCOME');
  summarySheet.addRow({ label: 'Description', line: 'Schedule C', amount: 'Amount' }).font = { bold: true, italic: true };
  const totalIncome = invoices.rows
    .filter(r => r.paid)
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  addSummaryRow('Gross Income (Paid Invoices)', 'Line 1', totalIncome);
  summarySheet.addRow({});

  // Expenses
  addSummaryHeader('EXPENSES');
  summarySheet.addRow({ label: 'Category', line: 'Schedule C', amount: 'Amount' }).font = { bold: true, italic: true };

  const expenseTotals = expenses.rows.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0);
    return acc;
  }, {});

  let totalExpenses = 0;
  for (const { label, key, line } of SCHEDULE_C_LINES) {
    let amount;
    if (key === '__other_combined') {
      amount = (expenseTotals['advertising'] || 0) + (expenseTotals['other'] || 0);
    } else {
      amount = expenseTotals[key] || 0;
    }
    if (key === 'meals') amount = amount * 0.5;
    addSummaryRow(key === 'meals' ? `${label} (50% deductible)` : label, line, amount);
    totalExpenses += amount;
  }

  // Mileage
  const totalMiles = trips.rows.reduce((sum, t) => sum + parseFloat(t.miles || 0), 0);
  const mileageDeduction = totalMiles * IRS_RATE;
  addSummaryRow(`Mileage (${totalMiles.toFixed(1)} mi @ $${IRS_RATE}/mi)`, 'Line 9', mileageDeduction);
  totalExpenses += mileageDeduction;

  summarySheet.addRow({});
  addSummaryTotal('Total Expenses', totalExpenses);
  summarySheet.addRow({});
  addSummaryTotal('Net Profit', totalIncome - totalExpenses);

  // --- Income sheet ---
  const incomeSheet = workbook.addWorksheet('Income');
  incomeSheet.columns = [
    { header: 'Client',         key: 'client',         width: 24 },
    { header: 'Invoice #',      key: 'invoice_number', width: 16 },
    { header: 'Invoice Date',   key: 'invoice_date',   width: 14 },
    { header: 'Amount',         key: 'amount',         width: 14 },
    { header: 'Paid',           key: 'paid',           width: 8  },
  ];
  incomeSheet.getRow(1).font = { bold: true };
  invoices.rows.forEach(row => incomeSheet.addRow({
    ...row,
    invoice_date: row.invoice_date ? new Date(row.invoice_date).toLocaleDateString() : '',
    paid: row.paid ? 'Yes' : 'No',
  }));

  // --- Expenses sheet ---
  const expensesSheet = workbook.addWorksheet('Expenses');
  expensesSheet.columns = [
    { header: 'Date',        key: 'expense_date', width: 14 },
    { header: 'Category',    key: 'category',     width: 24 },
    { header: 'Description', key: 'description',  width: 30 },
    { header: 'Amount',      key: 'amount',       width: 14 },
  ];
  expensesSheet.getRow(1).font = { bold: true };
  expenses.rows.forEach(row => expensesSheet.addRow({
    ...row,
    category: CATEGORY_LABELS[row.category] || row.category,
    expense_date: row.expense_date ? new Date(row.expense_date).toLocaleDateString() : '',
  }));

  // --- Trips sheet ---
  const tripsSheet = workbook.addWorksheet('Trips');
  tripsSheet.columns = [
    { header: 'Date',                              key: 'trip_date',  width: 14 },
    { header: 'Miles',                             key: 'miles',      width: 10 },
    { header: 'Purpose',                           key: 'purpose',    width: 30 },
    { header: `IRS Deduction (@ $${IRS_RATE}/mi)`, key: 'deduction', width: 24 },
  ];
  tripsSheet.getRow(1).font = { bold: true };
  trips.rows.forEach(row => tripsSheet.addRow({
    ...row,
    trip_date: row.trip_date ? new Date(row.trip_date).toLocaleDateString() : '',
    deduction: (parseFloat(row.miles) * IRS_RATE).toFixed(2),
  }));

  const filename = yearFilter ? `kellam-analytics-${yearFilter}.xlsx` : 'kellam-analytics.xlsx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
