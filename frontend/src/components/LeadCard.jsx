import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PDFPreview from './PDFPreview'

const API = import.meta.env.VITE_API_URL || ''

const STATUS_META = {
  pending_call:    { label: 'Awaiting Call',  color: 'text-sky-700 bg-sky-50 border-sky-200' },
  call_completed:  { label: 'Call Done',      color: 'text-violet-700 bg-violet-50 border-violet-200' },
  pending_approval:{ label: 'PDF Pending',    color: 'text-amber-700 bg-amber-50 border-amber-200' },
  sent:            { label: 'PDF Sent',       color: 'text-green-700 bg-green-50 border-green-200' },
  skipped:         { label: 'Skipped',        color: 'text-scaler-slate bg-scaler-cultured border-scaler-border' },
  nudge_sent:      { label: 'Nudge Sent',     color: 'text-scaler-blue bg-blue-50 border-blue-200' },
}

export default function LeadCard({ lead, pdfStatus, onRefresh }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const meta = STATUS_META[pdfStatus] || STATUS_META['nudge_sent']

  const [showModal, setShowModal] = useState(false)
  const [mode, setMode] = useState('text')
  const [transcript, setTranscript] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfResult, setPdfResult] = useState(null)
  const fileRef = useRef()

  async function handleCompleteCall() {
    if (mode === 'text' && !transcript.trim()) { setError('Paste the call transcript.'); return }
    if (mode === 'audio' && !audioFile) { setError('Select an audio file.'); return }
    setLoading(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const body = new FormData()
      if (mode === 'audio') {
        body.append('audio_file', audioFile)
      } else {
        body.append('transcript', transcript)
      }

      const res = await fetch(`${API}/api/leads/${lead.id}/complete-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to process call')
      }
      const data = await res.json()
      setPdfResult(data.pdf)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApproval(action, editedMessage) {
    const token = await user.getIdToken()
    setLoading(true)
    try {
      await fetch(`${API}/api/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_id: pdfResult.pdf_id, action, edited_message: editedMessage })
      })
      if (onRefresh) onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const canCompleteCall = pdfStatus === 'pending_call' || pdfStatus === 'nudge_sent'

  return (
    <>
      <div className="bg-white border border-scaler-border rounded-xl p-4 hover:border-scaler-indigo transition-colors shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-scaler-oxford font-semibold text-sm truncate">{lead.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.color} shrink-0`}>
                {meta.label}
              </span>
            </div>
            <p className="text-scaler-slate text-xs truncate">{lead.background}</p>
            <p className="text-scaler-slate/70 text-xs mt-1 truncate">{lead.intent}</p>
          </div>
          <div className="shrink-0 text-xs text-scaler-slate">
            {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-scaler-border flex gap-2">
          {canCompleteCall && (
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 text-xs bg-scaler-blue hover:bg-blue-700 text-white font-medium py-1.5 rounded-lg transition-colors"
            >
              Mark Call Done →
            </button>
          )}
          {pdfStatus === 'pending_approval' && (
            <button
              onClick={() => navigate(`/app/approvals?lead=${lead.id}`)}
              className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium py-1.5 rounded-lg transition-colors"
            >
              Review PDF →
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-scaler-border flex items-center justify-between">
              <div>
                <h2 className="text-scaler-oxford font-semibold">Complete call — {lead.name}</h2>
                <p className="text-scaler-slate text-xs mt-0.5">Upload transcript or audio to generate the lead PDF</p>
              </div>
              <button onClick={() => { setShowModal(false); setError(''); setPdfResult(null) }}
                className="text-scaler-slate hover:text-scaler-oxford text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              {!pdfResult ? (
                <>
                  {/* Mode toggle */}
                  <div className="flex bg-scaler-cultured rounded-lg p-1 gap-1 border border-scaler-border w-fit">
                    <button type="button" onClick={() => setMode('text')}
                      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${mode === 'text' ? 'bg-scaler-blue text-white font-semibold' : 'text-scaler-slate hover:text-scaler-oxford'}`}>
                      Transcript
                    </button>
                    <button type="button" onClick={() => setMode('audio')}
                      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${mode === 'audio' ? 'bg-scaler-blue text-white font-semibold' : 'text-scaler-slate hover:text-scaler-oxford'}`}>
                      Audio File
                    </button>
                  </div>

                  {mode === 'text' ? (
                    <textarea
                      value={transcript}
                      onChange={e => setTranscript(e.target.value)}
                      rows={10}
                      placeholder="Paste the call transcript here..."
                      className="w-full bg-scaler-cultured border border-scaler-border rounded-lg px-3 py-2.5 text-scaler-oxford text-sm placeholder-scaler-slate focus:outline-none focus:border-scaler-blue focus:ring-1 focus:ring-scaler-blue/20 resize-none"
                    />
                  ) : (
                    <div
                      onClick={() => fileRef.current.click()}
                      className="border-2 border-dashed border-scaler-border hover:border-scaler-blue rounded-xl p-8 text-center cursor-pointer transition-colors bg-scaler-cultured"
                    >
                      <input ref={fileRef} type="file" accept="audio/*"
                        onChange={e => { const f = e.target.files[0]; if (f) setAudioFile(f) }}
                        className="hidden" />
                      {audioFile ? (
                        <div>
                          <p className="text-scaler-oxford font-medium">{audioFile.name}</p>
                          <p className="text-scaler-slate text-xs mt-1">{(audioFile.size / 1024 / 1024).toFixed(1)} MB — click to change</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-scaler-indigo font-medium">Drop audio file or click to browse</p>
                          <p className="text-scaler-slate text-xs mt-1">MP3, M4A, WAV — max 50MB</p>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
                  )}

                  <button
                    onClick={handleCompleteCall}
                    disabled={loading}
                    className="w-full bg-scaler-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        {mode === 'audio' ? 'Transcribing + generating PDF...' : 'Generating PDF...'}
                      </>
                    ) : (
                      'Generate Lead PDF'
                    )}
                  </button>
                </>
              ) : (
                <PDFPreview
                  pdfData={pdfResult}
                  onApprove={handleApproval}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
