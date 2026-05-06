import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import PDFPreview from './PDFPreview'

const API = import.meta.env.VITE_API_URL || ''

const STATUS_META = {
  pending_call:     { label: 'Awaiting Call',  color: 'text-sky-700 bg-sky-50 border-sky-200' },
  call_completed:   { label: 'Call Done',      color: 'text-violet-700 bg-violet-50 border-violet-200' },
  pending_approval: { label: 'PDF Pending',    color: 'text-amber-700 bg-amber-50 border-amber-200' },
  sent:             { label: 'PDF Sent',       color: 'text-green-700 bg-green-50 border-green-200' },
  skipped:          { label: 'Skipped',        color: 'text-scaler-slate bg-scaler-cultured border-scaler-border' },
  nudge_sent:       { label: 'Nudge Sent',     color: 'text-scaler-blue bg-blue-50 border-blue-200' },
}

function utcToISTLocal(utcIso) {
  if (!utcIso) return ''
  const d = new Date(utcIso)
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000
  const ist = new Date(istMs)
  const pad = n => String(n).padStart(2, '0')
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`
}

function istLocalToUTC(localStr) {
  if (!localStr) return null
  const d = new Date(localStr)
  const istMs = d.getTime() - d.getTimezoneOffset() * 60 * 1000
  const utcMs = istMs - 5.5 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

function formatIST(utcIso) {
  if (!utcIso) return null
  const d = new Date(utcIso)
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

// ── Lead Detail Drawer ───────────────────────────────────────────────────────

function LeadDrawer({ lead, pdfStatus, onClose, onMarkCallDone, onScheduleSave }) {
  const meta = STATUS_META[pdfStatus] || STATUS_META['nudge_sent']
  const { user } = useAuth()
  const [scheduleValue, setScheduleValue] = useState(utcToISTLocal(lead.call_scheduled_at))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nudges, setNudges] = useState([])
  const [nudgesLoading, setNudgesLoading] = useState(true)
  const [expandedNudge, setExpandedNudge] = useState(null)

  useEffect(() => {
    user.getIdToken().then(token =>
      fetch(`${API}/api/leads/${lead.id}/nudges`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(d => setNudges(d.nudges || []))
      .finally(() => setNudgesLoading(false))
    )
  }, [lead.id])

  async function saveSchedule() {
    setSaving(true)
    try {
      const token = await user.getIdToken()
      await fetch(`${API}/api/leads/${lead.id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ call_scheduled_at: istLocalToUTC(scheduleValue) })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onScheduleSave()
    } finally {
      setSaving(false)
    }
  }

  const canCompleteCall = pdfStatus === 'pending_call' || pdfStatus === 'nudge_sent'
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState(null) // 'ok' | 'error'

  async function resendPdf() {
    setResending(true)
    setResendStatus(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API}/api/leads/${lead.id}/resend-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      setResendStatus(res.ok ? 'ok' : 'error')
    } catch {
      setResendStatus('error')
    } finally {
      setResending(false)
    }
  }

  const skills = Array.isArray(lead.linkedin_skills) ? lead.linkedin_skills : []
  const experiences = Array.isArray(lead.linkedin_experiences) ? lead.linkedin_experiences : []
  const education = Array.isArray(lead.linkedin_education) ? lead.linkedin_education : []

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-scaler-border flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-scaler-oxford">{lead.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-sm text-scaler-slate">{lead.phone}</p>
            {lead.program && (
              <span className="inline-block mt-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                {lead.program}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-scaler-slate hover:text-scaler-oxford text-2xl leading-none mt-0.5">×</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Schedule call */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Schedule Call (IST)</p>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduleValue}
                onChange={e => { setScheduleValue(e.target.value); setSaved(false) }}
                className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-scaler-blue bg-white text-scaler-oxford"
              />
              <button
                onClick={saveSchedule}
                disabled={saving}
                style={{ backgroundColor: '#0041CA' }}
                className="text-sm text-white font-semibold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Set Time'}
              </button>
            </div>
            {lead.call_scheduled_at && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-blue-700">
                  Scheduled: <span className="font-semibold">{formatIST(lead.call_scheduled_at)}</span> IST
                </p>
                {lead.nudge_scheduled_sent ? (
                  <p className="text-xs text-green-700 font-semibold">✓ 1-hr WhatsApp nudge already sent to you</p>
                ) : (
                  <p className="text-xs text-amber-700">⏳ WhatsApp nudge will fire 1 hr before the call</p>
                )}
              </div>
            )}
          </div>

          {/* Background & Intent */}
          <div className="space-y-3">
            <Section title="Background">
              <p className="text-sm text-scaler-oxford leading-relaxed">{lead.background || '—'}</p>
            </Section>
            <Section title="Intent / Goal">
              <p className="text-sm text-scaler-oxford leading-relaxed">{lead.intent || '—'}</p>
            </Section>
          </div>

          {/* LinkedIn */}
          {(lead.linkedin_headline || lead.linkedin_url) && (
            <Section title="LinkedIn">
              {lead.linkedin_headline && (
                <p className="text-sm text-scaler-oxford font-medium">{lead.linkedin_headline}</p>
              )}
              {lead.linkedin_institution && (
                <p className="text-xs text-scaler-slate mt-0.5">{lead.linkedin_institution}</p>
              )}
              {lead.linkedin_url && (
                <a href={lead.linkedin_url} target="_blank" rel="noreferrer"
                  className="text-xs text-scaler-blue underline mt-1 inline-block">
                  View profile →
                </a>
              )}
            </Section>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span key={s} className="text-xs bg-scaler-cultured border border-scaler-border text-scaler-oxford px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Experience */}
          {experiences.length > 0 && (
            <Section title="Experience">
              <div className="space-y-2">
                {experiences.map((e, i) => (
                  <div key={i} className="text-xs">
                    <p className="font-semibold text-scaler-oxford">{e.title} · {e.company}</p>
                    {(e.start || e.end) && (
                      <p className="text-scaler-slate">{e.start}{e.end ? ` – ${e.end}` : ' – Present'}</p>
                    )}
                    {e.description && (
                      <p className="text-scaler-slate mt-0.5 leading-relaxed line-clamp-2">{e.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Education */}
          {education.length > 0 && (
            <Section title="Education">
              <div className="space-y-2">
                {education.map((e, i) => (
                  <div key={i} className="text-xs">
                    <p className="font-semibold text-scaler-oxford">{e.school}</p>
                    <p className="text-scaler-slate">{[e.degree, e.field].filter(Boolean).join(', ')}</p>
                    {(e.start || e.end) && (
                      <p className="text-scaler-slate">{e.start}{e.end ? ` – ${e.end}` : ''}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* LinkedIn summary */}
          {lead.linkedin_summary && !experiences.length && (
            <Section title="LinkedIn Summary">
              <p className="text-xs text-scaler-slate leading-relaxed whitespace-pre-line">{lead.linkedin_summary}</p>
            </Section>
          )}

          {/* Nudges sent */}
          <Section title={`Briefs Sent (${nudges.length})`}>
            {nudgesLoading ? (
              <p className="text-xs text-scaler-slate">Loading…</p>
            ) : nudges.length === 0 ? (
              <p className="text-xs text-scaler-slate italic">No briefs sent yet.</p>
            ) : (
              <div className="space-y-2">
                {nudges.map((n, i) => (
                  <div key={n.id} className="border border-scaler-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedNudge(expandedNudge === i ? null : i)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-scaler-cultured hover:bg-blue-50 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-scaler-oxford">
                        {i === 0 ? '⏰ 1-hr reminder' : '📋 Pre-call brief'} ·{' '}
                        {new Date(n.sent_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })} IST
                      </span>
                      <span className="text-scaler-slate text-xs">{expandedNudge === i ? '▲' : '▼'}</span>
                    </button>
                    {expandedNudge === i && (
                      <div className="px-3 py-2.5 text-xs text-scaler-oxford leading-relaxed whitespace-pre-line bg-white max-h-64 overflow-y-auto">
                        {n.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Transcript */}
          {lead.transcript && (
            <Section title="Call Transcript">
              <p className="text-xs text-scaler-slate leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto pr-1">
                {lead.transcript}
              </p>
            </Section>
          )}
        </div>

        {/* Footer action */}
        {canCompleteCall && (
          <div className="px-6 py-4 border-t border-scaler-border shrink-0">
            <button
              onClick={onMarkCallDone}
              style={{ backgroundColor: '#0041CA' }}
              className="w-full text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Mark Call Done →
            </button>
          </div>
        )}
        {pdfStatus === 'pending_approval' && (
          <div className="px-6 py-4 border-t border-scaler-border shrink-0">
            <a
              href={`/app/approvals?lead=${lead.id}`}
              className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Review PDF →
            </a>
          </div>
        )}
        {pdfStatus === 'sent' && (
          <div className="px-6 py-4 border-t border-scaler-border shrink-0">
            <button
              onClick={resendPdf}
              disabled={resending}
              className="w-full text-sm font-semibold py-3 rounded-xl border border-scaler-border text-scaler-oxford hover:bg-scaler-cultured transition-colors disabled:opacity-50"
            >
              {resending ? 'Resending…' : resendStatus === 'ok' ? '✓ Sent again' : resendStatus === 'error' ? 'Failed — retry?' : 'Resend PDF on WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-scaler-slate uppercase tracking-wide mb-1.5">{title}</p>
      {children}
    </div>
  )
}

// ── Mark Call Done Modal ─────────────────────────────────────────────────────

const STEPS = {
  idle:         null,
  transcribing: 'Transcribing audio…',
  verifying:    'Verifying this is a Scaler call…',
  extracting:   'Extracting call intelligence…',
  generating:   'Generating personalised PDF…',
  uploading:    'Uploading to Drive…',
}

function CallDoneModal({ lead, onClose, onRefresh }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('text')
  const [transcript, setTranscript] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [step, setStep] = useState('idle')
  const [error, setError] = useState('')
  const [notScaler, setNotScaler] = useState(null)   // { reason } if wrong call
  const [pdfResult, setPdfResult] = useState(null)
  const [approving, setApproving] = useState(false)
  const fileRef = useRef()

  const loading = step !== 'idle'

  async function handleCompleteCall() {
    if (mode === 'text' && !transcript.trim()) { setError('Paste the call transcript.'); return }
    if (mode === 'audio' && !audioFile) { setError('Select an audio file.'); return }
    setError(''); setNotScaler(null)

    try {
      const token = await user.getIdToken()
      const body = new FormData()
      if (mode === 'audio') {
        setStep('transcribing')
        body.append('audio_file', audioFile)
        body.append('transcript', '')
        // Progress through steps visually while waiting (backend does all in one request)
        const steps = ['transcribing', 'verifying', 'extracting', 'generating', 'uploading']
        let i = 0
        const ticker = setInterval(() => {
          i++
          if (i < steps.length) setStep(steps[i])
        }, 8000)
        var clearTicker = () => clearInterval(ticker)
      } else {
        body.append('transcript', transcript)
        setStep('verifying')
        const steps = ['verifying', 'extracting', 'generating', 'uploading']
        let i = 0
        const ticker = setInterval(() => {
          i++
          if (i < steps.length) setStep(steps[i])
        }, 6000)
        var clearTicker = () => clearInterval(ticker)
      }

      const res = await fetch(`${API}/api/leads/${lead.id}/complete-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Something went wrong')
      }

      const data = await res.json()
      clearTicker?.()

      // Backend signals this wasn't a Scaler call
      if (data.scaler_call === false) {
        setNotScaler({ reason: data.reason })
        return
      }

      setPdfResult(data.pdf)
    } catch (e) {
      clearTicker?.()
      setError(e.message)
    } finally {
      setStep('idle')
    }
  }

  async function handleApproval(action, editedMessage) {
    const token = await user.getIdToken()
    setApproving(true)
    try {
      await fetch(`${API}/api/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_id: pdfResult.pdf_id, action, edited_message: editedMessage })
      })
      onRefresh()
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-5 border-b border-scaler-border flex items-center justify-between">
          <div>
            <h2 className="text-scaler-oxford font-semibold">Complete call — {lead.name}</h2>
            <p className="text-scaler-slate text-xs mt-0.5">
              Upload the call recording or paste transcript → AI generates lead PDF → you approve → sent to lead
            </p>
          </div>
          <button onClick={onClose} className="text-scaler-slate hover:text-scaler-oxford text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">

          {/* ── Wrong call alert ── */}
          {notScaler && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-red-800 font-semibold text-sm">This doesn't look like a Scaler call</p>
                  <p className="text-red-700 text-xs mt-1">{notScaler.reason}</p>
                </div>
              </div>
              <p className="text-xs text-red-600">Please upload the correct recording for <strong>{lead.name}</strong>. Nothing has been saved.</p>
              <button
                onClick={() => { setNotScaler(null); setAudioFile(null); setTranscript('') }}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Try again with correct file
              </button>
            </div>
          )}

          {/* ── Processing steps indicator ── */}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <svg className="animate-spin w-4 h-4 text-scaler-blue shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-scaler-blue">{STEPS[step]}</p>
                <div className="flex gap-1.5 mt-1.5">
                  {Object.keys(STEPS).filter(s => s !== 'idle').map(s => (
                    <div key={s} className={`h-1 w-8 rounded-full transition-colors ${
                      Object.keys(STEPS).indexOf(s) <= Object.keys(STEPS).indexOf(step)
                        ? 'bg-scaler-blue' : 'bg-blue-200'
                    }`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PDF preview after success ── */}
          {pdfResult && !loading ? (
            <PDFPreview pdfData={pdfResult} onApprove={handleApproval} loading={approving} />
          ) : !notScaler && !loading ? (
            <>
              {/* Mode toggle */}
              <div className="flex bg-scaler-cultured rounded-lg p-1 gap-1 border border-scaler-border w-fit">
                {['audio', 'text'].map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={`text-xs px-3 py-1.5 rounded-md transition-colors ${mode === m ? 'bg-scaler-blue text-white font-semibold' : 'text-scaler-slate hover:text-scaler-oxford'}`}>
                    {m === 'audio' ? '🎙 Audio File' : '📝 Transcript'}
                  </button>
                ))}
              </div>

              {/* Flow description */}
              <div className="flex items-center gap-2 text-xs text-scaler-slate">
                {['Upload', 'Verify', 'Extract', 'Generate PDF', 'You Approve', 'Sent to Lead'].map((s, i, arr) => (
                  <span key={s} className="flex items-center gap-2">
                    <span className="bg-scaler-cultured border border-scaler-border px-2 py-0.5 rounded-full">{s}</span>
                    {i < arr.length - 1 && <span className="text-scaler-border">→</span>}
                  </span>
                ))}
              </div>

              {mode === 'audio' ? (
                <div onClick={() => fileRef.current.click()}
                  className="border-2 border-dashed border-scaler-border hover:border-scaler-blue rounded-xl p-8 text-center cursor-pointer transition-colors bg-scaler-cultured">
                  <input ref={fileRef} type="file" accept="audio/*"
                    onChange={e => { const f = e.target.files[0]; if (f) setAudioFile(f) }} className="hidden" />
                  {audioFile ? (
                    <div>
                      <p className="text-scaler-oxford font-semibold">🎵 {audioFile.name}</p>
                      <p className="text-scaler-slate text-xs mt-1">{(audioFile.size / 1024 / 1024).toFixed(1)} MB · click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl mb-2">🎙</p>
                      <p className="text-scaler-oxford font-medium">Drop call recording or click to browse</p>
                      <p className="text-scaler-slate text-xs mt-1">MP3, M4A, WAV · max 50MB</p>
                      <p className="text-xs text-scaler-slate mt-2 italic">AI will verify this is a Scaler call before processing</p>
                    </div>
                  )}
                </div>
              ) : (
                <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={10}
                  placeholder="Paste the call transcript here..."
                  className="w-full bg-scaler-cultured border border-scaler-border rounded-lg px-3 py-2.5 text-scaler-oxford text-sm placeholder-scaler-slate focus:outline-none focus:border-scaler-blue focus:ring-1 focus:ring-scaler-blue/20 resize-none" />
              )}

              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>}

              <button onClick={handleCompleteCall} disabled={loading}
                style={{ backgroundColor: '#0041CA' }}
                className="w-full disabled:opacity-50 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm">
                {mode === 'audio' ? 'Upload & Process Recording →' : 'Process Transcript →'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Table Row ────────────────────────────────────────────────────────────────

const PROGRAMS = ['Academy', 'DSML', 'DevOps & AI', 'Online MBA']

function ProgramBadge({ program }) {
  if (!program) return <span className="text-xs text-scaler-slate/50 italic">—</span>
  const colors = {
    'Academy':     'text-blue-700 bg-blue-50 border-blue-200',
    'DSML':        'text-purple-700 bg-purple-50 border-purple-200',
    'DevOps & AI': 'text-teal-700 bg-teal-50 border-teal-200',
    'Online MBA':  'text-orange-700 bg-orange-50 border-orange-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[program] || 'text-scaler-slate bg-scaler-cultured border-scaler-border'}`}>
      {program}
    </span>
  )
}

export default function LeadRow({ lead, pdfStatus, onRefresh, isLast }) {
  const meta = STATUS_META[pdfStatus] || STATUS_META['nudge_sent']
  const { user } = useAuth()
  const [showDrawer, setShowDrawer] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const [program, setProgram] = useState(lead.program || '')
  const [savingProgram, setSavingProgram] = useState(false)
  const borderClass = isLast ? '' : 'border-b border-scaler-border'
  const canCompleteCall = pdfStatus === 'pending_call' || pdfStatus === 'nudge_sent'

  async function handleProgramChange(e) {
    const val = e.target.value
    setProgram(val)
    setSavingProgram(true)
    try {
      const token = await user.getIdToken()
      await fetch(`${API}/api/leads/${lead.id}/program`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ program: val || null }),
      })
      onRefresh()
    } finally {
      setSavingProgram(false)
    }
  }

  return (
    <>
      <tr className={`${borderClass} hover:bg-scaler-cultured/40 transition-colors cursor-pointer`}>
        {/* Lead name — clickable to open drawer */}
        <td className="px-4 py-3" onClick={() => setShowDrawer(true)}>
          <p className="font-semibold text-scaler-blue text-sm hover:underline">{lead.name}</p>
          <p className="text-xs text-scaler-slate mt-0.5">{lead.phone}</p>
        </td>

        {/* Background + intent */}
        <td className="px-4 py-3 max-w-xs" onClick={() => setShowDrawer(true)}>
          <p className="text-xs text-scaler-oxford truncate">{lead.background}</p>
          <p className="text-xs text-scaler-slate/70 truncate mt-0.5">{lead.intent}</p>
        </td>

        {/* Status */}
        <td className="px-4 py-3" onClick={() => setShowDrawer(true)}>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
            {meta.label}
          </span>
        </td>

        {/* Program selector — stop propagation */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <select
            value={program}
            onChange={handleProgramChange}
            disabled={savingProgram}
            className="text-xs border border-scaler-border rounded-md px-2 py-1 bg-white text-scaler-oxford focus:outline-none focus:ring-1 focus:ring-scaler-blue disabled:opacity-50 cursor-pointer"
          >
            <option value="">— Program —</option>
            {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </td>

        {/* Schedule — click to open drawer which has the picker */}
        <td className="px-4 py-3" onClick={() => setShowDrawer(true)}>
          {lead.call_scheduled_at ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-scaler-oxford">{formatIST(lead.call_scheduled_at)}</span>
              {lead.nudge_scheduled_sent
                ? <span className="text-xs text-green-600 font-medium">✓ Nudge sent</span>
                : <span className="text-xs text-amber-600">Nudge pending</span>
              }
            </div>
          ) : (
            <span className="text-xs text-scaler-blue underline underline-offset-2 cursor-pointer">+ Set time</span>
          )}
        </td>

        {/* Added */}
        <td className="px-4 py-3 text-xs text-scaler-slate whitespace-nowrap" onClick={() => setShowDrawer(true)}>
          {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </td>

        {/* Action — stop propagation so row click doesn't fire */}
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          {canCompleteCall && (
            <button
              onClick={() => setShowCallModal(true)}
              style={{ backgroundColor: '#0041CA' }}
              className="text-xs text-white font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Mark Call Done →
            </button>
          )}
          {pdfStatus === 'pending_approval' && (
            <a
              href={`/app/approvals?lead=${lead.id}`}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap inline-block"
            >
              Review PDF →
            </a>
          )}
          {pdfStatus === 'sent' && (
            <button
              onClick={async (e) => {
                e.stopPropagation()
                const token = await user.getIdToken()
                await fetch(`${API}/api/leads/${lead.id}/resend-pdf`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                })
              }}
              className="text-xs border border-scaler-border text-scaler-oxford font-medium px-3 py-1.5 rounded-lg hover:bg-scaler-cultured transition-colors whitespace-nowrap"
            >
              Resend PDF
            </button>
          )}
        </td>
      </tr>

      {showDrawer && (
        <LeadDrawer
          lead={lead}
          pdfStatus={pdfStatus}
          onClose={() => setShowDrawer(false)}
          onMarkCallDone={() => { setShowDrawer(false); setShowCallModal(true) }}
          onScheduleSave={onRefresh}
        />
      )}

      {showCallModal && (
        <CallDoneModal
          lead={lead}
          onClose={() => setShowCallModal(false)}
          onRefresh={() => { setShowCallModal(false); onRefresh() }}
        />
      )}
    </>
  )
}
