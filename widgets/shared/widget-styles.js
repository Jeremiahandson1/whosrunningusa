export const RESET_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  a { color: inherit; }
  img { max-width: 100%; }
`;

export const WIDGET_CSS = `
  ${RESET_CSS}
  @keyframes wrusa-spin { to { transform: rotate(360deg); } }
  .wrusa-widget { font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.5; }
  .wrusa-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .wrusa-bar { height: 8px; border-radius: 4px; overflow: hidden; background: #e2e8f0; }
  .wrusa-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
`;
