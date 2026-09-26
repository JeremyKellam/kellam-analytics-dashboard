import React, { useState, useEffect } from 'react';
import IncomeTab from './components/IncomeTab';
import ExpensesTab from './components/ExpensesTab';
import TripsTab from './components/TripsTab';
import SummaryTab from './components/SummaryTab';
import { exportToExcel, getYears } from './api';
import './App.css';

const TABS = ['Summary', 'Income', 'Expenses', 'Trips'];

function App() {
  const [activeTab, setActiveTab] = useState('Summary');
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey') || '');
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (apiKey) {
      getYears().then((r) => setAvailableYears(r.data)).catch((err) => console.error('getYears failed:', err));
    }
  }, [apiKey]);

  if (!apiKey) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          localStorage.setItem('apiKey', keyInput);
          setApiKey(keyInput);
          setAuthError(false);
        }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
          <h2 style={{ margin: 0 }}>Kellam Analytics</h2>
          <input
            type="password"
            placeholder="Password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
          />
          {authError && <span style={{ color: 'red', fontSize: '0.85em' }}>Incorrect password</span>}
          <button type="submit">Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Kellam Analytics</h1>
        <nav>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
          <button onClick={() => {
            setShowExportMenu(true);
            getYears().then((r) => setAvailableYears(r.data)).catch((err) => console.error('getYears failed:', err));
          }}>Export</button>
          {showExportMenu && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowExportMenu(false)}>
              <div style={{ background: '#fff', borderRadius: 10, padding: '24px 32px', minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
                onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Export Year</h3>
                {availableYears.length === 0
                  ? <p style={{ color: '#999', fontSize: 14, margin: '0 0 12px' }}>No data to export yet.</p>
                  : availableYears.map(y => (
                    <button key={y} style={{ display: 'block', width: '100%', marginBottom: 8, fontSize: 15, color: '#111', background: '#f5f5f5', border: '1px solid #ddd' }}
                      onClick={() => { exportToExcel(y); setShowExportMenu(false); }}>
                      {y}
                    </button>
                  ))
                }
                <button style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 14, background: 'none', color: '#999', border: '1px solid #ddd' }}
                  onClick={() => setShowExportMenu(false)}>Cancel</button>
              </div>
            </div>
          )}
        </nav>
      </header>
      <main>
        {activeTab === 'Summary' && <SummaryTab availableYears={availableYears} />}
        {activeTab === 'Income' && <IncomeTab availableYears={availableYears} />}
        {activeTab === 'Expenses' && <ExpensesTab availableYears={availableYears} />}
        {activeTab === 'Trips' && <TripsTab availableYears={availableYears} />}
      </main>
    </div>
  );
}

export default App;
