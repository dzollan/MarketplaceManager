import { useRef, useCallback, useState } from 'react'
import { API_URL } from '../config'

export default function CSVUpload({ onUpload, disabled }) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleChange = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      onUpload(file.name)
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }, [onUpload])

  return (
    <div className="card">
      <h2>📂 Upload Inventory CSV</h2>
      <p className="card-desc">
        Upload your TCG Player pricing export (.csv)
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
    </div>
  )
}
