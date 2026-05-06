import { useState } from 'react'

export default function PDFPreview({ pdfData, onApprove, loading }) {
  const [editMode, setEditMode] = useState(false)
  const [editedMessage, setEditedMessage] = useState(pdfData.cover_message)
  const [action, setAction] = useState(null)

  if (action === 'skipped') {
    return (
      <div className="bg-white border border-scaler-border rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[300px] shadow-sm">
        <span className="text-4xl">⏭</span>
        <p className="text-scaler-slate text-sm">PDF skipped — not sent to lead.</p>
      </div>
    )
  }

  if (action === 'approved') {
    return (
      <div className="bg-white border border-green-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[300px] shadow-sm">
        <span className="text-4xl">✅</span>
        <p className="text-scaler-oxford font-semibold">PDF sent to lead on WhatsApp</p>
        <a href={pdfData.pdf_url} target="_blank" rel="noreferrer" className="text-scaler-blue text-sm hover:underline">View PDF →</a>
      </div>
    )
  }

  return (
    <div className="bg-white border border-scaler-border rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <h3 className="text-sm font-semibold text-scaler-oxford">Lead PDF — Awaiting BDA Approval</h3>
      </div>

      {/* PDF Preview */}
      <div className="rounded-xl overflow-hidden border border-scaler-border bg-scaler-cultured">
        <iframe
          src={pdfData.pdf_url}
          className="w-full h-64"
          title="Lead PDF Preview"
        />
      </div>
      <a href={pdfData.pdf_url} target="_blank" rel="noreferrer"
        className="text-scaler-blue text-xs hover:underline block text-right">
        Open full PDF →
      </a>

      {/* Cover message */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-scaler-slate font-medium">WhatsApp Cover Message to Lead</label>
          <button onClick={() => setEditMode(!editMode)} className="text-xs text-scaler-blue hover:underline">
            {editMode ? 'Cancel edit' : 'Edit'}
          </button>
        </div>
        {editMode ? (
          <textarea
            value={editedMessage}
            onChange={e => setEditedMessage(e.target.value)}
            rows={4}
            className="w-full bg-scaler-cultured border border-scaler-blue/40 rounded-lg px-3 py-2.5 text-scaler-oxford text-sm focus:outline-none resize-none focus:border-scaler-blue"
          />
        ) : (
          <div className="bg-[#075E54]/10 border border-[#075E54]/20 rounded-xl p-3">
            <p className="text-scaler-oxford text-sm whitespace-pre-wrap leading-relaxed">{editedMessage}</p>
          </div>
        )}
      </div>

      {/* Approval actions */}
      <div className="flex gap-3 pt-1">
        <button
          disabled={loading}
          onClick={async () => {
            await onApprove('approve', editedMessage)
            setAction('approved')
          }}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Sending...' : '✓ Approve & Send'}
        </button>
        <button
          disabled={loading}
          onClick={() => {
            onApprove('skip', null)
            setAction('skipped')
          }}
          className="px-4 bg-scaler-cultured hover:bg-scaler-border border border-scaler-border text-scaler-slate hover:text-scaler-oxford font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          Skip
        </button>
      </div>

      <p className="text-xs text-scaler-slate text-center">Nothing goes to the lead until you approve.</p>
    </div>
  )
}
