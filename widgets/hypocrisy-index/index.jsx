import React from 'react'
import { createRoot } from 'react-dom/client'
import { WIDGET_CSS } from '../shared/widget-styles'
import { trackEvent } from '../shared/api'
import HypocrisyIndexWidget from './HypocrisyIndexWidget'

;(function () {
  const script = document.currentScript || document.querySelector('script[src*="hypocrisy-index"]')
  if (!script) return

  const config = {
    country: script.getAttribute('data-country'),
    theme: script.getAttribute('data-theme') || 'light',
    whiteLabel: script.getAttribute('data-white-label') === 'true',
    apiKey: script.getAttribute('data-api-key'),
    attributionPosition: script.getAttribute('data-attribution-position') || 'bottom',
  }

  const container = document.createElement('div')
  container.style.width = '100%'
  script.parentNode.insertBefore(container, script.nextSibling)

  const shadow = container.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = WIDGET_CSS
  shadow.appendChild(styleEl)

  const root = document.createElement('div')
  shadow.appendChild(root)

  createRoot(root).render(<HypocrisyIndexWidget config={config} />)
  trackEvent('hypocrisy-index', 'embed', { country: config.country }, config.apiKey)
})()
