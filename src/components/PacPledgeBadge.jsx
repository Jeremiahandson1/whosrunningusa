import React, { useState, useEffect } from 'react'
import api from '../utils/api'

function formatMoney(n) {
  if (!n) return '$0'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${Number(n).toLocaleString()}`
}

export default function PacPledgeBadge({ candidateId }) {
  const [pledge, setPledge] = useState(null)

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    api.get(`/pac-pledge/candidate/${candidateId}`)
      .then(d => { if (!cancelled) setPledge(d) })
      .catch(() => { if (!cancelled) setPledge(null) })
    return () => { cancelled = true }
  }, [candidateId])

  if (!pledge || !pledge.status) return null

  if (pledge.status === 'kept') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
      }}>
        PAC-Free Pledge &#10003;
      </span>
    )
  }

  if (pledge.status === 'violated') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
      }}>
        PAC Pledge Broken
        {pledge.violation_amount ? ` (${formatMoney(pledge.violation_amount)})` : ''}
      </span>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
    }}>
      PAC-Free Pledge
    </span>
  )
}
