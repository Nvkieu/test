/**
 * Chọn nội dung bài học theo ngày, tất định (cùng ngày → cùng bài).
 * Dùng xmur3 (hash chuỗi) + mulberry32 (PRNG 32-bit) — nhẹ, không phụ thuộc thư viện.
 */

export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG tất định từ một chuỗi seed. */
export function rngFrom(seed) {
  return mulberry32(xmur3(seed)());
}

/** Fisher–Yates dùng RNG cho trước (không đụng vào mảng gốc). */
export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Số ngày giữa hai chuỗi YYYY-MM-DD (a - b). */
function daysBetween(a, b) {
  const ms = new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00');
  return Math.round(ms / 86400000);
}

/**
 * Bốc `count` phần tử cho ngày `date`.
 *
 * - `exclude`: Set các id loại hẳn (ví dụ từ đã nhớ).
 * - `lastUsed`: { id: "YYYY-MM-DD" } — ưu tiên item lâu chưa gặp nhất.
 * - `salt`: đổi giá trị này để bốc lại bộ khác trong cùng ngày ("Đổi bài khác").
 *
 * Cách chọn: chia thành các "lớp tươi" theo số ngày kể từ lần gặp cuối
 * (chưa gặp bao giờ = tươi nhất), xáo trộn trong từng lớp bằng RNG của ngày,
 * rồi lấy lần lượt. Nhờ vậy khi ngân hàng đã dùng hết vẫn quay vòng đều đặn
 * thay vì lặp lại đúng những item vừa học.
 */
export function pickDaily(items, { date, count, exclude = new Set(), lastUsed = {}, salt = 0, minGapDays = 7 }) {
  const rand = rngFrom(`${date}|${salt}|${count}`);

  const pool = items.filter((it) => !exclude.has(it.id));
  if (!pool.length) return [];

  const scored = pool.map((it) => {
    const seen = lastUsed[it.id];
    const age = seen ? daysBetween(date, seen) : Infinity;
    return { it, age };
  });

  // Lớp 0 = chưa gặp bao giờ, lớp 1 = đã qua minGapDays, lớp 2 = mới gặp gần đây.
  const tier = (age) => (age === Infinity ? 0 : age >= minGapDays ? 1 : 2);
  const tiers = [[], [], []];
  for (const s of scored) tiers[tier(s.age)].push(s);

  const out = [];
  for (const t of tiers) {
    if (out.length >= count) break;
    // Trong cùng lớp: item cũ hơn được ưu tiên, phần còn lại xáo ngẫu nhiên.
    const ordered = shuffle(t, rand).sort((a, b) => b.age - a.age);
    for (const s of ordered) {
      if (out.length >= count) break;
      out.push(s.it);
    }
  }
  return out;
}

/** Chọn đúng 1 item (dùng cho Bài 2). */
export function pickOne(items, opts) {
  return pickDaily(items, { ...opts, count: 1 })[0] || null;
}

/** Ngày hôm nay (hoặc ?date=YYYY-MM-DD để test). */
export function resolveToday(search = (typeof location !== 'undefined' ? location.search : '')) {
  const m = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(search || '');
  if (m) return m[1];
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** "Thứ hai, 27/07/2026" */
export function formatDateVi(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${WEEKDAYS[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`;
}
