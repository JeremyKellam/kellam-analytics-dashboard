import React, { useEffect, useState } from 'react';
import { getExpenses, addExpense, updateExpense, deleteExpense, getReceiptUrl } from '../api';

const CATEGORIES = {
  advertising: 'Advertising',
  contract_labor: 'Contract Labor',
  depreciation: 'Depreciation',
  professional_fees: 'Legal & Professional Fees',
  office_expense: 'Office Expense',
  supplies: 'Supplies',
  taxes_licenses: 'Taxes & Licenses',
  travel: 'Travel',
  meals: 'Meals',
  utilities: 'Utilities',
  other: 'Other',
};

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function ExpensesTab({ availableYears = [] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({
    category: 'advertising',
    amount: '',
    description: '',
    expense_date: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editReceiptFile, setEditReceiptFile] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const load = () => getExpenses({ year }).then((r) => setExpenses(r.data));

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      setYear(availableYears[0]);
    }
  }, [availableYears]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    const [y, m] = form.expense_date.split('-').map(Number);
    await addExpense({
      ...form,
      year: y,
      month: m,
      receipt: receiptFile || undefined,
    });
    load();
    setForm({ category: 'advertising', amount: '', description: '', expense_date: '' });
    setReceiptFile(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    await updateExpense(editForm.id, {
      category: editForm.category,
      amount: editForm.amount,
      description: editForm.description,
      expense_date: editForm.expense_date,
      receipt: editReceiptFile || undefined,
      remove_receipt: editForm.removeReceipt ? 'true' : undefined,
    });
    load();
    setEditForm(null);
    setEditReceiptFile(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await deleteExpense(id);
    load();
  };

  const handleViewReceipt = async (id) => {
    const res = await getReceiptUrl(id);
    window.open(res.data.url, '_blank');
  };

  const filtered = expenses.filter((e) => {
    if (filterCategory && e.category !== filterCategory) return false;
    const d = e.expense_date.slice(0, 10);
    if (filterDateFrom && d < filterDateFrom) return false;
    if (filterDateTo && d > filterDateTo) return false;
    return true;
  });

  const totals = filtered.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount);
    return acc;
  }, {});

  return (
    <div>
      <div className="year-selector">
        <label>Year</label>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {(availableYears.length > 0 ? availableYears : [now.getFullYear()]).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <h2>Add Expense</h2>
        <form onSubmit={handleSubmit}>
          <label>Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Amount
            <input type="number" step="0.01" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00" required />
          </label>
          <label>Date
            <input type="date" value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              required />
          </label>
          <label>Description
            <input type="text" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional" />
          </label>
          <label>Receipt
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
              onChange={(e) => setReceiptFile(e.target.files[0] || null)} />
          </label>
          <button type="submit" className="primary">Add</button>
        </form>
      </div>

      <div className="card">
        <h2>Category Totals — {year}</h2>
        <div className="grid-4" style={{ marginBottom: 0 }}>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <div className="stat" key={k}>
              <label>{v}</label>
              <div className="value negative">{fmt(totals[k] || 0)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>All Expenses — {year}</h2>
        <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: 16 }}>
          <label>Category
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>From
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </label>
          <label>To
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </label>
          {(filterCategory || filterDateFrom || filterDateTo) && (
            <button className="small" type="button" onClick={() => { setFilterCategory(''); setFilterDateFrom(''); setFilterDateTo(''); }}>Clear</button>
          )}
        </form>
        {filtered.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No expenses logged.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <React.Fragment key={e.id}>
                  <tr>
                    <td>{new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</td>
                    <td>{CATEGORIES[e.category]}</td>
                    <td>{fmt(e.amount)}</td>
                    <td>{e.description || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {e.receipt_path && (
                        <button className="small" onClick={() => handleViewReceipt(e.id)}>Receipt</button>
                      )}
                      <button className="small" onClick={() => { setEditForm({ id: e.id, category: e.category, amount: e.amount, description: e.description || '', expense_date: e.expense_date.slice(0, 10), hasReceipt: !!e.receipt_path, removeReceipt: false }); setEditReceiptFile(null); }}>Edit</button>
                      <button className="danger" onClick={() => handleDelete(e.id)}>Delete</button>
                    </td>
                  </tr>
                  {editForm && editForm.id === e.id && (
                    <tr>
                      <td colSpan={5} style={{ background: '#fafafa', padding: '8px 24px' }}>
                        <form onSubmit={handleEdit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <label>Category
                            <select value={editForm.category} onChange={(ev) => setEditForm({ ...editForm, category: ev.target.value })}>
                              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </label>
                          <label>Amount
                            <input type="number" step="0.01" value={editForm.amount}
                              onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })}
                              required />
                          </label>
                          <label>Date
                            <input type="date" value={editForm.expense_date}
                              onChange={(ev) => setEditForm({ ...editForm, expense_date: ev.target.value })}
                              required />
                          </label>
                          <label>Description
                            <input type="text" value={editForm.description}
                              onChange={(ev) => setEditForm({ ...editForm, description: ev.target.value })} />
                          </label>
                          <label>Receipt
                            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
                              onChange={(ev) => { setEditReceiptFile(ev.target.files[0] || null); setEditForm({ ...editForm, removeReceipt: false }); }} />
                          </label>
                          {editForm.hasReceipt && !editReceiptFile && (
                            <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, fontSize: 13 }}>
                              <input type="checkbox" checked={editForm.removeReceipt}
                                onChange={(ev) => setEditForm({ ...editForm, removeReceipt: ev.target.checked })} />
                              Remove receipt
                            </label>
                          )}
                          <button type="submit" className="primary">Save</button>
                          <button type="button" className="danger" onClick={() => { setEditForm(null); setEditReceiptFile(null); }}>Cancel</button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
