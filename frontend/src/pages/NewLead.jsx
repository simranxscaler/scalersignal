import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LeadForm from '../components/LeadForm'
import NudgePreview from '../components/NudgePreview'

const API = import.meta.env.VITE_API_URL || ''

export default function NewLead() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { onPhoneReset } = useOutletContext() || {}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phoneNotConfigured, setPhoneNotConfigured] = useState(false)
  const [result, setResult] = useState(null)

  async function handleSubmit(formData) {
    setLoading(true)
    setError('')
    setPhoneNotConfigured(false)

    try {
      const token = await user.getIdToken()
      const body = new FormData()
      body.append('lead_name', formData.leadName)
      const phone = formData.leadPhone.trim()
      body.append('lead_phone', phone.startsWith('+') ? phone : '+91' + phone)
      body.append('background', formData.background)
      body.append('intent', formData.intent)
      body.append('program', formData.program || '')
      body.append('linkedin', formData.linkedin)

      const res = await fetch(`${API}/api/leads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Lead creation failed')
      }

      const data = await res.json()
      setResult(data)
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes('phone not configured')) {
        setPhoneNotConfigured(true)
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-scaler-cultured">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => { setResult(null); setError('') }}
            className="text-scaler-slate hover:text-scaler-oxford text-sm transition-colors"
          >
            ← Add another lead
          </button>
          <span className="text-scaler-border">|</span>
          <button
            onClick={() => navigate('/app/dashboard')}
            className="text-scaler-slate hover:text-scaler-oxford text-sm transition-colors"
          >
            Go to Lead Queue →
          </button>
        </div>

        <div className="max-w-2xl">
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800 text-sm">
            Lead created. BDA nudge sent to your WhatsApp. After the call, open the Lead Queue and click <strong>Mark Call Done</strong> to generate the lead PDF.
          </div>
          <NudgePreview nudge={result.nudge} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-scaler-cultured">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-scaler-oxford">New Lead</h1>
        <p className="text-scaler-slate text-sm mt-0.5">
          Add the lead's profile — a pre-call nudge is sent to your WhatsApp instantly. After the call, upload the transcript to generate the lead PDF.
        </p>
      </div>
      {phoneNotConfigured && (
        <div className="max-w-2xl mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm flex items-center justify-between gap-4">
          <span>Your WhatsApp number isn't set up yet — nudges need a number to deliver to.</span>
          <button
            onClick={() => onPhoneReset ? onPhoneReset() : null}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Set up WhatsApp
          </button>
        </div>
      )}
      <LeadForm onSubmit={handleSubmit} loading={loading} error={error} />
    </div>
  )
}
