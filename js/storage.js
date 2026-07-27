/**
 * Lưu tiến độ học vào localStorage.
 * Toàn bộ dữ liệu nằm trong một key duy nhất để export/import cho dễ.
 */

const KEY = 'dela.progress.v1';

const EMPTY = {
  version: 1,
  knownWords: [],       // ["w001", ...] — không hiển thị lại ở Bài 1
  seenWords: {},        // { "w001": "2026-07-27" } — ngày gặp gần nhất
  usedDialogues: {},    // { "d01": "2026-07-27" }
  usedSentences: {},    // { "s001": "2026-07-27" }
  days: {},             // { "2026-07-27": { ex1: {...}, ex2: {...}, ex3: {...} } }
  settings: {
    theme: 'light',
    voiceURI: '',
    rate: 0.9,
    apiKey: '',
  },
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(EMPTY);
    const parsed = JSON.parse(raw);
    // Merge nông với EMPTY để không vỡ khi thêm field mới ở phiên bản sau.
    return {
      ...clone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return clone(EMPTY);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Không lưu được tiến độ:', e);
  }
}

/* ---------- Đọc ---------- */

export function getState() { return state; }
export function getSettings() { return state.settings; }
export function getKnownWords() { return state.knownWords; }
export function isKnown(wordId) { return state.knownWords.includes(wordId); }

export function getDay(date) { return state.days[date] || null; }

/** Kết quả một bài của ngày `date`, hoặc null. */
export function getResult(date, ex) {
  const d = state.days[date];
  return (d && d[ex]) || null;
}

/* ---------- Ghi ---------- */

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

export function markKnown(wordId, known) {
  const i = state.knownWords.indexOf(wordId);
  if (known && i === -1) state.knownWords.push(wordId);
  if (!known && i !== -1) state.knownWords.splice(i, 1);
  save();
}

export function clearKnown() {
  state.knownWords = [];
  save();
}

/** Ghi nhận các item đã dùng trong ngày để hôm sau không bốc lại. */
export function markUsed(kind, ids, date) {
  const bucket = { words: 'seenWords', dialogues: 'usedDialogues', sentences: 'usedSentences' }[kind];
  if (!bucket) return;
  for (const id of ids) state[bucket][id] = date;
  save();
}

/** Lưu kết quả một bài: { score: 0-100, detail: {...}, feedback: "..." } */
export function saveResult(date, ex, result) {
  if (!state.days[date]) state.days[date] = {};
  state.days[date][ex] = { ...result, at: new Date().toISOString() };
  save();
}

/** Xoá kết quả một bài (khi bấm "Đổi bài khác" / làm lại). */
export function clearResult(date, ex) {
  if (state.days[date]) {
    delete state.days[date][ex];
    save();
  }
}

/* ---------- Thống kê ---------- */

/** Số ngày học liên tiếp tính tới `today` (ngày có ít nhất 1 bài hoàn thành). */
export function getStreak(today) {
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  for (;;) {
    const key = toDateKey(d);
    const day = state.days[key];
    const done = day && (day.ex1 || day.ex2 || day.ex3);
    if (!done) {
      // Hôm nay chưa học thì chưa phá streak — chỉ bỏ qua và xét hôm qua.
      if (streak === 0 && key === today) { d.setDate(d.getDate() - 1); continue; }
      break;
    }
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Điểm trung bình mỗi ngày trong N ngày gần nhất (kể cả hôm nay). */
export function getRecentDays(today, n = 7) {
  const out = [];
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = toDateKey(d);
    const day = state.days[key];
    const scores = day
      ? ['ex1', 'ex2', 'ex3'].map((e) => day[e]?.score).filter((s) => typeof s === 'number')
      : [];
    out.push({
      date: key,
      score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      count: scores.length,
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Trung bình các ngày ĐÃ học trong 7 ngày trước `today` (không tính today). */
export function getPriorAverage(today) {
  const days = getRecentDays(today, 8).slice(0, 7).filter((d) => d.score !== null);
  if (!days.length) return null;
  return Math.round(days.reduce((a, b) => a + b.score, 0) / days.length);
}

/* ---------- Export / Import / Reset ---------- */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !('knownWords' in parsed)) {
    throw new Error('File không đúng định dạng tiến độ.');
  }
  state = { ...clone(EMPTY), ...parsed, settings: { ...EMPTY.settings, ...(parsed.settings || {}) } };
  save();
}

export function resetAll() {
  state = clone(EMPTY);
  save();
}

/* ---------- Tiện ích ngày ---------- */

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
