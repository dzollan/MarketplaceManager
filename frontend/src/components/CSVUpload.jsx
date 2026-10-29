import { useRef, useCallback, useState } from 'react'
import { parseCSV } from '../utils/csvUtils'

export default function CSVUpload({ onUpload, disabled, ignoreZeroQty, onIgnoreZeroQtyChange }) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleChange = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadError('')
    setUploading(true)

    try {
      const data = await parseCSV(file)
      onUpload(data)
    } catch (err) {
      setUploadError(`Failed to parse CSV: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onUpload])

  return (
    <div className="card">
      <h2>📂 Upload Inventory CSV</h2>
      <p className="card-desc">
        Upload your TCG Player pricing export (.csv) — the original export or the
        enhanced version from the CardSalesData pipeline (adds <em>Avg Daily Sold</em>,
        Release Date, Product Id &amp; URL).
      </p>
      {uploadError && <div className="error-banner">{uploadError}</div>}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        disabled={disabled || uploading}
        className="file-input"
      />
      <button
        className="btn btn-primary"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? 'Uploading...' : 'Choose CSV File'}
      </button>
      <div className="card-row checkbox-row">
        <input
          type="checkbox"
          id="ignoreZeroQty"
          checked={ignoreZeroQty}
          onChange={(e) => onIgnoreZeroQtyChange(e.target.checked)}
        />
        <label htmlFor="ignoreZeroQty">Ignore 0-qty items on upload</label>
      </div>
    </div>
  )
}
