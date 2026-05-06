import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import LeadRow from '../components/LeadRow'

const API = import.meta.env.VITE_API_URL || ''

export default function Dashboard() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchLeads() }, [user])

  async function fetchLeads() {
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API}/api/bda/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filters = [
    { key: 'all',              label: 'All' },
    { key: 'pending_call',     label: 'Awaiting Call' },
    { key: 'pending_approval', label: 'PDF Pending' },
    { key: 'sent',             label: 'PDF Sent' },
    { key: 'skipped',          label: 'Skipped' },
  ]

  const filtered = filter === 'all' ? leads : leads.filter(l => l.pdf_status === filter)
  const pendingCount      = leads.filter(l => l.pdf_status === 'pending_approval').length
  const awaitingCallCount = leads.filter(l => l.pdf_status === 'pending_call' || l.pdf_status === 'nudge_sent').length

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-scaler-cultured">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-scaler-oxford">Lead Queue</h1>
          <p className="text-scaler-slate text-sm mt-0.5">
            {leads.length} leads · {awaitingCallCount} awaiting call · {pendingCount} PDF{pendingCount !== 1 ? 's' : ''} pending approval
          </p>
        </div>
        <a
          href="/app/new"
          style={{ backgroundColor: '#0041CA', color: '#ffffff' }}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-90"
        >
          + New Lead
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Leads',   value: leads.length,                                                           numColor: '#021028' },
          { label: 'Awaiting Call', value: awaitingCallCount,                                                      numColor: '#0369a1' },
          { label: 'PDF Pending',   value: leads.filter(l => l.pdf_status === 'pending_approval').length,          numColor: '#d97706' },
          { label: 'PDFs Sent',     value: leads.filter(l => l.pdf_status === 'sent').length,                      numColor: '#16a34a' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-scaler-border rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold" style={{ color: stat.numColor }}>{stat.value}</p>
            <p className="text-xs mt-1" style={{ color: '#677993' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={filter === f.key
              ? { backgroundColor: '#0041CA', color: '#ffffff' }
              : { backgroundColor: '#ffffff', color: '#324766', border: '1px solid #E2E8F0' }
            }
            className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium hover:opacity-90"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-scaler-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-scaler-slate">
          <p className="text-4xl mb-3">📭</p>
          <p>No leads yet. Add your first lead to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-scaler-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-scaler-border bg-scaler-cultured">
                <th className="text-left px-4 py-3 text-xs font-semibold text-scaler-slate">Lead</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-scaler-slate">Background</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-scaler-slate">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-scaler-slate">Program</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-scaler-slate">Call Scheduled (IST)</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-scaler-slate">Added</th>
                <th className="px-4 py-3 text-xs font-semibold text-scaler-slate">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  pdfStatus={lead.pdf_status}
                  onRefresh={fetchLeads}
                  isLast={idx === filtered.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
