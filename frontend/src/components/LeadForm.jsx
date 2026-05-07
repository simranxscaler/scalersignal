import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Parse a single CSV line respecting quoted fields
function parseCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur.trim())
  return fields
}

// Detect which column index maps to which field by inspecting the header row
function detectColumns(headers) {
  const map = { name: -1, phone: -1, program: -1, background: -1, intent: -1, linkedin: -1 }
  headers.forEach((h, i) => {
    const low = h.toLowerCase().replace(/[^a-z]/g, '')
    if (low.includes('name')) map.name = i
    else if (low.includes('phone') || low.includes('whatsapp') || low.includes('number') || low.includes('mobile')) map.phone = i
    else if (low.includes('program') || low.includes('course') || low.includes('product')) map.program = i
    else if (low.includes('background') || low.includes('company') || low.includes('exp')) map.background = i
    else if (low.includes('intent') || low.includes('goal')) map.intent = i
    else if (low.includes('linkedin') || low.includes('url') || low.includes('link')) map.linkedin = i
  })
  return map
}

export default function LeadForm({ onSubmit, loading, error }) {
  const PROGRAMS = ['Academy', 'DSML', 'DevOps & AI', 'Online MBA']

  const [form, setForm] = useState({
    leadName: '',
    leadPhone: '',
    program: '',
    background: '',
    intent: '',
    linkedin: '',
  })
  const [showCsv, setShowCsv] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvError, setCsvError] = useState('')
  const [linkedinSummary, setLinkedinSummary] = useState('')
  const [scraping, setScraping] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'linkedin') setLinkedinSummary('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.leadName || !form.leadPhone) return
    onSubmit({ ...form })
  }

  function applyCsv() {
    setCsvError('')
    const lines = csvText.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) {
      setCsvError('Need at least a header row and one data row.')
      return
    }
    const headers = parseCsvLine(lines[0])
    const map = detectColumns(headers)
    if (map.name === -1 && map.phone === -1) {
      setCsvError('Could not detect name or phone columns. Make sure your header row has columns like: name, phone/whatsapp, background, intent, linkedin.')
      return
    }
    const values = parseCsvLine(lines[1])
    const csvProgram = map.program >= 0 ? values[map.program] || '' : ''
    const validProgram = ['Academy', 'DSML', 'AI/ML', 'Online MBA'].find(
      p => p.toLowerCase() === csvProgram.toLowerCase()
    ) || ''
    setForm(prev => ({
      ...prev,
      leadName:   map.name       >= 0 ? values[map.name]       || prev.leadName   : prev.leadName,
      leadPhone:  map.phone      >= 0 ? values[map.phone]      || prev.leadPhone  : prev.leadPhone,
      program:    validProgram   || prev.program,
      background: map.background >= 0 ? values[map.background] || prev.background : prev.background,
      intent:     map.intent     >= 0 ? values[map.intent]     || prev.intent     : prev.intent,
      linkedin:   map.linkedin   >= 0 ? values[map.linkedin]   || prev.linkedin   : prev.linkedin,
    }))
    setLinkedinSummary('')
    setShowCsv(false)
    setCsvText('')
  }

  async function scrapeLinkedIn() {
    if (!form.linkedin || !form.linkedin.includes('linkedin.com/in/')) return
    setScraping(true)
    setLinkedinSummary('')
    try {
      const res = await fetch(`${API_BASE}/api/scrape-linkedin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.linkedin })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Scrape failed')
      setLinkedinSummary(data.summary || '(no summary found)')
    } catch (err) {
      setLinkedinSummary(`Could not scrape: ${err.message}`)
    } finally {
      setScraping(false)
    }
  }

  const inputClass = "w-full bg-scaler-cultured border border-scaler-border rounded-lg px-3 py-2.5 text-scaler-oxford text-sm placeholder-scaler-slate focus:outline-none focus:border-scaler-blue focus:ring-1 focus:ring-scaler-blue/20"
  const isLinkedInUrl = form.linkedin && form.linkedin.includes('linkedin.com/in/')

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* CSV paste panel */}
        <div className="bg-white border border-scaler-border rounded-2xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCsv(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-scaler-cultured transition-colors"
          >
            <span className="text-xs font-bold text-scaler-indigo uppercase tracking-widest">Paste from CSV</span>
            <svg
              className={`w-4 h-4 text-scaler-slate transition-transform ${showCsv ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCsv && (
            <div className="px-5 pb-5 space-y-3 border-t border-scaler-border">
              <p className="text-xs text-scaler-slate pt-3">
                Paste CSV with a header row. Recognised columns: <span className="font-mono">name, phone/whatsapp, background, intent, linkedin</span>
              </p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={5}
                placeholder={"name,phone,background,intent,linkedin\nRohan Sharma,+919876543210,SWE at TCS 4YoE,Switch to product,https://linkedin.com/in/rohan"}
                className={`${inputClass} resize-none font-mono text-xs`}
              />
              {csvError && <p className="text-red-600 text-xs">{csvError}</p>}
              <button
                type="button"
                onClick={applyCsv}
                className="bg-scaler-blue text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fill form from CSV
              </button>
            </div>
          )}
        </div>

        {/* Lead profile */}
        <div className="bg-white border border-scaler-border rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-scaler-indigo uppercase tracking-widest">Lead Profile</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-scaler-slate font-medium mb-1">Name *</label>
              <input name="leadName" value={form.leadName} onChange={handleChange} required
                placeholder="Rohan Sharma" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-scaler-slate font-medium mb-1">WhatsApp Number *</label>
              <input name="leadPhone" value={form.leadPhone} onChange={handleChange} required
                placeholder="9999900000" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-scaler-slate font-medium mb-1">
              Interested Program <span className="text-scaler-slate/60 font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PROGRAMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, program: prev.program === p ? '' : p }))}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    form.program === p
                      ? 'bg-scaler-blue text-white border-scaler-blue'
                      : 'bg-scaler-cultured text-scaler-slate border-scaler-border hover:border-scaler-blue hover:text-scaler-blue'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-scaler-slate font-medium mb-1">
              Background <span className="text-scaler-slate/60 font-normal">(optional)</span>
            </label>
            <input name="background" value={form.background} onChange={handleChange}
              placeholder="Software Engineer, TCS. 4 YoE. B.Tech CSE VIT 2020." className={inputClass} />
          </div>

          <div>
            <label className="block text-xs text-scaler-slate font-medium mb-1">
              Intent <span className="text-scaler-slate/60 font-normal">(optional)</span>
            </label>
            <input name="intent" value={form.intent} onChange={handleChange}
              placeholder="Want to switch to product company, interested in AI engineering roles" className={inputClass} />
          </div>

        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-scaler-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Creating lead + sending nudge...
            </>
          ) : (
            'Add Lead & Send Pre-Call Nudge'
          )}
        </button>
      </form>
    </div>
  )
}
