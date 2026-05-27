/**
 * Content script — Phase 2 進階：inline 標記 + popup 雙向通訊。
 *
 * 流程：
 *   1. 走訪頁面所有可見 text node（避開 SCRIPT/STYLE/INPUT 等與已標記節點）
 *   2. 串成一個大字串，記錄每個 node 在大字串中的 offset 區段
 *   3. 一次 POST /detect，拿回 character-offset 範圍的 matches
 *   4. 從尾到頭逐個 wrap match 範圍成 <span class="taiwords-mark">，加 title 當 tooltip
 *      （從尾到頭可避免後續 offset 被前面 split 出來的節點打亂）
 *
 * 觸發來源：
 *   - 右下角浮動按鈕（保留方便快速 demo）
 *   - chrome.runtime message 'scan'（popup 觸發）
 *
 * min_confidence：從 chrome.storage.local 讀，預設 0.7（與後端對齊）。
 */

interface DetectMatch {
  termId: string;
  slug: string;
  matchedText: string;
  start: number;
  end: number;
  suggestedZhTw: string;
  confidence: number;
  type: string;
  note: string | null;
}

interface DetectResponse {
  text: string;
  matches: DetectMatch[];
  stats: { charCount: number; matchCount: number; alertRatio: number };
}

interface ScanResult {
  ok: boolean;
  highlighted: number;
  totalMatches: number;
  charCount: number;
  error?: string;
}

const API_BASE = 'http://localhost:8080/api/v1';
const MAX_CHARS = 10_000;
const STYLE_ID = 'taiwords-style';
const MARK_CLASS = 'taiwords-mark';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    injectStyles();
    mountFloatingButton();

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'taiwords:scan') {
        scanPage(msg.minConfidence).then(sendResponse);
        return true; // keep channel open for async sendResponse
      }
      if (msg?.type === 'taiwords:clear') {
        const cleared = clearMarks();
        sendResponse({ ok: true, cleared });
        return false;
      }
    });
  },
});

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${MARK_CLASS} {
      border-bottom: 2px dotted #ef4444;
      background: rgba(239, 68, 68, 0.10);
      cursor: help;
      border-radius: 2px;
      padding: 0 1px;
    }
    .${MARK_CLASS}[data-confidence-band="low"] {
      border-bottom-color: #f59e0b;
      background: rgba(245, 158, 11, 0.10);
    }
  `;
  document.head.appendChild(style);
}

const FLOATING_BUTTON_LABEL = '台詞 ⚑';

function mountFloatingButton() {
  const btn = document.createElement('button');
  btn.textContent = FLOATING_BUTTON_LABEL;
  btn.title = 'TaiWords — 掃描本頁疑似支語';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    padding: '8px 14px',
    background: '#0f172a',
    color: '#fff',
    border: '0',
    borderRadius: '20px',
    cursor: 'pointer',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  } as CSSStyleDeclaration);

  // 用一個 token 認證最新一次 click，避免前次 click 的 setTimeout
  // 把按鈕文字蓋回 stale 結果（例如 2.5s 內連點兩次）。
  let clickToken = 0;
  btn.addEventListener('click', async () => {
    const myToken = ++clickToken;
    btn.disabled = true;
    btn.textContent = '掃描中…';
    const conf = await readStoredConfidence();
    const result = await scanPage(conf);
    btn.disabled = false;
    btn.textContent = !result.ok
      ? '⚠ 連線失敗'
      : result.highlighted === 0
        ? '✓ 沒偵測到'
        : `✓ 標記 ${result.highlighted} 筆`;
    setTimeout(() => {
      if (myToken === clickToken) btn.textContent = FLOATING_BUTTON_LABEL;
    }, 2500);
  });

  document.body.appendChild(btn);
}

async function readStoredConfidence(): Promise<number | undefined> {
  return new Promise((resolve) => {
    chrome.storage?.local.get(['minConfidence'], (items) => {
      const v = items?.minConfidence;
      resolve(typeof v === 'number' ? v : undefined);
    });
  });
}

async function scanPage(minConfidence?: number): Promise<ScanResult> {
  try {
    clearMarks(); // 重新掃前先清舊標記，避免疊加
    const { bigText, segments } = collectTextNodes();
    if (bigText.length === 0) {
      return { ok: true, highlighted: 0, totalMatches: 0, charCount: 0 };
    }
    const payload: Record<string, unknown> = { text: bigText };
    if (typeof minConfidence === 'number') {
      payload.options = { minConfidence };
    }
    const res = await fetch(`${API_BASE}/detect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, highlighted: 0, totalMatches: 0, charCount: bigText.length, error: `API ${res.status}` };
    }
    const data: DetectResponse = await res.json();
    const highlighted = applyMarks(segments, data.matches);
    return {
      ok: true,
      highlighted,
      totalMatches: data.matches.length,
      charCount: bigText.length,
    };
  } catch (e) {
    console.error('[TaiWords]', e);
    return { ok: false, highlighted: 0, totalMatches: 0, charCount: 0, error: String(e) };
  }
}

