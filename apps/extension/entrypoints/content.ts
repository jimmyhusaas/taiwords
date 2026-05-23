/**
 * Content script — Phase 2 minimum viable:
 * 在每個網頁右下角注入一個浮動按鈕，點擊後抓取頁面文字 (前 8000 字)
 * 送往本地 TaiWords API，把結果用 alert 顯示。
 *
 * 後續會升級為：inline 標記（底線 + tooltip）、popup 顯示細節、白名單網域。
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

const API_BASE = 'http://localhost:8080/api/v1';
const MAX_CHARS = 8000;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const btn = document.createElement('button');
    btn.textContent = '台詞 ⚑';
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

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '掃描中…';
      try {
        const text = (document.body.innerText ?? '').slice(0, MAX_CHARS);
        const res = await fetch(`${API_BASE}/detect`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: DetectResponse = await res.json();
        showSummary(data);
      } catch (e) {
        alert(
          'TaiWords 連線失敗。\n請確認本地 API 在 http://localhost:8080 運行：\n  docker compose up -d',
        );
        console.error('[TaiWords]', e);
      } finally {
        btn.disabled = false;
        btn.textContent = '台詞 ⚑';
      }
    });

    document.body.appendChild(btn);
  },
});

function showSummary(data: DetectResponse) {
  if (data.matches.length === 0) {
    alert(`TaiWords：本頁沒偵測到疑似支語。\n(掃描 ${data.stats.charCount} 字)`);
    return;
  }
  const top = data.matches.slice(0, 12);
  const lines = top.map(
    (m) =>
      `• ${m.matchedText} → ${m.suggestedZhTw}  (${Math.round(m.confidence * 100)}%)`,
  );
  const more = data.matches.length > top.length ? `\n…還有 ${data.matches.length - top.length} 筆` : '';
  alert(
    `TaiWords：偵測到 ${data.matches.length} 筆 (${data.stats.charCount} 字)\n\n${lines.join('\n')}${more}`,
  );
}
