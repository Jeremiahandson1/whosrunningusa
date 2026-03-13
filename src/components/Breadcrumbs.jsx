import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        padding: '0.75rem 0',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.375rem',
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <ChevronRight
                size={14}
                style={{ color: 'var(--slate-400)', flexShrink: 0 }}
              />
            )}
            {isLast ? (
              <span style={{ color: 'var(--slate-500)', fontWeight: 500 }}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                style={{
                  color: 'var(--navy-600)',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default Breadcrumbs
