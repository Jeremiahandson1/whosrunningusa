import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink, THEMES } from '../shared/widget-base'
import { widgetFetch, formatDollars } from '../shared/api'

export default function HypocrisyIndexWidget({ config }) {
  const [aidData, setAidData] = useState(null)
  const [policyData, setPolicyData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const theme = THEMES[config?.theme] || THEMES.light

  useEffect(() => {
    if (!config.country) {
      setError('No country specified')
      setLoading(false)
      return
    }

    Promise.all([
      widgetFetch(`/foreign-aid/countries/${config.country}`),
      widgetFetch(`/foreign-aid/countries/${config.country}/policies`),
    ])
      .then(([aid, policies]) => {
        setAidData(aid)
        setPolicyData(policies)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [config.country])

  const policiesTheyHaveThatWeDont = policyData?.policies
    ? policyData.policies.filter((p) => p.country_status && !p.us_status).length
    : 0

  const totalAid = aidData?.total_aid ?? 0

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="hypocrisy-index">
      <div style={{ minWidth: 420 }}>
        {/* Header */}
        <div style={{ marginBottom: 14, fontSize: 15, fontWeight: 700, color: theme.text }}>
          US Foreign Aid & Policy Comparison: {aidData?.country_name || config.country}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Left column — Aid breakdown */}
          <div style={{ flex: '0 0 45%' }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textSecondary, marginBottom: 8 }}>
              US Aid This Year
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: theme.accent, marginBottom: 12 }}>
              <SourceLink
                value={formatDollars(totalAid)}
                href={aidData?.source_url}
                label="Total aid source"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AidRow
                label="Military"
                amount={aidData?.military_aid}
                sourceUrl={aidData?.military_source_url}
                theme={theme}
              />
              <AidRow
                label="Economic"
                amount={aidData?.economic_aid}
                sourceUrl={aidData?.economic_source_url}
                theme={theme}
              />
              <AidRow
                label="Humanitarian"
                amount={aidData?.humanitarian_aid}
                sourceUrl={aidData?.humanitarian_source_url}
                theme={theme}
              />
            </div>
          </div>

          {/* Right column — Policy comparison */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textSecondary, marginBottom: 8 }}>
              Policy Comparison
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, fontWeight: 600, fontSize: 11 }}>
                    Policy
                  </th>
                  <th style={{ textAlign: 'center', padding: '4px 6px', borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, fontWeight: 600, fontSize: 11, width: 50 }}>
                    {aidData?.country_code || config.country}
                  </th>
                  <th style={{ textAlign: 'center', padding: '4px 6px', borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, fontWeight: 600, fontSize: 11, width: 50 }}>
                    US
                  </th>
                </tr>
              </thead>
              <tbody>
                {policyData?.policies?.map((policy, i) => (
                  <tr key={policy.id || i}>
                    <td style={{ padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, color: theme.text }}>
                      {policy.name}
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>
                      <StatusIcon active={policy.country_status} theme={theme} />
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>
                      <StatusIcon active={policy.us_status} theme={theme} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary line */}
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${theme.border}`, fontSize: 13, color: theme.textSecondary }}>
          Total aid sent: {formatDollars(totalAid)}. Policies they have that we don't: {policiesTheyHaveThatWeDont}.
        </div>
      </div>
    </WidgetBase>
  )
}

function AidRow({ label, amount, sourceUrl, theme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: theme.textSecondary }}>{label}</span>
      <span style={{ fontWeight: 600, color: theme.text }}>
        <SourceLink value={formatDollars(amount)} href={sourceUrl} label={`${label} aid source`} />
      </span>
    </div>
  )
}

function StatusIcon({ active, theme }) {
  if (active) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
        <circle cx="8" cy="8" r="7" fill={theme.success} opacity="0.15" />
        <path d="M4.5 8L7 10.5L11.5 5.5" stroke={theme.success} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
      <circle cx="8" cy="8" r="7" fill={theme.danger} opacity="0.15" />
      <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke={theme.danger} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
