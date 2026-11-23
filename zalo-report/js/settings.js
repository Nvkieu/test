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
    company: 'Công ty TNHH Vật liệu xây dựng',
    bossTitle: 'anh/chị',
    bossPhone: '',
    guideUrl: defaultGuideUrl(),
    template: DEFAULT_TEMPLATE,
    unit: 'trieu',
    customAliases: {}, // { tong_tien: ['Tiền và tương đương tiền'] }
    migrations: ['amis-mobile-link'], // template mặc định đã có sẵn các dòng mới
  };
}

export function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    // Cài đặt lưu từ bản cũ chưa có "migrations" → coi như chưa cập nhật gì.
    const saved = { ...base, ...parsed, migrations: parsed.migrations || [] };
    if (migrateSettings(saved)) saveSettings(saved);
    return saved;
  } catch {
    return base;
  }
}

/** Dòng link xem số liệu trên điện thoại (AMIS) thêm vào template từ bản 2026-11. */
export const AMIS_MOBILE_LINE = '📱 Xem số liệu trực tiếp trên điện thoại (AMIS): {{link_xem_mobile}}';

/**
 * Cập nhật template đã lưu từ bản cũ — mỗi thay đổi chỉ áp dụng một lần,
 * nên nếu sau đó bạn tự xoá dòng đi thì nó không bị thêm lại.
 * @returns {boolean} có thay đổi hay không
 */
export function migrateSettings(settings) {
  const done = new Set(settings.migrations || []);
  let changed = false;
  if (!done.has('amis-mobile-link')) {
    if (typeof settings.template === 'string' && !settings.template.includes('{{link_xem_mobile}}')) {
      settings.template = settings.template.replace(/\s+$/, '') + '\n' + AMIS_MOBILE_LINE;
    }
    done.add('amis-mobile-link');
    changed = true;
  }
  settings.migrations = [...done];
  return changed;
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

/* ---------- Số liệu lần trước ---------- */

const LAST_KEY = 'zalo-report:last:v1';

/** Lưu số liệu đang xem để lần sau mở trang là có sẵn. */
export function saveLastReport(report, sourceName) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ report, sourceName, savedAt: Date.now() }));
  } catch {
    /* hết chỗ hoặc bị chặn — bỏ qua */
  }
}

/** @returns {{report: object, sourceName: string, savedAt: number} | null} */
export function loadLastReport() {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data?.report?.values ? data : null;
  } catch {
    return null;
  }
}

export function clearLastReport() {
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* bỏ qua */
  }
}

/* ---------- Mang cài đặt sang máy khác qua link ---------- */

const SHARE_FIELDS = ['company', 'bossTitle', 'bossPhone', 'guideUrl', 'template', 'unit', 'customAliases'];

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Link mở công cụ kèm toàn bộ cài đặt (SĐT sếp, xưng hô, template…).
 * Cài đặt nằm sau dấu #, nên trình duyệt không gửi nó lên máy chủ.
 */
export function settingsLink(settings, baseHref) {
  const picked = {};
  for (const k of SHARE_FIELDS) picked[k] = settings[k];
  const url = new URL(baseHref);
  url.hash = 'cfg=' + toBase64Url(JSON.stringify(picked));
  return url.href;
}

/** Đọc cài đặt từ "#cfg=…" nếu có. */
export function settingsFromHash(hash) {
  const m = /(?:^#|&)cfg=([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const data = JSON.parse(fromBase64Url(m[1]));
    const out = {};
    for (const k of SHARE_FIELDS) if (k in data) out[k] = data[k];
    return out;
  } catch {
    return null;
  }
}
