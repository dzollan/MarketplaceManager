import { useState, useCallback } from 'react'
import CSVUpload from './components/CSVUpload'
import InventoryTable from './components/InventoryTable'
import InventoryGrid from './components/InventoryGrid'
import PricingRules from './components/PricingRules'
import { API_URL } from './config'
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

  const handleUpload = useCallback(async (fileName) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/inventory`)
      const data = await res.json()
      setInventory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const applyBaseline = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await fetch(`${API_URL}/api/pricing/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent: baselinePercent, shippingCost: baselineShip }),
      })
      const res = await fetch(`${API_URL}/api/inventory`)
      const data = await res.json()
      setInventory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [baselinePercent, baselineShip])

  const applyRules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await fetch(`${API_URL}/api/pricing/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      })
      const res = await fetch(`${API_URL}/api/inventory`)
      const data = await res.json()
      setInventory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [rules])

  const handleExport = () => {
    window.open(`${API_URL}/api/export`, '_blank')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 TCG Marketplace Pricing Manager</h1>
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
