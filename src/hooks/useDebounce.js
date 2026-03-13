import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of the provided value.
 * The returned value only updates after `delay` ms of inactivity.
 */
export default function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
