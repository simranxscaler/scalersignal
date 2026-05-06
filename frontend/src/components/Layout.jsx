import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Setup from './Setup'

const API = import.meta.env.VITE_API_URL || ''

export default function Layout() {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [bdaPhone, setBdaPhone] = useState(null) // null = loading, '' = not set, '+91...' = set
  const [phoneLoading, setPhoneLoading] = useState(true)

  // Load BDA phone from backend on mount
  useEffect(() => {
    if (!user) return
    async function loadPhone() {
      try {
        const token = await user.getIdToken()
        const res = await fetch(`${API}/api/bda/phone`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        setBdaPhone(data.phone || '')
      } catch {
        setBdaPhone('')
      } finally {
        setPhoneLoading(false)
      }
    }
    loadPhone()
  }, [user])

  // Poll pending PDF count
  useEffect(() => {
    if (!user) return
    async function fetchCount() {
      try {
        const token = await user.getIdToken()
        const res = await fetch(`${API}/api/bda/pending-pdfs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        setPendingCount((data.pdfs || []).length)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  async function handleSetup(phone) {
    // phone was already persisted to backend inside Setup.jsx's Google sign-in flow
    setBdaPhone(phone)
  }

  if (phoneLoading) {
    return (
      <div className="min-h-screen bg-scaler-cultured flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-scaler-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!bdaPhone) {
    return <Setup onSetup={handleSetup} existingUser={user} />
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar pendingCount={pendingCount} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 min-w-0">
        <Outlet context={{ onPhoneReset: () => setBdaPhone('') }} />
      </div>
    </div>
  )
}
