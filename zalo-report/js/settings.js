/**
 * Cài đặt của người dùng, lưu trong trình duyệt (localStorage).
 * Không lưu số liệu tài chính — chỉ lưu cấu hình.
 */

import { DEFAULT_TEMPLATE } from './template.js';

const KEY = 'zalo-report:settings:v1';

/** Link hướng dẫn mặc định: trang huong-dan.html đi kèm công cụ. */
export const PUBLIC_GUIDE_URL = 'https://nvkieu.github.io/test/zalo-report/huong-dan.html';

export function defaultGuideUrl(loc = globalThis.location) {
  try {
    const local = !loc || loc.protocol !== 'https:' || /^(localhost|127\.|\[::1\])/.test(loc.hostname);
    return local ? PUBLIC_GUIDE_URL : new URL('huong-dan.html', loc.href).href;
  } catch {
    return PUBLIC_GUIDE_URL;
  }
}

export function defaultSettings() {
  return {
    company: '',
    bossTitle: 'anh/chị',
    bossPhone: '',
    guideUrl: defaultGuideUrl(),
    template: DEFAULT_TEMPLATE,
    unit: 'trieu',
    customAliases: {}, // { tong_tien: ['Tiền và tương đương tiền'] }
  };
}

export function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/**
 * Chuẩn hoá SĐT Việt Nam cho link zalo.me: "+84 912 345 678" → "0912345678".
 * Trả về '' nếu không hợp lệ.
 */
export function normalizePhone(input) {
  let s = String(input || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  else if (s.startsWith('84') && s.length === 11) s = '0' + s.slice(2);
  return /^0\d{9}$/.test(s) ? s : '';
}
