import React, { useEffect, useState } from 'react';
import { getMonthlySummary } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function SummaryTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState({ income: [], expenses: [] });

  useEffect(() => {
    getMonthlySummary({ year }).then((r) => setData(r.data));
  }, [year]);

  // Build chart data: one row per month
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const inc = data.income.find((r) => parseInt(r.month) === month);
    const exps = data.expenses.filter((r) => parseInt(r.month) === month);
    const totalExpenses = exps.reduce((sum, e) => sum + parseFloat(e.total || 0), 0);
    const collected = parseFloat(inc?.total_collected || 0);
    return {
      name: MONTHS[i],
      Income: collected,
      Expenses: totalExpenses,
      Net: collected - totalExpenses,
    };
  });

  const totalIncome = chartData.reduce((s, r) => s + r.Income, 0);
  const totalExpenses = chartData.reduce((s, r) => s + r.Expenses, 0);
  const netProfit = totalIncome - totalExpenses;
  const activeMonths = chartData.filter((r) => r.Income > 0 || r.Expenses > 0).length || 1;

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) years.push(y);

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
          <label>Gross Income</label>
          <div className="value positive">{fmt(totalIncome)}</div>
        </div>
        <div className="stat">
          <label>Total Expenses</label>
          <div className="value negative">{fmt(totalExpenses)}</div>
        </div>
        <div className="stat">
          <label>Net Profit</label>
          <div className={`value ${netProfit >= 0 ? 'positive' : 'negative'}`}>{fmt(netProfit)}</div>
        </div>
        <div className="stat">
          <label>Avg Monthly Net</label>
          <div className={`value ${netProfit >= 0 ? 'positive' : 'negative'}`}>{fmt(netProfit / activeMonths)}</div>
        </div>
      </div>

      <div className="card">
        <h2>Monthly Income vs Expenses</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            <Bar dataKey="Income" fill="#16a34a" />
            <Bar dataKey="Expenses" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2>Monthly Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net Profit</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{fmt(row.Income)}</td>
                <td>{fmt(row.Expenses)}</td>
                <td style={{ color: row.Net >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {fmt(row.Net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
