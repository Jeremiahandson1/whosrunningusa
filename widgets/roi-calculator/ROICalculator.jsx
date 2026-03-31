import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink } from '../shared/widget-base'
import { widgetFetch, formatDollars } from '../shared/api'

export default function ROICalculator({ config }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!config.entity) {
      setError('No entity specified')
      setLoading(false)
      return
    }

    let url = `/widgets/roi?entity=${encodeURIComponent(config.entity)}`
    if (config.cycle) url += `&cycle=${encodeURIComponent(config.cycle)}`

    widgetFetch(url)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [config.entity, config.cycle])

  const roiRatio = data && data.total_spend > 0
    ? (data.total_return / data.total_spend).toFixed(0)
    : null

  const styles = {
    container: { minWidth: 300, maxWidth: 500 },
    header: { marginBottom: 16 },
    entityName: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
    cycle: { fontSize: 12, color: '#64748b' },
    roiBox: {
      background: '#f0f9ff',
      border: '1px solid #bae6fd',
      borderRadius: 8,
      padding: 16,
      textAlign: 'center',
      marginBottom: 16,
    },
    roiMultiplier: { fontSize: 32, fontWeight: 800, color: '#2c4a72' },
    roiLabel: { fontSize: 13, color: '#475569', marginTop: 4 },
    statsRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    statBox: {
      flex: 1,
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      padding: '10px 12px',
      textAlign: 'center',
    },
    statValue: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 },
    listItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid #f1f5f9',
      fontSize: 13,
    },
    listName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 },
    listAmount: { fontWeight: 600, whiteSpace: 'nowrap' },
    link: { color: '#2c4a72', textDecoration: 'none' },
    section: { marginBottom: 16 },
  }

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="roi-calculator">
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.entityName}>{data?.entity_name}</div>
          {config.cycle && <div style={styles.cycle}>{config.cycle} Cycle</div>}
        </div>

        {roiRatio && (
          <div style={styles.roiBox}>
            <div style={styles.roiMultiplier}>{roiRatio}x</div>
            <div style={styles.roiLabel}>
              For every <strong>$1</strong> spent on politics, received <strong>${roiRatio}</strong> in return
            </div>
          </div>
        )}

        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>
              <SourceLink value={formatDollars(data?.total_spend)} href={data?.spend_source_url} label="Political spending source" />
            </div>
            <div style={styles.statLabel}>Total Political Spend</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>
              <SourceLink value={formatDollars(data?.total_return)} href={data?.return_source_url} label="Policy return source" />
            </div>
            <div style={styles.statLabel}>Total Policy Return</div>
          </div>
        </div>

        {data?.top_politicians?.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Top Politicians Funded</div>
            {data.top_politicians.slice(0, 5).map((p, i) => (
              <div key={i} style={styles.listItem}>
                <div style={styles.listName}>
                  <a href={`https://whosrunningusa.com/candidate/${p.slug || p.candidate_id}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {p.name}
                  </a>
                  {p.office && <span style={{ color: '#94a3b8', fontSize: 11 }}> — {p.office}</span>}
                </div>
                <div style={styles.listAmount}>
                  <SourceLink value={formatDollars(p.amount)} href={p.source_url} label="Contribution source" />
                </div>
              </div>
            ))}
          </div>
        )}

        {data?.top_contracts?.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Top Contracts &amp; Policy Wins</div>
            {data.top_contracts.slice(0, 5).map((c, i) => (
              <div key={i} style={styles.listItem}>
                <div style={styles.listName}>
                  <SourceLink
                    value={c.description}
                    href={c.source_url}
                    label="Contract/policy source"
                  />
                </div>
                <div style={styles.listAmount}>
                  <SourceLink value={formatDollars(c.amount)} href={c.source_url} label="Amount source" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetBase>
  )
}