type Segment = { node: Text; start: number; end: number };

/**
 * 走訪頁面所有可見 text node，串成大字串並記錄每個 node 的 offset 區段。
 * 用 \n 當分隔避免相鄰節點誤組成新詞。
 */
function collectTextNodes(): { bigText: string; segments: Segment[] } {
  const segments: Segment[] = [];
  // 用 closest() 檢查祖先而非只看 immediate parent — 嵌套在 <pre><code><span> 內的
  // 程式碼 / syntax-highlighted token 也要跳過，否則 Stack Overflow / MDN / GitHub
  // 之類的技術網站上的程式碼會被誤標。
  const SKIP_SELECTOR = 'script, style, noscript, textarea, code, pre';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`.${MARK_CLASS}`)) return NodeFilter.FILTER_REJECT;
      const text = node.textContent;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let bigText = '';
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = (n as Text).textContent ?? '';
    const start = bigText.length;
    bigText += text;
    segments.push({ node: n as Text, start, end: bigText.length });
    bigText += '\n';
    if (bigText.length >= MAX_CHARS) break;
  }
  return { bigText: bigText.slice(0, MAX_CHARS), segments };
}

/**
 * 把 matches 對應回 DOM 範圍並 wrap 成 <span class="taiwords-mark">。
 * 從尾到頭處理避免 split 出來的新節點打亂後續 offset。
 */
function applyMarks(segments: Segment[], matches: DetectMatch[]): number {
  let highlighted = 0;
  const sorted = [...matches].sort((a, b) => b.start - a.start);
  for (const m of sorted) {
    const seg = findSegmentFor(segments, m.start, m.end);
    if (!seg) continue; // 跨越節點邊界（含 \n 分隔），略過
    try {
      wrapInNode(seg.node, m.start - seg.start, m.end - seg.start, m);
      highlighted++;
    } catch (e) {
      console.debug('[TaiWords] wrap failed', m, e);
    }
  }
  return highlighted;
}

function findSegmentFor(segments: Segment[], start: number, end: number): Segment | null {
  // segments 排序由小到大，可以 binary search；長度有限直接線性
  for (const s of segments) {
    if (start >= s.start && end <= s.end) return s;
    if (s.start > end) return null;
  }
  return null;
}

function wrapInNode(node: Text, start: number, end: number, match: DetectMatch) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const span = document.createElement('span');
  span.className = MARK_CLASS;
  span.dataset.slug = match.slug;
  span.dataset.confidenceBand = match.confidence >= 0.85 ? 'high' : 'low';
  span.title = formatTooltip(match);
  range.surroundContents(span);
}

function formatTooltip(m: DetectMatch): string {
  const pct = Math.round(m.confidence * 100);
  const typeLabel = m.type === 'cn_only' ? '中國特有'
    : m.type === 'same_name_diff_meaning' ? '同名異實，需看上下文'
    : '同義異名';
  const note = m.note ? `\n\n${m.note.trim()}` : '';
  return `${m.matchedText} → ${m.suggestedZhTw}\n信心度 ${pct}% · ${typeLabel}${note}`;
}

function clearMarks(): number {
  const marks = document.querySelectorAll(`.${MARK_CLASS}`);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
  return marks.length;
}
