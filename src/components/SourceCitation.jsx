import React, { useState, useRef, useEffect } from 'react'

/**
 * SourceCitation — renders a value as a clickable link to its source document.
 * Every number on every accountability page must use this component.
 *
 * Props:
 *   value       — the formatted string or number to display
 *   sourceUrl   — URL to the source document
 *   sourceLabel — human-readable source name (e.g. "GAO Report 2024")
 *   sourceDate  — optional date string for the source
 *   inline      — if true, renders inline without block wrapper (default true)
 */
export default function SourceCitation({ value, sourceUrl, sourceLabel, sourceDate, inline = true }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const ref = useRef(null)
  const tooltipRef = useRef(null)

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!showTooltip) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTooltip])

  if (!sourceUrl) {
    return <span>{value}</span>
  }

  const Wrapper = inline ? 'span' : 'div'

  return (
    <Wrapper ref={ref} style={{ position: 'relative', display: inline ? 'inline' : 'block' }}>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        style={{
          color: 'inherit',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textDecorationColor: '#94a3b8',
          textUnderlineOffset: '2px',
          cursor: 'pointer',
        }}
        aria-label={`${value} — source: ${sourceLabel || sourceUrl}`}
      >
        {value}
      </a>
      {showTooltip && (
        <span
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            padding: '6px 10px',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            whiteSpace: 'nowrap',
            zIndex: 50,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {sourceLabel || 'Source'}
          {sourceDate && (
            <span style={{ color: '#94a3b8', marginLeft: 6 }}>({sourceDate})</span>
          )}
        </span>
      )}
    </Wrapper>
  )
}
