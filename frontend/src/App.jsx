import { useState, useCallback } from 'react'
import CSVUpload from './components/CSVUpload'
import InventoryTable from './components/InventoryTable'
import PipelinePanel from './components/PipelinePanel'
import SalesDataUpload from './components/SalesDataUpload'
import { exportCSV } from './utils/csvUtils'
import { applyPipeline, splitCondition } from './utils/pricingPipeline'
import './App.css'

function App() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [baseline, setBaseline] = useState({ type: 'baseline', percent: 105, shippingCost: 0.70 })
  const [rules, setRules] = useState([])
  const [ignoreZeroQty, setIgnoreZeroQty] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const handleUpload = useCallback((data) => {
    // Store the original marketplace price and split the combined
    // Condition column into pure Condition + Edition (foil variants included).
    const withOriginalPrice = data.map((item) => {
      const { condition, edition } = splitCondition(item['Condition'])
      return {
        ...item,
        Condition: condition,
        Edition: edition,
        _originalPrice: parseFloat(item['TCG Marketplace Price']) || 0,
      }
    })
    setInventory(withOriginalPrice)
  }, [])

  const handlePriceEdit = useCallback((index, newPrice) => {
    const updated = [...inventory]
    const price = Math.round(newPrice * 100) / 100
    updated[index] = { ...updated[index], 'TCG Marketplace Price': price.toFixed(2) }
    setInventory(updated)
  }, [inventory])

  const runPipeline = useCallback(() => {
    setLoading(true)
    setError('')
    try {
      const steps = [baseline, ...rules]
      const updated = applyPipeline(inventory, steps, ignoreZeroQty)
      setInventory(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inventory, baseline, rules, ignoreZeroQty])

  const handleExport = () => {
    // Recombine Condition + Edition into the single Condition column
    // TCGplayer expects, and drop the internal Edition column.
    const forExport = inventory.map(({ Edition, ...rest }) => ({
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
          <CSVUpload onUpload={handleUpload} disabled={loading} />
          <SalesDataUpload
            inventory={inventory}
            onMerge={setInventory}
            disabled={loading}
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
            ignoreZeroQty={ignoreZeroQty}
          />
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
                <strong>Upload & Build Pipeline</strong> — Upload the CSV here. Optionally merge a sales-data CSV (from the CardSalesData pipeline) to add Avg Daily Sold. Then build your pricing pipeline: baseline first, then as many rules as you like — reorder, add, or remove steps, and hit "Run Pipeline".
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
