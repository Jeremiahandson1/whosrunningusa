import React, { useState, useEffect } from 'react'
import { EyeOff, Loader } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from './SourceCitation'

function formatAmount(num) {
  if (num == null || isNaN(num)) return '$0'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toLocaleString()}`
}

export default function DarkMoneyCallout({ candidateId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!candidateId) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.get(`/dark-money/candidates/${candidateId}`)
      .then(res => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [candidateId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: '#475569', fontSize: 13 }}>
        <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!data || (data.unaccounted_amount ?? 0) <= 0) {
    return null
  }

  const totalSpending = data.total_outside_spending ?? 0
  const disclosed = data.disclosed_amount ?? 0
  const unaccounted = data.unaccounted_amount ?? 0
  const disclosedPct = totalSpending > 0 ? (disclosed / totalSpending) * 100 : 0
  const unaccountedPct = totalSpending > 0 ? (unaccounted / totalSpending) * 100 : 0
  const c4Groups = data.c4_groups || []
  const c4Count = data.c4_group_count ?? c4Groups.length
  const sourceUrl = data.source_url

  return (
    <div style={{
      border: '2px solid #dc2626',
      borderRadius: 12,
      padding: 20,
      background: '#fef2f2',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <EyeOff size={20} color="#991b1b" />
        <span style={{ color: '#991b1b', fontWeight: 700, fontSize: 18 }}>Dark Money Gap</span>
      </div>

      {/* Stat boxes */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{
          flex: 1,
          minWidth: 140,
          background: '#fff',
          borderRadius: 8,
          padding: '12px 16px',
          border: '1px solid #fecaca',
        }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Total Outside Spending</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            <SourceCitation
              value={formatAmount(totalSpending)}
              sourceUrl={sourceUrl}
              sourceLabel="FEC / OpenSecrets"
            />
          </div>
        </div>

        <div style={{
          flex: 1,
          minWidth: 140,
          background: '#fff',
          borderRadius: 8,
          padding: '12px 16px',
          border: '1px solid #fecaca',
        }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Disclosed</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            <SourceCitation
              value={formatAmount(disclosed)}
              sourceUrl={sourceUrl}
              sourceLabel="FEC / OpenSecrets"
            />
          </div>
        </div>

        <div style={{
          flex: 1,
          minWidth: 140,
          background: '#fff',
          borderRadius: 8,
          padding: '12px 16px',
          border: '1px solid #fecaca',
        }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Unaccounted</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>
            <SourceCitation
              value={formatAmount(unaccounted)}
              sourceUrl={sourceUrl}
              sourceLabel="FEC / OpenSecrets"
            />
          </div>
        </div>
      </div>

      {/* Percentage bar */}
      <div style={{
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        display: 'flex',
        background: '#e5e7eb',
        marginBottom: 16,
      }}>
        <div style={{
          width: `${disclosedPct}%`,
          background: '#9ca3af',
          height: '100%',
          transition: 'width 0.3s ease',
        }} />
        <div style={{
          width: `${unaccountedPct}%`,
          background: '#dc2626',
          height: '100%',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* 501(c)(4) groups */}
      {c4Count > 0 && c4Groups.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
            501(c)(4) Groups ({c4Count})
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {c4Groups.map((group, idx) => (
              <li key={group.id || idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #fecaca',
                fontSize: 13,
              }}>
                <span style={{ color: '#1e293b' }}>{group.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>
                    <SourceCitation
                      value={formatAmount(group.total_spend ?? group.amount)}
                      sourceUrl={sourceUrl}
                      sourceLabel="FEC / OpenSecrets"
                    />
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#991b1b',
                    background: '#fecaca',
                    borderRadius: 4,
                    padding: '2px 6px',
                    whiteSpace: 'nowrap',
                  }}>
                    Zero donor disclosure
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <p style={{ fontSize: 12, fontStyle: 'italic', color: '#6b7280', margin: 0 }}>
        This is a floor estimate. Actual unaccounted spending is likely higher.
      </p>
    </div>
  )
}
