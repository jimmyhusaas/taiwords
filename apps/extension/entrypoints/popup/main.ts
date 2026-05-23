/**
 * Popup script — placeholder。
 * Phase 2 後段會在這顯示「本頁標記數」、白名單開關、min_confidence slider。
 */
console.debug('[TaiWords] popup loaded');

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  main { padding: 16px; width: 240px; }
  h1 { margin: 0; font-size: 14px; }
  p { margin: 8px 0 0; font-size: 12px; color: #475569; line-height: 1.5; }
  .meta { color: #94a3b8; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
`;
document.head.appendChild(style);
