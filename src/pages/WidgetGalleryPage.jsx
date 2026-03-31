import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Code, TrendingUp, Calculator, CheckCircle, EyeOff,
  AlertTriangle, Scale, Stamp, Copy, Check, X, Sun, Moon,
  ChevronUp, ChevronDown, Globe, BarChart3
} from 'lucide-react'
import api from '../utils/api'

const EMBED_BASE = 'https://whosrunningusa-api.onrender.com/widgets'

const ICON_MAP = {
  TrendingUp,
  Calculator,
  CheckCircle,
  EyeOff,
  AlertTriangle,
  Scale,
  Stamp,
}

const WIDGETS = [
  { id: 'roi-calculator', name: 'ROI Calculator', icon: 'TrendingUp', desc: 'Political spending vs policy returns for any corporation or industry.', dataAttr: 'data-entity', placeholder: 'e.g. lockheed-martin' },
  { id: 'cost-calculator', name: 'Cost to You', icon: 'Calculator', desc: 'What any war, bailout, or bill cost your household.', dataAttr: 'data-item', placeholder: 'e.g. iraq-war' },
  { id: 'promise-scorecard', name: 'Promise Scorecard', icon: 'CheckCircle', desc: 'Every campaign promise tracked. Met, broken, in progress.', dataAttr: 'data-candidate', placeholder: 'candidate UUID' },
  { id: 'dark-money-meter', name: 'Dark Money Meter', icon: 'EyeOff', desc: 'Disclosed vs unaccounted outside spending for any candidate.', dataAttr: 'data-candidate', placeholder: 'candidate UUID' },
  { id: 'conflict-flag', name: 'Conflict of Interest', icon: 'AlertTriangle', desc: 'Stock trades cross-referenced with voting records.', dataAttr: 'data-candidate', placeholder: 'candidate UUID' },
  { id: 'hypocrisy-index', name: 'Hypocrisy Index', icon: 'Scale', desc: 'US aid to a country vs policies they have that we don\'t.', dataAttr: 'data-country', placeholder: 'e.g. ISR' },
  { id: 'rubber-stamp', name: 'Rubber Stamp Score', icon: 'Stamp', desc: 'Party loyalty vs donor alignment — representative or rubber stamp?', dataAttr: 'data-candidate', placeholder: 'candidate UUID' },
]

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
  },
  hero: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    color: '#fff',
    padding: '64px 24px 56px',
    textAlign: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    margin: '0 auto 20px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 800,
    margin: '0 0 12px',
    letterSpacing: '-0.02em',
  },
  heroSub: {
    fontSize: 18,
    color: '#94a3b8',
    maxWidth: 640,
    margin: '0 auto',
    lineHeight: 1.6,
  },
  container: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '40px 24px 80px',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 20,
    marginBottom: 48,
  },
  card: (isSelected) => ({
    background: '#fff',
    borderRadius: 12,
    border: isSelected ? '2px solid #2563eb' : '2px solid #e2e8f0',
    padding: 24,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: isSelected ? '0 4px 16px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
  }),
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardIconWrap: (isSelected) => ({
    width: 40,
    height: 40,
    borderRadius: 10,
    background: isSelected ? '#eff6ff' : '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  cardName: {
    fontSize: 17,
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  cardDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  cardBtn: (isSelected) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: isSelected ? '#2563eb' : '#f1f5f9',
    color: isSelected ? '#fff' : '#475569',
    transition: 'all 0.15s ease',
  }),
  configPanel: {
    background: '#fff',
    borderRadius: 16,
    border: '2px solid #2563eb',
    padding: 32,
    marginBottom: 48,
    boxShadow: '0 4px 24px rgba(37,99,235,0.08)',
  },
  configHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  configTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  toggleRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  toggleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    marginRight: 4,
  },
  toggleBtn: (active) => ({
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid',
    borderColor: active ? '#2563eb' : '#d1d5db',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#2563eb' : '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  }),
  codeBlock: {
    position: 'relative',
    background: '#0f172a',
    borderRadius: 10,
    padding: 20,
    overflow: 'auto',
    marginTop: 16,
  },
  pre: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.7,
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
  },
  copyBtn: (copied) => ({
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: copied ? '#16a34a' : 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  syntaxTag: { color: '#f472b6' },
  syntaxAttr: { color: '#67e8f9' },
  syntaxString: { color: '#a5f3fc' },
  syntaxComment: { color: '#64748b', fontStyle: 'italic' },
  adminSection: {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    padding: 32,
    marginTop: 48,
  },
  adminTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: '#f8fafc',
    borderRadius: 10,
    padding: 20,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 4px',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 500,
  },
  domainList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  domainItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 14,
  },
  domainName: {
    color: '#0f172a',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  domainCount: {
    color: '#64748b',
    fontSize: 13,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 6,
    background: '#f0fdf4',
    color: '#16a34a',
    fontSize: 11,
    fontWeight: 700,
  },
}

function WidgetGalleryPage() {
  const { user } = useAuth()
  const [selectedWidget, setSelectedWidget] = useState(null)
  const [entityValue, setEntityValue] = useState('')
  const [theme, setTheme] = useState('light')
  const [attribution, setAttribution] = useState('bottom')
  const [copied, setCopied] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)

  const isAdmin = user && user.user_type === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    setAnalyticsLoading(true)
    api.get('/widgets/analytics', true)
      .then(data => {
        setAnalytics(data)
        setAnalyticsError(null)
      })
      .catch(err => setAnalyticsError(err.message || 'Failed to load analytics'))
      .finally(() => setAnalyticsLoading(false))
  }, [isAdmin])

  function handleSelectWidget(widget) {
    if (selectedWidget && selectedWidget.id === widget.id) {
      setSelectedWidget(null)
      return
    }
    setSelectedWidget(widget)
    setEntityValue('')
    setCopied(false)
  }

  function generateEmbedCode() {
    if (!selectedWidget) return ''
    const w = selectedWidget
    const val = entityValue.trim() || w.placeholder
    const lines = [
      `<!-- WhosRunningUSA ${w.name} Widget -->`,
      `<div class="wru-widget"`,
      `     ${w.dataAttr}="${val}"`,
      `     data-theme="${theme}"`,
      `     data-attribution="${attribution}">`,
      `</div>`,
      `<script src="${EMBED_BASE}/${w.id}.js" async></script>`,
    ]
    return lines.join('\n')
  }

  async function handleCopy() {
    const code = generateEmbedCode()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  function renderSyntaxHighlighted(code) {
    // Simple syntax highlighting for HTML embed code
    return code.split('\n').map((line, i) => {
      if (line.trim().startsWith('<!--')) {
        return <div key={i}><span style={styles.syntaxComment}>{line}</span></div>
      }
      // Highlight tags, attributes, strings
      const parts = []
      let remaining = line
      let keyIdx = 0
      const regex = /(<\/?[\w-]+|>|[\w-]+="[^"]*"|src="[^"]*"|async)/g
      let match
      let lastIndex = 0
      while ((match = regex.exec(remaining)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={keyIdx++}>{remaining.slice(lastIndex, match.index)}</span>)
        }
        const token = match[0]
        if (token.startsWith('<') || token === '>') {
          parts.push(<span key={keyIdx++} style={styles.syntaxTag}>{token}</span>)
        } else if (token === 'async') {
          parts.push(<span key={keyIdx++} style={styles.syntaxAttr}>{token}</span>)
        } else if (token.includes('=')) {
          const eqPos = token.indexOf('=')
          const attrName = token.slice(0, eqPos)
          const attrVal = token.slice(eqPos)
          parts.push(
            <span key={keyIdx++}>
              <span style={styles.syntaxAttr}>{attrName}</span>
              <span style={styles.syntaxString}>{attrVal}</span>
            </span>
          )
        } else {
          parts.push(<span key={keyIdx++}>{token}</span>)
        }
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < remaining.length) {
        parts.push(<span key={keyIdx}>{remaining.slice(lastIndex)}</span>)
      }
      return <div key={i}>{parts}</div>
    })
  }

  return (
    <div style={styles.page}>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroIcon}>
          <Code size={28} color="#60a5fa" />
        </div>
        <h1 style={styles.heroTitle}>Embed WhosRunningUSA</h1>
        <p style={styles.heroSub}>
          Free embeddable widgets for news organizations, nonprofits, and civic organizations.
          Every number sourced. Every widget auto-updating.
        </p>
      </div>

      <div style={styles.container}>
        {/* Configuration Panel (shown when a widget is selected) */}
        {selectedWidget && (
          <div style={styles.configPanel}>
            <div style={styles.configHeader}>
              <h2 style={styles.configTitle}>
                Configure: {selectedWidget.name}
              </h2>
              <button
                style={styles.closeBtn}
                onClick={() => setSelectedWidget(null)}
                aria-label="Close configuration"
              >
                <X size={16} />
              </button>
            </div>

            {/* Entity input */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                {selectedWidget.dataAttr === 'data-entity' && 'Entity (corporation or industry slug)'}
                {selectedWidget.dataAttr === 'data-item' && 'Item (program or bill slug)'}
                {selectedWidget.dataAttr === 'data-candidate' && 'Candidate UUID'}
                {selectedWidget.dataAttr === 'data-country' && 'Country Code (ISO 3166 alpha-3)'}
              </label>
              <input
                style={styles.input}
                type="text"
                placeholder={selectedWidget.placeholder}
                value={entityValue}
                onChange={(e) => {
                  setEntityValue(e.target.value)
                  setCopied(false)
                }}
              />
            </div>

            {/* Toggle row */}
            <div style={styles.toggleRow}>
              <div style={styles.toggleGroup}>
                <span style={styles.toggleLabel}>Theme:</span>
                <button
                  style={styles.toggleBtn(theme === 'light')}
                  onClick={() => { setTheme('light'); setCopied(false) }}
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  style={styles.toggleBtn(theme === 'dark')}
                  onClick={() => { setTheme('dark'); setCopied(false) }}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>

              <div style={styles.toggleGroup}>
                <span style={styles.toggleLabel}>Attribution:</span>
                <button
                  style={styles.toggleBtn(attribution === 'top')}
                  onClick={() => { setAttribution('top'); setCopied(false) }}
                >
                  <ChevronUp size={14} /> Top
                </button>
                <button
                  style={styles.toggleBtn(attribution === 'bottom')}
                  onClick={() => { setAttribution('bottom'); setCopied(false) }}
                >
                  <ChevronDown size={14} /> Bottom
                </button>
              </div>
            </div>

            {/* Generated embed code */}
            <label style={styles.label}>Embed Code</label>
            <div style={styles.codeBlock}>
              <button style={styles.copyBtn(copied)} onClick={handleCopy}>
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
              <pre style={styles.pre}>
                {renderSyntaxHighlighted(generateEmbedCode())}
              </pre>
            </div>
          </div>
        )}

        {/* Widget Gallery Grid */}
        <h2 style={styles.sectionTitle}>Available Widgets</h2>
        <div style={styles.grid}>
          {WIDGETS.map((w) => {
            const isSelected = selectedWidget && selectedWidget.id === w.id
            const IconComponent = ICON_MAP[w.icon] || Code
            return (
              <div
                key={w.id}
                style={styles.card(isSelected)}
                onClick={() => handleSelectWidget(w)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelectWidget(w) }}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.cardIconWrap(isSelected)}>
                    <IconComponent size={20} color={isSelected ? '#2563eb' : '#64748b'} />
                  </div>
                  <h3 style={styles.cardName}>{w.name}</h3>
                </div>
                <p style={styles.cardDesc}>{w.desc}</p>
                <button
                  style={styles.cardBtn(isSelected)}
                  onClick={(e) => { e.stopPropagation(); handleSelectWidget(w) }}
                >
                  {isSelected ? 'Close' : 'Preview & Get Code'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Admin Analytics Section */}
        {isAdmin && (
          <div style={styles.adminSection}>
            <h2 style={styles.adminTitle}>
              <BarChart3 size={22} color="#2563eb" />
              Widget Analytics
            </h2>

            {analyticsLoading && (
              <p style={{ color: '#64748b', fontSize: 14 }}>Loading analytics...</p>
            )}

            {analyticsError && (
              <p style={{ color: '#dc2626', fontSize: 14 }}>Error: {analyticsError}</p>
            )}

            {analytics && !analyticsLoading && (
              <>
                <div style={styles.statGrid}>
                  <div style={styles.statCard}>
                    <p style={styles.statValue}>
                      {(analytics.totalEmbeds || 0).toLocaleString()}
                    </p>
                    <p style={styles.statLabel}>Total Embeds</p>
                  </div>
                  <div style={styles.statCard}>
                    <p style={styles.statValue}>
                      {(analytics.uniqueDomains || 0).toLocaleString()}
                    </p>
                    <p style={styles.statLabel}>Unique Domains</p>
                  </div>
                  <div style={styles.statCard}>
                    <p style={styles.statValue}>
                      {(analytics.totalLoads || 0).toLocaleString()}
                    </p>
                    <p style={styles.statLabel}>Total Loads (30d)</p>
                  </div>
                </div>

                {analytics.topDomains && analytics.topDomains.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
                      Top Domains
                    </h3>
                    <ul style={styles.domainList}>
                      {analytics.topDomains.map((d, i) => (
                        <li key={i} style={styles.domainItem}>
                          <span style={styles.domainName}>
                            <Globe size={14} color="#64748b" />
                            {d.domain}
                          </span>
                          <span style={styles.domainCount}>
                            {(d.count || d.embed_count || 0).toLocaleString()} embeds
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default WidgetGalleryPage
