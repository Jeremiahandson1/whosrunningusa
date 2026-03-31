import React, { useState, useEffect } from 'react'

// Theme CSS variables
const THEMES = {
  light: { bg: '#ffffff', text: '#1e293b', textSecondary: '#475569', border: '#e2e8f0', cardBg: '#f8fafc', accent: '#2c4a72', danger: '#dc2626', success: '#16a34a', warning: '#ca8a04' },
  dark: { bg: '#1e293b', text: '#f8fafc', textSecondary: '#94a3b8', border: '#334155', cardBg: '#0f172a', accent: '#4a6fa5', danger: '#ef4444', success: '#22c55e', warning: '#eab308' },
}

export function WidgetBase({ children, loading, error, config, widgetType }) {
  const theme = THEMES[config?.theme] || THEMES.light
  const isWhiteLabel = config?.whiteLabel === true || config?.whiteLabel === 'true'
  const attrPos = config?.attributionPosition || 'bottom'

  const containerStyle = {
    fontFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 14,
    lineHeight: 1.5,
    color: theme.text,
    background: theme.bg,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    overflow: 'hidden',
    maxWidth: '100%',
  }

  const attribution = !isWhiteLabel ? (
    <div style={{ padding: '8px 12px', borderTop: `1px solid ${theme.border}`, textAlign: 'center', fontSize: 11, color: theme.textSecondary }}>
      Data: <a href="https://whosrunningusa.com" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, textDecoration: 'none' }}>WhosRunningUSA.com</a>
    </div>
  ) : (
    <div style={{ padding: '6px 12px', borderTop: `1px solid ${theme.border}`, textAlign: 'center', fontSize: 10, color: theme.textSecondary }}>
      Transparency data
    </div>
  )

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 24, textAlign: 'center', color: theme.textSecondary }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, border: `3px solid ${theme.border}`, borderTopColor: theme.accent, borderRadius: '50%', animation: 'wrusa-spin 0.8s linear infinite' }} />
          <style>{`@keyframes wrusa-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 16, textAlign: 'center', color: theme.danger, fontSize: 13 }}>
          Unable to load widget data.
        </div>
        {attribution}
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {attrPos === 'top' && attribution}
      <div style={{ padding: '16px' }}>{children}</div>
      {attrPos !== 'top' && attribution}
    </div>
  )
}

export function SourceLink({ value, href, label }) {
  if (!href) return <span>{value}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label || 'View source'}
      style={{ color: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: '#94a3b8', textUnderlineOffset: '2px', cursor: 'pointer' }}
    >
      {value}
    </a>
  )
}

export { THEMES }
