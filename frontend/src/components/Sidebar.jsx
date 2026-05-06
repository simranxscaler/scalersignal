import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutList, CheckCircle, PlusCircle, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'

const nav = [
  { to: '/app/dashboard', label: 'Lead Queue', icon: LayoutList },
  { to: '/app/approvals', label: 'Approvals',  icon: CheckCircle },
  { to: '/app/new',       label: 'New Lead',   icon: PlusCircle },
]

export default function Sidebar({ pendingCount, collapsed, onToggle }) {
  const { user, logout } = useAuth()

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-56'} min-h-screen flex flex-col transition-all duration-200`}
      style={{ backgroundColor: '#0041CA' }}
    >
      {/* Logo + toggle */}
      <div className="px-4 py-5 flex items-center justify-between border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <img
              src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/194/804/original/Scaler.png?1778073683"
              alt="Scaler"
              className="w-7 h-7 object-contain brightness-0 invert"
            />
            <p className="text-white text-sm font-bold tracking-wide">SCALER SIGNAL</p>
          </div>
        )}
        {collapsed && (
          <img
            src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/194/804/original/Scaler.png?1778073683"
            alt="Scaler"
            className="w-7 h-7 object-contain brightness-0 invert mx-auto"
          />
        )}
        <button
          onClick={onToggle}
          className="text-white/60 hover:text-white transition-colors ml-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            style={({ isActive }) => isActive
              ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 600 }
              : { color: 'rgba(255,255,255,0.75)' }
            }
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/10 hover:!text-white ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
            {!collapsed && label === 'Approvals' && pendingCount > 0 && (
              <span className="ml-auto bg-white text-scaler-blue text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
            {collapsed && label === 'Approvals' && pendingCount > 0 && (
              <span className="absolute top-1 right-1 bg-white text-scaler-blue text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'BDA')}&background=324766&color=fff`}
              alt="avatar"
              className="w-8 h-8 rounded-full"
              title={user?.displayName}
            />
            <button onClick={logout} className="text-white/50 hover:text-white transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <img
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'BDA')}&background=324766&color=fff`}
              alt="avatar"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.displayName}</p>
              <p className="text-white/50 text-xs truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="text-white/50 hover:text-white transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
