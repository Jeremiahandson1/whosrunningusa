import React, { useState, useEffect } from 'react'
import api from '../utils/api'

export default function RubberStampBadge({ politicianId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!politicianId) return
    let cancelled = false
    api.get(`/rubber-stamp/politician/${politicianId}`)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [politicianId])

  if (!data) return null

  const loyaltyPct = data.party_loyalty_pct ?? data.party_loyalty
  const donorPct = data.donor_alignment_pct ?? data.donor_alignment

  if (loyaltyPct == null && donorPct == null) return null

  const loyaltyColor = loyaltyPct != null && loyaltyPct > 90 ? '#dc2626' : '#475569'
  const donorColor = donorPct != null && donorPct > 80 ? '#dc2626' : '#475569'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontWeight: 600, padding: '3px 10px',
      background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0',
    }}>
      {loyaltyPct != null && (
        <span style={{ color: loyaltyColor }}>
          Party Loyalty: {Math.round(loyaltyPct)}%
        </span>
      )}
      {loyaltyPct != null && donorPct != null && (
        <span style={{ color: '#cbd5e1' }}>&middot;</span>
      )}
      {donorPct != null && (
        <span style={{ color: donorColor }}>
          Donor Alignment: {Math.round(donorPct)}%
        </span>
      )}
    </span>
  )
}
