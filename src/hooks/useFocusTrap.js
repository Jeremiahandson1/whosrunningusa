import { useEffect, useRef, useCallback } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps focus within a container while active.
 * Returns a ref to attach to the modal/dialog container.
 *
 * @param {boolean} active - Whether the trap is active
 * @param {function} onEscape - Called when Escape is pressed
 * @returns {{ trapRef: React.RefObject, returnFocusRef: React.RefObject }}
 */
export default function useFocusTrap(active, onEscape) {
  const trapRef = useRef(null)
  const returnFocusRef = useRef(null)

  // Capture the element that had focus before the trap activated
  useEffect(() => {
    if (active) {
      returnFocusRef.current = document.activeElement
    }
  }, [active])

  // Focus the first focusable element when the trap activates
  useEffect(() => {
    if (!active || !trapRef.current) return

    const container = trapRef.current
    const focusable = container.querySelectorAll(FOCUSABLE_SELECTORS)
    if (focusable.length > 0) {
      focusable[0].focus()
    }
  }, [active])

  // Handle Tab cycling and Escape
  const handleKeyDown = useCallback((e) => {
    if (!active || !trapRef.current) return

    if (e.key === 'Escape') {
      e.preventDefault()
      if (onEscape) onEscape()
      return
    }

    if (e.key !== 'Tab') return

    const container = trapRef.current
    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS))
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [active, onEscape])

  useEffect(() => {
    if (!active) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, handleKeyDown])

  // Return focus to trigger element when trap deactivates
  useEffect(() => {
    return () => {
      if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
        // Use a microtask so focus restore happens after DOM updates
        const el = returnFocusRef.current
        Promise.resolve().then(() => {
          if (el && typeof el.focus === 'function') {
            el.focus()
          }
        })
      }
    }
  }, [active])

  return { trapRef }
}
