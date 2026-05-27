/**
 * Popup script — Phase 2：
 * - 掃描按鈕 → chrome.tabs.sendMessage 觸發 content script 掃當前 tab
 * - 清除按鈕 → 移除所有 inline 標記
 * - min_confidence slider → chrome.storage.local 持久化，下次掃描套用
 * - 結果區塊：顯示標記筆數 / 總命中 / 字數
 */

interface ScanResult {
  ok: boolean;
  highlighted: number;
  totalMatches: number;
  charCount: number;
  error?: string;
}

const STORAGE_KEY = 'minConfidence';
const DEFAULT_CONF = 0.7;

const scanBtn = document.getElementById('scan') as HTMLButtonElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const confInput = document.getElementById('conf') as HTMLInputElement;
const confVal = document.getElementById('conf-val')!;
const resultEl = document.getElementById('result')!;

injectStyles();
init();

function init() {
  // Storage hydration 是 async；在它完成前 disable scan，避免 race —
  // 否則使用者打開 popup 立刻按 Scan 會用 HTML default (0.7) 而非
  // storage 中持久化的偏好值，先前的調整被靜默忽略。
  scanBtn.disabled = true;
  chrome.storage.local.get([STORAGE_KEY], (items) => {
    const v = typeof items[STORAGE_KEY] === 'number' ? items[STORAGE_KEY] : DEFAULT_CONF;
    confInput.value = String(v);
    confVal.textContent = v.toFixed(2);
    scanBtn.disabled = false;
  });

  confInput.addEventListener('input', () => {
    const v = parseFloat(confInput.value);
    confVal.textContent = v.toFixed(2);
    chrome.storage.local.set({ [STORAGE_KEY]: v });
  });

  scanBtn.addEventListener('click', onScan);
  clearBtn.addEventListener('click', onClear);
}

async function onScan() {
  scanBtn.disabled = true;
  scanBtn.textContent = '掃描中…';
  setResult('scanning', '掃描中…');
  try {
    const tab = await activeTab();
    if (!tab?.id) throw new Error('找不到當前分頁');
    const result = await sendToTab<ScanResult>(tab.id, {
      type: 'taiwords:scan',
      minConfidence: parseFloat(confInput.value),
    });
    if (!result) {
      // content script 沒注入（chrome://、Web Store 等）或 listener 沒回應
      setResult('error', '無法掃描', '本頁面不支援掃描（系統頁 / 商店等）');
      return;
    }
    if (!result.ok) {
      setResult('error', '連線失敗', result.error ?? '請確認 API 在 localhost:8080 運行');
      return;
    }
    if (result.highlighted === 0) {
      setResult('clean', `沒偵測到 (掃描 ${result.charCount} 字)`);
      return;
    }
    setResult(
      'hits',
      `本頁標記 ${result.highlighted} 筆`,
      `共命中 ${result.totalMatches} / 掃描 ${result.charCount} 字`,
    );
  } catch (e) {
    setResult('error', '無法掃描', String(e));
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = '掃描本頁';
  }
}

async function onClear() {
  try {
    const tab = await activeTab();
    if (!tab?.id) return;
    const result = await sendToTab<{ ok: boolean; cleared: number }>(tab.id, {
      type: 'taiwords:clear',
    });
    if (!result) {
      setResult('error', '無法清除', '本頁面不支援掃描（系統頁 / 商店等）');
      return;
    }
    setResult('idle', result.cleared > 0 ? `清除了 ${result.cleared} 個標記` : '尚未掃描');
  } catch (e) {
    setResult('error', '清除失敗', String(e));
  }
}

function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function sendToTab<T>(tabId: number, msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message ?? 'sendMessage failed'));
      else resolve(response);
    });
  });
}

function setResult(state: 'idle' | 'scanning' | 'clean' | 'hits' | 'error', main: string, detail?: string) {
  resultEl.className = `result ${state}`;
  resultEl.innerHTML = `
    <p class="status">${escapeHtml(main)}</p>
    ${detail ? `<p class="detail">${escapeHtml(detail)}</p>` : ''}
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :root { color-scheme: light; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
    main { padding: 14px 16px; width: 280px; display: flex; flex-direction: column; gap: 12px; }

    header h1 { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .badge { font-size: 11px; padding: 2px 6px; background: #0f172a; color: #fff; border-radius: 4px; }
    .tagline { margin: 2px 0 0; font-size: 11px; color: #64748b; }

    .actions { display: flex; gap: 8px; }
    button { flex: 1; padding: 7px 10px; font-size: 12px; border-radius: 6px; cursor: pointer; font-family: inherit; }
    button.primary { background: #0f172a; color: #fff; border: 0; }
    button.primary:hover:not(:disabled) { background: #1e293b; }
    button.primary:disabled { background: #94a3b8; cursor: wait; }
    button.ghost { background: transparent; border: 1px solid #cbd5e1; color: #475569; }
    button.ghost:hover { background: #f1f5f9; }

    .control label { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; color: #475569; font-weight: 500; margin-bottom: 6px; }
    #conf-val { font-variant-numeric: tabular-nums; color: #0f172a; font-weight: 600; }
    .control input[type=range] { width: 100%; }
    .hint { margin: 4px 0 0; font-size: 10px; color: #94a3b8; line-height: 1.4; }

    .result { padding: 10px 12px; border-radius: 6px; background: #f1f5f9; }
    .result .status { margin: 0; font-size: 12px; font-weight: 500; }
    .result .detail { margin: 4px 0 0; font-size: 11px; color: #64748b; }
    .result.idle .status { color: #94a3b8; }
    .result.scanning .status { color: #0ea5e9; }
    .result.clean .status { color: #16a34a; }
    .result.hits { background: rgba(239, 68, 68, 0.08); }
    .result.hits .status { color: #b91c1c; }
    .result.error { background: rgba(245, 158, 11, 0.10); }
    .result.error .status { color: #b45309; }

    footer { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
    footer a { color: #475569; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  `;
  document.head.appendChild(style);
}
