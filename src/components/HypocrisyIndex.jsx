import React, { useState, useEffect } from 'react'
import { DollarSign, CheckCircle, XCircle, Loader } from 'lucide-react'
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

const CATEGORIES = ['Military', 'Economic', 'Humanitarian', 'Democracy Promotion', 'Health', 'Other']

export default function HypocrisyIndex({ countryCode }) {
  const [aidData, setAidData] = useState(null)
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!countryCode) return
    setLoading(true)
    setError(null)

    Promise.all([
      api.get(`/foreign-aid/countries/${countryCode}`),
      api.get(`/foreign-aid/countries/${countryCode}/policies`),
    ])
      .then(([aid, pol]) => {
        setAidData(aid)
        setPolicies(pol.policies || pol || [])
      })
      .catch(err => {
        setError(err.message || 'Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [countryCode])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} color="#475569" />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: '#dc2626', background: '#fef2f2', borderRadius: 12, textAlign: 'center' }}>
        {error}
      </div>
    )
  }

  const countryName = aidData?.country_name || countryCode
  const latestYear = aidData?.latest_fiscal_year || aidData?.fiscal_year
  const totalObligation = aidData?.total_obligation ?? 0
  const categories = aidData?.categories || []
  const sourceUrl = aidData?.source_url

  // Build category map for display
  const categoryMap = {}
  for (const cat of categories) {
    categoryMap[cat.name || cat.category] = cat
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Left column — Aid data */}
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: 20,
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', color: '#1e293b', fontSize: 18 }}>
            <DollarSign size={20} color="#1e293b" />
            US Aid &mdash; {countryName}
          </h3>

          {latestYear && (
            <>
              <p style={{ color: '#475569', fontSize: 13, margin: '0 0 8px' }}>
                Fiscal Year {latestYear}
              </p>

              <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
                <SourceCitation
                  value={formatAmount(totalObligation)}
                  sourceUrl={sourceUrl || 'https://www.usaspending.gov'}
                  sourceLabel="USASpending.gov"
                />
              </div>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {CATEGORIES.map(catName => {
                  const cat = categoryMap[catName]
                  const amount = cat?.amount ?? 0
                  const pct = totalObligation > 0 ? (amount / totalObligation) * 100 : 0

                  return (
                    <li key={catName} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                        <span>{catName}</span>
                        <span style={{ fontWeight: 600 }}>
                          <SourceCitation
                            value={formatAmount(amount)}
                            sourceUrl={sourceUrl || 'https://www.usaspending.gov'}
                            sourceLabel="USASpending.gov"
                          />
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(pct, 100)}%`,
                          height: '100%',
                          background: '#3b82f6',
                          borderRadius: 3,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </li>
                  )
                })}
              </ul>

              <a
                href="https://www.usaspending.gov"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, display: 'inline-block' }}
              >
                Source: USASpending.gov
              </a>
            </>
          )}

          {!latestYear && (
            <p style={{ color: '#475569', fontSize: 14 }}>No aid data available for this country.</p>
          )}
        </div>
      </div>

      {/* Right column — Policy comparison */}
      <div style={{ flex: 1, minWidth: 320 }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: 20,
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 18 }}>
            Policy Comparison
          </h3>

          {policies.length === 0 ? (
            <p style={{ color: '#475569', fontSize: 14 }}>No policy comparison data available.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 0', color: '#475569', fontWeight: 600 }}>Policy</th>
                  <th style={{ textAlign: 'center', padding: '10px 0', color: '#475569', fontWeight: 600 }}>{countryName}</th>
                  <th style={{ textAlign: 'center', padding: '10px 0', color: '#475569', fontWeight: 600 }}>United States</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, idx) => (
                  <tr key={policy.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 0', color: '#1e293b' }}>
                      {policy.source_url ? (
                        <a
                          href={policy.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#1e293b', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}
                        >
                          {policy.policy_name || policy.name}
                        </a>
                      ) : (
                        policy.policy_name || policy.name
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 0', verticalAlign: 'top' }}>
                      {policy.country_has_it ? (
                        <CheckCircle size={18} color="#16a34a" />
                      ) : (
                        <XCircle size={18} color="#dc2626" />
                      )}
                      {policy.country_detail && (
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{policy.country_detail}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 0', verticalAlign: 'top' }}>
                      {policy.us_has_it ? (
                        <CheckCircle size={18} color="#16a34a" />
                      ) : (
                        <XCircle size={18} color="#dc2626" />
                      )}
                      {policy.us_detail && (
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{policy.us_detail}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
