import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import PDFPreview from '../components/PDFPreview'

const API = import.meta.env.VITE_API_URL || ''

export default function Approvals() {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPending()
  }, [user])

  async function fetchPending() {
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API}/api/bda/pending-pdfs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setPending(data.pdfs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleApproval(pdfId, action, editedMessage) {
    const token = await user.getIdToken()
    await fetch(`${API}/api/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ pdf_id: pdfId, action, edited_message: editedMessage })
    })
    setPending(prev => prev.filter(p => p.pdf_id !== pdfId))
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-scaler-cultured">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-scaler-oxford">Approval Inbox</h1>
        <p className="text-scaler-slate text-sm mt-0.5">
          {loading ? '...' : `${pending.length} PDF${pending.length !== 1 ? 's' : ''} waiting for your review`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-scaler-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16 text-scaler-slate">
          <p className="text-4xl mb-3">✅</p>
          <p>All caught up — no PDFs waiting for approval.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.map(item => (
            <div key={item.pdf_id} className="bg-white border border-scaler-border rounded-2xl p-5 shadow-sm">
              <div className="mb-4 pb-4 border-b border-scaler-border flex items-center justify-between">
                <div>
                  <p className="text-scaler-oxford font-semibold">{item.lead_name}</p>
                  <p className="text-scaler-slate text-xs mt-0.5">{item.lead_background}</p>
                </div>
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full font-medium">
                  Awaiting Approval
                </span>
              </div>

              <PDFPreview
                pdfData={{
                  pdf_id: item.pdf_id,
                  pdf_url: item.pdf_url,
                  cover_message: item.cover_message,
                  status: 'pending_approval'
                }}
                onApprove={(action, msg) => handleApproval(item.pdf_id, action, msg)}
                loading={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
