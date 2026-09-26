import React, { useEffect, useState } from 'react';
import { getTrips, getTripSummary, addTrip, updateTrip, deleteTrip } from '../api';

const IRS_RATE = 0.70; // 2024 IRS mileage rate

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function TripsTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [trips, setTrips] = useState([]);
  const [summary, setSummary] = useState([]);
  const [form, setForm] = useState({ trip_date: '', miles: '', purpose: '' });
  const [editForm, setEditForm] = useState(null);

  const load = () => {
    getTrips({ year }).then((r) => setTrips(r.data));
    getTripSummary({ year }).then((r) => setSummary(r.data));
  };

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addTrip(form);
    load();
    setForm({ trip_date: '', miles: '', purpose: '' });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    await updateTrip(editForm.id, { trip_date: editForm.trip_date, miles: editForm.miles, purpose: editForm.purpose });
    load();
    setEditForm(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trip?')) return;
    await deleteTrip(id);
    load();
  };

  const yearSummary = summary.find((s) => parseInt(s.year) === year);
  const totalMiles = parseFloat(yearSummary?.total_miles || 0);
  const deduction = totalMiles * IRS_RATE;

  const years = [];
  for (let y = now.getFullYear(); y >= 2020; y--) years.push(y);

  return (
    <div>
      <div className="year-selector">
        <label>Year</label>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat">
          <label>Total Trips</label>
          <div className="value">{yearSummary?.trip_count || 0}</div>
        </div>
        <div className="stat">
          <label>Total Miles</label>
          <div className="value">{totalMiles.toFixed(1)}</div>
        </div>
        <div className="stat">
          <label>IRS Rate ({year})</label>
          <div className="value">${IRS_RATE.toFixed(2)}/mi</div>
        </div>
        <div className="stat">
          <label>Est. Deduction</label>
          <div className="value positive">{fmt(deduction)}</div>
        </div>
      </div>

      <div className="card">
        <h2>Log Trip</h2>
        <form onSubmit={handleSubmit}>
          <label>Date
            <input type="date" value={form.trip_date}
              onChange={(e) => setForm({ ...form, trip_date: e.target.value })}
              required />
          </label>
          <label>Miles
            <input type="number" step="0.1" value={form.miles}
              onChange={(e) => setForm({ ...form, miles: e.target.value })}
              placeholder="0.0" required />
          </label>
          <label>Purpose
            <input type="text" value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g. Client meeting" />
          </label>
          <button type="submit" className="primary">Log</button>
        </form>
      </div>

      <div className="card">
        <h2>Trip Log — {year}</h2>
        {trips.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No trips logged.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Miles</th>
                <th>Deduction Value</th>
                <th>Purpose</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <React.Fragment key={t.id}>
                  <tr>
                    <td>{new Date(t.trip_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</td>
                    <td>{parseFloat(t.miles).toFixed(1)}</td>
                    <td>{fmt(parseFloat(t.miles) * IRS_RATE)}</td>
                    <td>{t.purpose || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="small" onClick={() => setEditForm({ id: t.id, trip_date: t.trip_date.slice(0, 10), miles: t.miles, purpose: t.purpose || '' })}>Edit</button>
                      <button className="danger" onClick={() => handleDelete(t.id)}>Delete</button>
                    </td>
                  </tr>
                  {editForm && editForm.id === t.id && (
                    <tr>
                      <td colSpan={5} style={{ background: '#fafafa', padding: '8px 24px' }}>
                        <form onSubmit={handleEdit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <label>Date
                            <input type="date" value={editForm.trip_date}
                              onChange={(e) => setEditForm({ ...editForm, trip_date: e.target.value })}
                              required />
                          </label>
                          <label>Miles
                            <input type="number" step="0.1" value={editForm.miles}
                              onChange={(e) => setEditForm({ ...editForm, miles: e.target.value })}
                              required />
                          </label>
                          <label>Purpose
                            <input type="text" value={editForm.purpose}
                              onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} />
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
