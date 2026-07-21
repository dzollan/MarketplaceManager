import { useState, useCallback } from 'react'
import CSVUpload from './components/CSVUpload'
import InventoryTable from './components/InventoryTable'
import InventoryGrid from './components/InventoryGrid'
import PricingRules from './components/PricingRules'
import { applyBaseline as doBaseline, applyRules as doRules, exportCSV } from './utils/csvUtils'
import './App.css'

function App() {
  const [inventory, setInventory] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [baselinePercent, setBaselinePercent] = useState(105)
  const [baselineShip, setBaselineShip] = useState(0.70)
  const [baselineEditing, setBaselineEditing] = useState(false)
  const [ignoreZeroQty, setIgnoreZeroQty] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const handleUpload = useCallback((data) => {
    // Store the original marketplace price
    const withOriginalPrice = data.map((item) => ({
      ...item,
      _originalPrice: parseFloat(item['TCG Marketplace Price']) || 0,
    }))
    setInventory(withOriginalPrice)
  }, [])

  const applyBaseline = useCallback(() => {
    setLoading(true)
    setError('')
    try {
      const updated = doBaseline(inventory, baselinePercent, baselineShip, ignoreZeroQty)
      setInventory(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inventory, baselinePercent, baselineShip, ignoreZeroQty])

  const applyRules = useCallback(() => {
    setLoading(true)
    setError('')
    try {
      const updated = doRules(inventory, rules, ignoreZeroQty)
      setInventory(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inventory, rules, ignoreZeroQty])

  const handleExport = () => {
    exportCSV(inventory)
  }

  return (
    <div className={"app" + (darkMode ? " dark" : "")}>
      <header className="app-header">
        <h1>🃏 TCG Marketplace Pricing Manager</h1>
        <div className="app-right">
          <button className="btn-dark-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="app-credits">
            by Raboot
            <span className="app-version">• Updated {new Date(__BUILD_TIME__).toLocaleString()}</span>
          </span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <CSVUpload onUpload={handleUpload} disabled={loading} />
          <div className="card">
            <div className="card-header">
              <h2>📊 Baseline Pricing</h2>
              <button
                className="btn-edit"
                onClick={() => setBaselineEditing(!baselineEditing)}
              >
                {baselineEditing ? '✓ Save' : '✎ Edit'}
              </button>
            </div>
            <p className="card-desc">
              Set all items to {baselinePercent}% of whichever is greater: market price or (TCG low + ship − ${baselineShip.toFixed(2)} shipping cost)
            </p>
            {baselineEditing && (
              <div className="baseline-settings">
                <div className="baseline-row">
                  <label>Markup %</label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={baselinePercent}
                    onChange={(e) => setBaselinePercent(Number(e.target.value))}
                    className="input-small"
                  />
                </div>
                <div className="baseline-row">
                  <label>Shipping cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baselineShip}
                    onChange={(e) => setBaselineShip(Number(e.target.value))}
                    className="input-small"
                  />
                </div>
              </div>
            )}
            <div className="card-row checkbox-row">
              <input
                type="checkbox"
                id="ignoreZeroQty"
                checked={ignoreZeroQty}
                onChange={(e) => setIgnoreZeroQty(e.target.checked)}
              />
              <label htmlFor="ignoreZeroQty">Skip items with 0 qty</label>
            </div>
            <button
              className="btn btn-baseline"
              onClick={applyBaseline}
              disabled={inventory.length === 0 || loading}
            >
              Apply Baseline
            </button>
          </div>
          <PricingRules
            rules={rules}
            setRules={setRules}
            onApply={applyRules}
            canApply={inventory.length > 0}
            disabled={loading}
          />
          <button
            className="btn btn-export"
            onClick={handleExport}
            disabled={inventory.length === 0}
          >
            📥 Export Updated CSV
          </button>
        </aside>

        <main className="main-content">
          {error && <div className="error-banner">{error}</div>}
          {loading && <div className="loading-banner">Processing...</div>}
          <div className="view-toggle">
            <button
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              ☰ Table
            </button>
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              ⊞ Grid
            </button>
          </div>
          {viewMode === 'table' ? (
            <InventoryTable inventory={inventory} />
          ) : (
            <InventoryGrid inventory={inventory} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
