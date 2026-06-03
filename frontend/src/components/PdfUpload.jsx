import { useState } from 'react'
import Alert from './Alert'
import LoadingSpinner from './LoadingSpinner'
import { uploadPdf } from '../services/api'

function PdfUpload({ userId }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (event) => {
    event.preventDefault()
    setError('')
    setStatus('')

    if (!file) {
      setError('Choose a PDF before uploading.')
      return
    }

    try {
      setIsUploading(true)
      const result = await uploadPdf({ file, userId })
      setStatus(`${result.filename || file.name} uploaded. ${result.chunks ?? 0} chunks indexed.`)
      setFile(null)
      event.currentTarget.reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="upload-panel">
      <div>
        <span className="eyebrow">Documents</span>
        <h2>Upload PDF</h2>
      </div>

      <form onSubmit={handleUpload}>
        <label className="file-picker">
          <input
            accept="application/pdf"
            disabled={isUploading}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            type="file"
          />
          <span>{file?.name || 'Choose PDF file'}</span>
        </label>

        <button className="secondary-button" disabled={isUploading} type="submit">
          {isUploading ? <LoadingSpinner label="Uploading" /> : 'Upload'}
        </button>
      </form>

      <Alert message={error} />
      <Alert message={status} type="success" />
    </section>
  )
}

export default PdfUpload
