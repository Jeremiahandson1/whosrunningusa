import React from 'react'
import { Database, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function DataSyncingBanner({ feature = 'this feature', exploreLink = '/explore', exploreLabel = 'Browse Candidates' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 20px',
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: 12,
      marginBottom: 24,
      flexWrap: 'wrap',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: '#dbeafe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1d4ed8', flexShrink: 0,
      }}>
        <Database size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 15 }}>
          We're still gathering data for {feature}
        </div>
        <div style={{ fontSize: 13, color: '#1e40af', marginTop: 2 }}>
          Records sync in nightly. Check back soon — or explore other parts of the platform in the meantime.
        </div>
      </div>
      <Link
        to={exploreLink}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8,
          background: '#1d4ed8', color: '#fff',
          fontWeight: 600, fontSize: 14, textDecoration: 'none',
        }}
      >
        {exploreLabel} <ArrowRight size={14} />
      </Link>
    </div>
  )
}

export default DataSyncingBanner
