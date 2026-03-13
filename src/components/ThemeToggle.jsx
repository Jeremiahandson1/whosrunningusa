import React, { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  const [manuallySet, setManuallySet] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored === 'dark' || stored === 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    if (manuallySet) {
      localStorage.setItem('theme', theme)
    }
  }, [theme, manuallySet])

  // Listen for system preference changes when no manual override
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      if (!manuallySet) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [manuallySet])

  const toggle = () => {
    setManuallySet(true)
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        color: 'var(--slate-600)',
        transition: 'color 150ms ease',
      }}
      className="theme-toggle-btn"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}

export default ThemeToggle
