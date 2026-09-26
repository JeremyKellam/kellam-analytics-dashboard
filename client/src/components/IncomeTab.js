import React, { useEffect, useState } from 'react';
import { getInvoices, createInvoice, updateInvoice, toggleInvoicePaid, deleteInvoice, parseInvoice, getInvoiceReceiptUrl } from '../api';

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function IncomeTab({ availableYears = [] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({ client: '', invoice_number: '', invoice_date: '', due_date: '', amount: '' });
  const [editForm, setEditForm] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);

  const load = () => getInvoices({ year }).then((r) => setInvoices(r.data));

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      setYear(availableYears[0]);
    }
  }, [availableYears]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUploadInvoice = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setParsing(true);
    setParseResult(null);
    try {
      const res = await parseInvoice(file);
      setParseResult(res.data);
      setForm({
        client: res.data.client || '',
        invoice_number: res.data.invoice_number || '',
        invoice_date: res.data.invoice_date || '',
        due_date: res.data.due_date || '',
        amount: res.data.amount || '',
      });
    } catch (err) {
      alert('Failed to parse invoice: ' + (err.response?.data?.error || err.message));
    }
    setParsing(false);
    // Reset file input
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createInvoice(form);
    load();
    setForm({ client: '', invoice_number: '', invoice_date: '', due_date: '', amount: '' });
    setParseResult(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    await updateInvoice(editForm.id, {
      client: editForm.client,
      invoice_number: editForm.invoice_number,
      invoice_date: editForm.invoice_date,
      due_date: editForm.due_date,
      amount: editForm.amount,
    });
    load();
    setEditForm(null);
  };

  const handleTogglePaid = async (id) => {
    await toggleInvoicePaid(id, receiptFile || null);
    load();
    setReceiptFile(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    await deleteInvoice(id);
    load();
  };

  const handleViewReceipt = async (id) => {
    const res = await getInvoiceReceiptUrl(id);
    window.open(res.data.url, '_blank');
  };

  const totalIncome = invoices.reduce((s, inv) => s + parseFloat(inv.amount || 0), 0);
  const totalPaid = invoices.filter(i => i.paid).reduce((s, inv) => s + parseFloat(inv.amount || 0), 0);

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

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat">
          <label>Total Invoiced</label>
          <div className="value">{fmt(totalIncome)}</div>
        </div>
        <div className="stat">
          <label>Total Paid</label>
          <div className="value positive">{fmt(totalPaid)}</div>
        </div>
        <div className="stat">
          <label>Outstanding</label>
          <div className="value negative">{fmt(totalIncome - totalPaid)}</div>
        </div>
        <div className="stat">
          <label>Invoice Count</label>
          <div className="value">{invoices.length}</div>
        </div>
      </div>

      <div className="card">
        <h2>Upload Invoice</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500 }}>
            Upload a PDF or image to auto-extract fields
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
              onChange={handleUploadInvoice}
              disabled={parsing} />
          </label>
          {parsing && <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Parsing invoice with AI...</p>}
        </div>

        <h2>{parseResult ? 'Confirm Parsed Invoice' : 'Add Invoice'}</h2>
        <form onSubmit={handleSubmit}>
          <label>Client
            <input type="text" value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              placeholder="Client name" required />
          </label>
          <label>Invoice #
            <input type="text" value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              placeholder="INV-001" />
          </label>
          <label>Invoice Date
            <input type="date" value={form.invoice_date}
              onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
              required />
          </label>
          <label>Due Date
            <input type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </label>
          <label>Amount
            <input type="number" step="0.01" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00" required />
          </label>
          <button type="submit" className="primary">{parseResult ? 'Confirm & Save' : 'Add'}</button>
          {parseResult && (
            <button type="button" className="danger" onClick={() => {
              setParseResult(null);
              setForm({ client: '', invoice_number: '', invoice_date: '', due_date: '', amount: '' });
            }}>Cancel</button>
          )}
        </form>
      </div>

      <div className="card">
        <h2>Invoices — {year}</h2>
        {invoices.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No invoices for this year.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <React.Fragment key={inv.id}>
                  <tr>
                    <td>{inv.invoice_number || '—'}</td>
                    <td>{inv.client}</td>
                    <td>{new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</td>
                    <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'}</td>
                    <td>{fmt(inv.amount)}</td>
                    <td><span className={`badge ${inv.paid ? 'paid' : 'unpaid'}`}>{inv.paid ? 'Paid' : 'Unpaid'}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {inv.receipt_path && (
                        <button className="small" onClick={() => handleViewReceipt(inv.id)}>Receipt</button>
                      )}
                      <button className="small" onClick={() => handleTogglePaid(inv.id)}>
                        {inv.paid ? 'Unmark Paid' : 'Mark Paid'}
                      </button>
                      <button className="small" onClick={() => setEditForm({
                        id: inv.id,
                        client: inv.client,
                        invoice_number: inv.invoice_number || '',
                        invoice_date: inv.invoice_date ? inv.invoice_date.slice(0, 10) : '',
                        due_date: inv.due_date ? inv.due_date.slice(0, 10) : '',
                        amount: inv.amount,
                      })}>Edit</button>
                      <button className="danger" onClick={() => handleDelete(inv.id)}>Delete</button>
                    </td>
                  </tr>
                  {editForm && editForm.id === inv.id && (
                    <tr>
                      <td colSpan={7} style={{ background: '#fafafa', padding: '8px 24px' }}>
                        <form onSubmit={handleEdit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <label>Client
                            <input type="text" value={editForm.client}
                              onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                              required />
                          </label>
                          <label>Invoice #
                            <input type="text" value={editForm.invoice_number}
                              onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })} />
                          </label>
                          <label>Invoice Date
                            <input type="date" value={editForm.invoice_date}
                              onChange={(e) => setEditForm({ ...editForm, invoice_date: e.target.value })}
                              required />
                          </label>
                          <label>Due Date
                            <input type="date" value={editForm.due_date}
                              onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                          </label>
                          <label>Amount
                            <input type="number" step="0.01" value={editForm.amount}
                              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                              required />
                          </label>
                          <button type="submit" className="primary">Save</button>
                          <button type="button" className="danger" onClick={() => setEditForm(null)}>Cancel</button>
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
