import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || ''

function normalizePhone(raw) {
  const digits = raw.replace(/\s+/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) return digits
  return '+91' + digits
}

export default function Setup({ onSetup, existingUser }) {
  const { loginWithGoogle, logout } = useAuth()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // If already signed in, just collect phone
  if (existingUser) {
    return (
      <div className="min-h-screen bg-scaler-cultured flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <img
                src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/194/804/original/Scaler.png?1778073683"
                alt="Scaler" className="w-9 h-9 object-contain"
              />
              <span className="text-2xl font-bold text-scaler-oxford tracking-wide">SCALER SIGNAL</span>
            </div>
            <p className="text-scaler-slate text-sm">One last step — where should nudges land?</p>
          </div>

          <div className="bg-white border border-scaler-border rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-scaler-cultured rounded-lg">
              <img src={existingUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(existingUser.displayName || '')}&background=0041CA&color=fff`}
                className="w-7 h-7 rounded-full" alt="" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-scaler-oxford truncate">{existingUser.displayName}</p>
                <p className="text-xs text-scaler-slate truncate">{existingUser.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-scaler-oxford mb-1.5">WhatsApp Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="9876543210 or +919876543210"
                className="w-full bg-scaler-cultured border border-scaler-border rounded-lg px-4 py-3 text-scaler-oxford placeholder-scaler-slate focus:outline-none focus:border-scaler-blue text-sm transition-colors"
              />
              <p className="text-xs text-scaler-slate mt-1">Pre-call nudges will be sent here</p>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={async () => {
                const clean = normalizePhone(phone)
                if (!/^\+\d{10,15}$/.test(clean)) { setError('Enter a valid number with country code, e.g. +919876543210'); return }
                setSaving(true)
                try {
                  const token = await existingUser.getIdToken()
                  const res = await fetch(`${API}/api/bda/setup-phone`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ phone: clean })
                  })
                  if (!res.ok) {
                    const body = await res.text()
                    let msg = 'Setup failed'
                    try { msg = JSON.parse(body).detail || msg } catch {}
                    throw new Error(msg)
                  }
                  onSetup(clean)
                } catch (e) { setError(e.message) } finally { setSaving(false) }
              }}
              disabled={saving}
              className="w-full bg-scaler-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Not signed in — offer Google or manual email entry
  return <SignInOptions onSetup={onSetup} />
}

function SignInOptions({ onSetup }) {
  const { loginWithGoogle } = useAuth()
  const [mode, setMode] = useState(null) // null | 'google' | 'manual'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const inputClass = "w-full bg-scaler-cultured border border-scaler-border rounded-lg px-4 py-3 text-scaler-oxford placeholder-scaler-slate focus:outline-none focus:border-scaler-blue text-sm transition-colors"

  async function handleGoogle() {
    setMode('google')
    setError('')
    setSaving(true)
    try {
      const googleUser = await loginWithGoogle()
      // Now collect phone
      setMode('google-phone')
      setSaving(false)
      // store user ref for later
      window.__setupGoogleUser = googleUser
    } catch (e) {
      setError(e.code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled.' : e.message)
      setMode(null)
      setSaving(false)
    }
  }

  async function handleGooglePhone() {
    const clean = normalizePhone(phone)
    if (!/^\+\d{10,15}$/.test(clean)) { setError('Enter a valid number with country code'); return }
    setSaving(true)
    try {
      const googleUser = window.__setupGoogleUser
      const token = await googleUser.getIdToken()
      const res = await fetch(`${API}/api/bda/setup-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: clean })
      })
      if (!res.ok) {
        const body = await res.text()
        let msg = 'Setup failed'
        try { msg = JSON.parse(body).detail || msg } catch {}
        throw new Error(msg)
      }
      onSetup(clean)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  async function handleManual(e) {
    e.preventDefault()
    if (!email.endsWith('@scaler.com') && !email.endsWith('@interviewbit.com')) {
      setError('Enter your Scaler work email (e.g. name@scaler.com)'); return
    }
    const clean = normalizePhone(phone)
    if (!/^\+\d{10,15}$/.test(clean)) { setError('Enter a valid number with country code'); return }
    setError('')
    setSaving(true)
    try {
      const googleUser = await loginWithGoogle()
      if (googleUser.email.toLowerCase() !== email.toLowerCase()) {
        setError(`Signed in as ${googleUser.email} — must match the email you entered.`)
        setSaving(false)
        return
      }
      const token = await googleUser.getIdToken()
      const res = await fetch(`${API}/api/bda/setup-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: clean })
      })
      if (!res.ok) {
        const body = await res.text()
        let msg = 'Setup failed'
        try { msg = JSON.parse(body).detail || msg } catch {}
        throw new Error(msg)
      }
      onSetup(clean)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') setError(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-scaler-cultured flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/194/804/original/Scaler.png?1778073683"
              alt="Scaler" className="w-9 h-9 object-contain"
            />
            <span className="text-2xl font-bold text-scaler-oxford tracking-wide">SCALER SIGNAL</span>
          </div>
          <p className="text-scaler-slate text-sm">BDA workspace — prep for calls, approve lead PDFs</p>
        </div>

        <div className="bg-white border border-scaler-border rounded-2xl p-6 shadow-sm">

          {/* Google phone step */}
          {mode === 'google-phone' ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-scaler-oxford">Almost there — enter your WhatsApp number</p>
              <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="9876543210 or +919876543210" className={inputClass} />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button onClick={handleGooglePhone} disabled={saving}
                className="w-full bg-scaler-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          ) : mode === 'manual' ? (
            /* Manual email + phone form */
            <form onSubmit={handleManual} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-scaler-oxford mb-1.5">Scaler Email</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="yourname@scaler.com" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-scaler-oxford mb-1.5">WhatsApp Number</label>
                <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError('') }}
                  placeholder="9876543210 or +919876543210" required className={inputClass} />
                <p className="text-xs text-scaler-slate mt-1">Pre-call nudges will be sent here</p>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" disabled={saving}
                className="w-full bg-scaler-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {saving && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                {saving ? 'Signing in...' : 'Continue with Google →'}
              </button>
              <button type="button" onClick={() => { setMode(null); setError('') }}
                className="w-full text-sm text-scaler-slate hover:text-scaler-oxford transition-colors py-1">
                ← Back
              </button>
            </form>
          ) : (
            /* Initial choice */
            <div className="space-y-3">
              <button onClick={handleGoogle} disabled={saving}
                className="w-full flex items-center justify-center gap-3 border border-scaler-border hover:bg-scaler-cultured text-scaler-oxford font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
                {saving && mode === 'google'
                  ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                }
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-scaler-border" />
                <span className="text-xs text-scaler-slate">or</span>
                <div className="flex-1 h-px bg-scaler-border" />
              </div>

              <button onClick={() => { setMode('manual'); setError('') }}
                className="w-full border border-scaler-border hover:bg-scaler-cultured text-scaler-oxford font-semibold py-3 rounded-xl transition-colors text-sm">
                Enter email manually
              </button>

              <p className="text-center text-xs text-scaler-slate pt-1">Sign in with your Scaler Google account</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
