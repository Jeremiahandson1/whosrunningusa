import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Shield, Vote, UserCog, RefreshCw, FileText, Lock
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
  if (!user || user.user_type !== 'admin') {
    const redirectTo = encodeURIComponent(location.pathname + location.search)
    return (
      <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="empty-state" style={{ maxWidth: 480, margin: '0 auto' }}>
          <Lock size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
          <h3>Admin access required</h3>
          <p style={{ color: 'var(--slate-600)' }}>
            {user
              ? 'Your account does not have admin permissions. If this is a mistake, contact a platform administrator.'
              : 'Sign in with an admin account to view this page.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {!user && (
              <Link to={`/login?redirect=${redirectTo}`} className="btn btn-primary">Sign In</Link>
            )}
            <Link to="/" className="btn btn-secondary">Return Home</Link>
          </div>
        </div>
      </div>
    )
  }

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
