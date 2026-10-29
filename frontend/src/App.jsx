import { useState, useEffect, useCallback } from 'react'
import CSVUpload from './components/CSVUpload'
import InventoryTable from './components/InventoryTable'
import PipelinePanel from './components/PipelinePanel'
import { exportCSV } from './utils/csvUtils'
import { applyPipeline, splitCondition } from './utils/pricingPipeline'
import './App.css'

function App() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [baseline, setBaseline] = useState({ type: 'baseline', percent: 105, shippingCost: 0.70 })
  const [rules, setRules] = useState([])
  const [ignoreZeroQty, setIgnoreZeroQty] = useState(() => {
    try {
      return localStorage.getItem('mm-ignore-zero-qty') !== '0'
    } catch {
      return true
    }
  })
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('mm-dark-mode') === '1'
    } catch {
      return false
    }
  })
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('mm-dark-mode', darkMode ? '1' : '0')
    } catch {
      // storage unavailable — setting just won't persist
    }
  }, [darkMode])

  useEffect(() => {
    try {
      localStorage.setItem('mm-ignore-zero-qty', ignoreZeroQty ? '1' : '0')
    } catch {
      // storage unavailable — setting just won't persist
    }
  }, [ignoreZeroQty])

  const handleUpload = useCallback((data) => {
    // By default, completely ignore items with 0 total quantity.
    const rows = ignoreZeroQty
      ? data.filter((item) => (parseInt(item['Total Quantity']) || 0) !== 0)
      : data
    // Store the original marketplace price and split the combined
    // Condition column into pure Condition + Edition (foil variants included).
    // Each item gets a stable _uid so price edits target the right row
    // regardless of pagination, sorting, or filtering.
    const withOriginalPrice = rows.map((item, i) => {
      const { condition, edition } = splitCondition(item['Condition'])
      return {
        ...item,
        Condition: condition,
        Edition: edition,
        _originalPrice: parseFloat(item['TCG Marketplace Price']) || 0,
        _uid: `${Date.now()}-${i}`,
      }
    })
    setInventory(withOriginalPrice)
  }, [ignoreZeroQty])

  const handlePriceEdit = useCallback((uid, newPrice) => {
    const price = Math.round(newPrice * 100) / 100
    setInventory((prev) =>
      prev.map((item) =>
        item._uid === uid ? { ...item, 'TCG Marketplace Price': price.toFixed(2) } : item
      )
    )
  }, [])

  const runPipeline = useCallback(() => {
    setLoading(true)
    setError('')
    try {
      const steps = [baseline, ...rules]
      const updated = applyPipeline(inventory, steps)
      setInventory(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inventory, baseline, rules])

  const handleExport = () => {
    // Recombine Condition + Edition into the single Condition column
    // TCGplayer expects, and drop the internal Edition column.
    const forExport = inventory.map(({ Edition, _uid, ...rest }) => ({
      ...rest,
      Condition: [rest.Condition, Edition].filter(Boolean).join(' '),
    }))
    exportCSV(forExport)
  }

  return (
    <div className={"app" + (darkMode ? " dark" : "")}>
      <header className="app-header">
        <h1>🃏 TCG Marketplace Pricing Manager</h1>
        <div className="app-right">
          <button className="btn-dark-toggle" onClick={() => setShowHelp(true)}>
            ❓
          </button>
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
          <CSVUpload
            onUpload={handleUpload}
            disabled={loading}
            ignoreZeroQty={ignoreZeroQty}
            onIgnoreZeroQtyChange={setIgnoreZeroQty}
          />
          <PipelinePanel
            baseline={baseline}
            setBaseline={setBaseline}
            rules={rules}
            setRules={setRules}
            onRun={runPipeline}
            canRun={inventory.length > 0}
            disabled={loading}
            inventory={inventory}
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

          <InventoryTable inventory={inventory} onPriceEdit={handlePriceEdit} darkMode={darkMode} />
        </main>
      </div>

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-header">
              <h2>How to Use</h2>
              <button className="help-close" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <ol className="help-steps">
              <li>
                <strong>TCGplayer Seller Portal</strong> — Go to the Pricing tab and export your live inventory to a CSV file.
              </li>
              <li>
                <strong>Upload & Build Pipeline</strong> — Upload the CSV here (the original TCGplayer export, or the enhanced version from the CardSalesData pipeline which adds Avg Daily Sold and Release Date). Then build your pricing pipeline: baseline first, then as many rules as you like — reorder, add, or remove steps, and hit "Run Pipeline".
              </li>
              <li>
                <strong>Review & Edit</strong> — Sort your inventory and click on any price in the table to manually modify outliers.
              </li>
              <li>
                <strong>Export</strong> — Click "Export Updated CSV" to download your modified pricing.
              </li>
              <li>
                <strong>TCGplayer Staged Inventory</strong> — In the Pricing tab, go to Staged Inventory. Clear any existing staged items, then import your exported CSV.
              </li>
              <li>
                <strong>Confirm Changes</strong> — Confirm the changes to push them to your live inventory.
              </li>
              <li>
                <strong>⏳ Patience</strong> — If you're updating many items, it can take a while for prices to actually update in your inventory.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
