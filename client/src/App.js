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
      getYears().then((r) => setAvailableYears(r.data)).catch(() => {});
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
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button onClick={() => setShowExportMenu(v => !v)}>Export</button>
            {showExportMenu && availableYears.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 6, zIndex: 100, minWidth: 80, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {availableYears.map(y => (
                  <div key={y}
                    style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}
                    onMouseEnter={e => e.target.style.background='#f5f5f5'}
                    onMouseLeave={e => e.target.style.background='transparent'}
                    onClick={() => { exportToExcel(y); setShowExportMenu(false); }}>
                    {y}
                  </div>
                ))}
              </div>
            )}
          </div>
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
