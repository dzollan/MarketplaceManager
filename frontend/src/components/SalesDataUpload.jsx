import { useRef, useState } from 'react'
import { parseCSV } from '../utils/csvUtils'
import { mergeSalesData } from '../utils/pricingPipeline'

export default function SalesDataUpload({ inventory, onMerge, disabled }) {
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const handleChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setStatus('')

    try {
      const rows = await parseCSV(file)
      const required = ['TCGplayer Id', 'Avg Daily Sold']
      const present = Object.keys(rows[0] || {})
      const missing = required.filter((col) => !present.includes(col))
      if (missing.length > 0) {
        setError(`Sales CSV is missing column(s): ${missing.join(', ')}. Run the CardSalesData pipeline first.`)
        return
      }
      const { inventory: merged, matched } = mergeSalesData(inventory, rows)
      onMerge(merged)
      setStatus(`Merged sales data for ${matched} of ${inventory.length} items.`)
    } catch (err) {
      setError(`Failed to parse CSV: ${err.message}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="card">
      <h2>📈 Sales Data</h2>
      <p className="card-desc">
        Merge a CSV from the CardSalesData pipeline (adds <em>Avg Daily Sold</em>, Product Id &amp; URL).
      </p>
      {error && <div className="error-banner">{error}</div>}
      {status && <div className="success-banner">{status}</div>}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        disabled={disabled || inventory.length === 0}
        className="file-input"
      />
      <button
        className="btn btn-primary"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || inventory.length === 0}
      >
        Load Sales CSV
      </button>
    </div>
  )
}
