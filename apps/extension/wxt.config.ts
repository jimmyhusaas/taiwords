import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'TaiWords — 台詞',
    description: '辨識網頁中的疑似支語並建議台灣慣用詞。',
    version: '0.0.1',
    permissions: ['storage', 'activeTab'],
    // host_permissions 允許 content script 對任意網頁注入 + fetch 本地 API。
    // Phase 2 後段會收緊：本地預設、可選自架 API URL。
    host_permissions: [
      'http://localhost:8080/*',
      'http://*/*',
      'https://*/*',
    ],
  },
});
