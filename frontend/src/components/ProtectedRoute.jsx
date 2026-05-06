import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()

  // still loading firebase auth state
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-scaler-cultured flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-scaler-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />
  return children
}
