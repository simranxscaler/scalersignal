import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || ''

export default function PDFPreview({ pdfData, lead: initialLead, transcriptDiarized, nameMismatch, warning, onApprove, loading }) {
  const { user } = useAuth()
  const [editMode, setEditMode] = useState(false)
  const [editedMessage, setEditedMessage] = useState(pdfData.cover_message)
  const [action, setAction] = useState(null)
  const [showTranscript, setShowTranscript] = useState(false)

  // Phone editing
  const [lead, setLead] = useState(initialLead)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValue, setPhoneValue] = useState(initialLead?.phone || '')
  const [savingPhone, setSavingPhone] = useState(false)

  async function savePhone() {
    if (!lead) return
    setSavingPhone(true)
    try {
      const token = await user.getIdToken()
      await fetch(`${API}/api/leads/${lead.id}/phone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phoneValue }),
      })
      setLead({ ...lead, phone: phoneValue })
      setEditingPhone(false)
    } finally {
      setSavingPhone(false)
    }
  }

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

      {/* Name mismatch warning */}
      {(nameMismatch || warning) && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
          <p className="text-amber-800 text-xs leading-relaxed">{warning || "Lead name not found in transcript — check you uploaded the right recording."}</p>
        </div>
      )}

      {/* Phone number row */}
      {lead && (
        <div className="flex items-center gap-2 bg-scaler-cultured border border-scaler-border rounded-xl px-3 py-2.5">
          <span className="text-scaler-slate text-xs font-medium shrink-0">WhatsApp</span>
          {editingPhone ? (
            <>
              <input
                type="tel"
                value={phoneValue}
                onChange={e => setPhoneValue(e.target.value)}
                maxLength={15}
                className="flex-1 bg-white border border-scaler-blue/40 rounded-lg px-2 py-1 text-scaler-oxford text-sm focus:outline-none focus:border-scaler-blue min-w-0"
                autoFocus
              />
              <button
                onClick={savePhone}
                disabled={savingPhone}
                className="text-xs bg-scaler-blue text-white font-semibold px-3 py-1 rounded-lg disabled:opacity-50 shrink-0"
              >
                {savingPhone ? '...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingPhone(false); setPhoneValue(lead.phone || '') }}
                className="text-xs text-scaler-slate hover:text-scaler-oxford shrink-0"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-scaler-oxford text-sm font-medium">{lead.phone || <span className="text-red-500">No number set</span>}</span>
              <button
                onClick={() => setEditingPhone(true)}
                className="text-xs text-scaler-blue hover:underline shrink-0"
              >
                Edit
              </button>
            </>
          )}
        </div>
      )}

      {/* PDF Preview */}
      <div className="rounded-xl overflow-hidden border border-scaler-border bg-scaler-cultured">
        <iframe
          src={pdfData.pdf_url.replace('/view', '/preview').replace('?usp=sharing', '')}
          className="w-full h-64"
          title="Lead PDF Preview"
          allow="autoplay"
        />
      </div>
      <a href={pdfData.pdf_url} target="_blank" rel="noreferrer"
        className="text-scaler-blue text-xs hover:underline block text-right">
        Open full PDF →
      </a>

      {/* Call transcript toggle */}
      {transcriptDiarized && (
        <div>
          <button
            onClick={() => setShowTranscript(v => !v)}
            className="w-full flex items-center justify-between bg-scaler-cultured border border-scaler-border rounded-xl px-3 py-2.5 text-xs font-medium text-scaler-oxford hover:bg-scaler-border/40 transition-colors"
          >
            <span>📞 View call transcript</span>
            <span className="text-scaler-slate">{showTranscript ? '▲' : '▼'}</span>
          </button>
          {showTranscript && (
            <div className="mt-2 bg-scaler-cultured border border-scaler-border rounded-xl px-4 py-3 max-h-64 overflow-y-auto">
              {(() => {
                const raw = transcriptDiarized.split('\n').filter(Boolean)
                const collapsed = []
                for (const line of raw) {
                  const colon = line.indexOf(':')
                  const speaker = colon > -1 ? line.slice(0, colon).trim() : ''
                  const text = colon > -1 ? line.slice(colon + 1).trim() : line
                  const prev = collapsed[collapsed.length - 1]
                  if (prev && prev.speaker === speaker && prev.text === text) {
                    prev.count++
                  } else {
                    collapsed.push({ speaker, text, count: 1 })
                  }
                }
                return collapsed.map(({ speaker, text, count }, i) => {
                  const isBda = speaker === 'BDA'
                  return (
                    <div key={i} className={`mb-2 flex gap-2 ${isBda ? '' : 'flex-row-reverse'}`}>
                      <span className={`text-[10px] font-bold shrink-0 mt-0.5 w-8 text-center ${isBda ? 'text-scaler-blue' : 'text-violet-600'}`}>
                        {speaker}
                      </span>
                      <p className={`text-xs text-scaler-oxford leading-relaxed rounded-2xl px-3 py-2 max-w-[85%] ${isBda ? 'bg-blue-50' : 'bg-violet-50'}`}>
                        {text}
                        {count > 1 && <span className="ml-1.5 text-[10px] text-scaler-slate opacity-60">×{count}</span>}
                      </p>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      )}

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
