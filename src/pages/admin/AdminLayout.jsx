import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Shield, Vote, UserCog, RefreshCw, FileText, Lock, ClipboardCheck
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/candidates', label: 'Candidates', icon: Users },
  { path: '/admin/moderation', label: 'Moderation', icon: Shield },
  { path: '/admin/criminal-records', label: 'Criminal Records', icon: FileText },
  { path: '/admin/review-queue', label: 'Review Queue', icon: ClipboardCheck },
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
        <div className="empty-state" style={{ maxWidth: 520, margin: '0 auto' }}>
          <Lock size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
          <h3>Admin access required</h3>
          {user ? (
            <>
              <p style={{ color: 'var(--slate-600)' }}>
                You're signed in as <strong>{user.email}</strong>, but this account doesn't have admin permissions.
              </p>
              <p style={{ color: 'var(--slate-600)', marginTop: '0.75rem' }}>
                Admin access is granted manually by the platform team. If you need it for moderation, data sync, or candidate verification work, reach out at{' '}
                <a href="mailto:support@whosrunningusa.com?subject=Admin%20access%20request" style={{ color: 'var(--burgundy-600)', fontWeight: 600 }}>
                  support@whosrunningusa.com
                </a>{' '}
                or use the <Link to="/contact" style={{ color: 'var(--burgundy-600)', fontWeight: 600 }}>contact form</Link> and include your username.
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--slate-600)' }}>
              This area is restricted to platform administrators. Sign in with an admin account to continue.
            </p>
          )}
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
