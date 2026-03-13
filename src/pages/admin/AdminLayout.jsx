import { Link, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Shield, Vote, UserCog, RefreshCw, FileText
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/candidates', label: 'Candidates', icon: Users },
  { path: '/admin/moderation', label: 'Moderation', icon: Shield },
  { path: '/admin/criminal-records', label: 'Criminal Records', icon: FileText },
  { path: '/admin/elections', label: 'Elections & Races', icon: Vote },
  { path: '/admin/users', label: 'Users', icon: UserCog },
  { path: '/admin/sync-logs', label: 'Sync Logs', icon: RefreshCw },
]

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading-state">Loading...</div>
  if (!user || user.user_type !== 'admin') return <Navigate to="/" replace />

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Shield size={20} />
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          {navItems.map(item => {
            const active = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${active ? 'active' : ''}`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="admin-content">
        {children}
      </div>
    </div>
  )
}
