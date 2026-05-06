import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Approvals from './pages/Approvals'
import NewLead from './pages/NewLead'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="new" element={<NewLead />} />
          </Route>
          {/* legacy short paths */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/approvals" element={<Navigate to="/app/approvals" replace />} />
          <Route path="/new" element={<Navigate to="/app/new" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
