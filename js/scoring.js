/**
 * Chấm phát âm: so câu bạn đọc (transcript từ STT) với câu gốc.
 *
 * Không so khớp theo vị trí thô — dùng căn chỉnh Needleman–Wunsch để xử lý
 * đúng khi bạn đọc thiếu / thừa / đảo từ.
 *
 * Ba mức: 'good' (xanh lá) · 'near' (xanh dương) · 'bad' (đỏ).
 * Module thuần, không đụng DOM → test được bằng Node.
 */

/* ---------- Chuẩn hoá ---------- */

const NUMBER_WORDS = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen',
  16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty',
  30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy',
  80: 'eighty', 90: 'ninety', 100: 'hundred', 1000: 'thousand',
};

/** Các dạng viết tắt mà STT hay trả về khác với câu gốc. */
const CONTRACTIONS = [
  [/\bcan['’]t\b/g, 'cannot'],
  [/\bwon['’]t\b/g, 'will not'],
  [/\bn['’]t\b/g, ' not'],
  [/\b(i)['’]m\b/g, '$1 am'],
  [/\b(\w+)['’]re\b/g, '$1 are'],
  [/\b(\w+)['’]ve\b/g, '$1 have'],
  [/\b(\w+)['’]ll\b/g, '$1 will'],
  [/\b(i|he|she|it|that|there|what|who|where)['’]s\b/g, '$1 is'],
  [/\b(\w+)['’]d\b/g, '$1 would'],
];

/** Chuẩn hoá một câu thành mảng token so sánh được. */
export function tokenize(text) {
  let s = String(text || '').toLowerCase();
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s
    .replace(/[’']/g, '')                 // possessive: "john's" → "johns"
    .replace(/[^a-z0-9\s-]/g, ' ')        // bỏ dấu câu
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return [];
  return s.split(' ').map(numToWord).filter(Boolean);
}

function numToWord(tok) {
  if (!/^\d+$/.test(tok)) return tok;
  const n = Number(tok);
  if (NUMBER_WORDS[n]) return NUMBER_WORDS[n];
  if (n > 20 && n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const ones = n % 10;
    return ones ? `${NUMBER_WORDS[tens]} ${NUMBER_WORDS[ones]}` : NUMBER_WORDS[tens];
  }
  return tok;
}

/* ---------- Khoá ngữ âm ---------- */

/**
 * Rút gọn một từ về "khoá ngữ âm": gộp các âm mà người Việt hay nhầm
 * (s/z, f/v, th/s, nguyên âm dài/ngắn…) để `sheep` vs `ship` ra "gần đúng"
 * chứ không phải "sai hoàn toàn".
 */
export function phoneticKey(word) {
  let w = String(word || '').toLowerCase();
  if (!w) return '';

  w = w
    .replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^ps/, 's').replace(/^gn/, 'n')
    .replace(/^x/, 'z')
    .replace(/ough/g, 'o').replace(/augh/g, 'a')
    .replace(/(.)gh/g, '$1')                                        // gh câm: night, high
    .replace(/^(.{3,})e$/, '$1')                                    // e câm cuối từ: nite, make
    .replace(/tch/g, 'C').replace(/ch/g, 'C').replace(/sh/g, 'C')  // ch/sh/tch → C
    .replace(/ph/g, 'F')                                            // ph → F
    .replace(/th/g, 'T')                                            // th → T (giữ riêng)
    .replace(/ck|q|k/g, 'K').replace(/c(?=[eiy])/g, 'S').replace(/c/g, 'K')
    .replace(/[sz]/g, 'S').replace(/[fv]/g, 'F').replace(/[jg]/g, 'J')
    .replace(/wh/g, 'W').replace(/[bp]/g, 'P').replace(/[dt]/g, 'D')
    .replace(/[mn]/g, 'N').replace(/[lr]/g, 'L')
    .replace(/T/g, 'S')                                             // th ≈ s (lỗi phổ biến)
    .replace(/h/g, '')
    .replace(/[aeiouy]+/g, 'A')                                     // mọi nguyên âm → A
    .replace(/(.)\1+/g, '$1');                                      // bỏ ký tự lặp

  return w;
}

/* ---------- Đo tương đồng ---------- */

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

function ratio(a, b) {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/**
 * Độ giống của hai từ, 0–1. Lấy giá trị cao nhất giữa so sánh chữ cái
 * và so sánh khoá ngữ âm — nên "night"/"nite" và "sheep"/"ship" đều điểm cao.
 */
export function wordSimilarity(a, b) {
  if (a === b) return 1;
  const spelling = ratio(a, b);
  const phonetic = ratio(phoneticKey(a), phoneticKey(b));
  return Math.max(spelling, phonetic * 0.95); // ngữ âm khớp ≠ đúng hoàn toàn
}

export const NEAR_THRESHOLD = 0.6;

export function levelFor(similarity) {
  if (similarity >= 0.995) return 'good';
  if (similarity >= NEAR_THRESHOLD) return 'near';
  return 'bad';
}

/* ---------- Căn chỉnh Needleman–Wunsch ---------- */

const GAP = -1;

/**
 * Căn chỉnh hai mảng token. Trả về danh sách cặp:
 *   { ref, hyp, refIndex, hypIndex, similarity, level }
 * `ref`/`hyp` = null khi bên đó thiếu (thiếu từ / thừa từ).
 */
export function align(refTokens, hypTokens) {
  const n = refTokens.length;
  const m = hypTokens.length;

  // score[i][j] = điểm căn chỉnh tốt nhất của ref[0..i) với hyp[0..j)
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) score[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) score[0][j] = j * GAP;

  const sim = Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => wordSimilarity(refTokens[i], hypTokens[j])));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // Ghép: thưởng theo độ giống (khớp hẳn +1, lệch hẳn -1).
      const match = score[i - 1][j - 1] + (sim[i - 1][j - 1] * 2 - 1);
      score[i][j] = Math.max(match, score[i - 1][j] + GAP, score[i][j - 1] + GAP);
    }
  }

  // Truy vết ngược
  const pairs = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 &&
        score[i][j] === score[i - 1][j - 1] + (sim[i - 1][j - 1] * 2 - 1)) {
      const s = sim[i - 1][j - 1];
      pairs.push({
        ref: refTokens[i - 1], hyp: hypTokens[j - 1],
        refIndex: i - 1, hypIndex: j - 1,
        similarity: s, level: levelFor(s),
      });
      i--; j--;
    } else if (i > 0 && score[i][j] === score[i - 1][j] + GAP) {
      pairs.push({
        ref: refTokens[i - 1], hyp: null,
        refIndex: i - 1, hypIndex: -1,
        similarity: 0, level: 'miss',
      });
      i--;
    } else {
      pairs.push({
        ref: null, hyp: hypTokens[j - 1],
        refIndex: -1, hypIndex: j - 1,
        similarity: 0, level: 'extra',
      });
      j--;
    }
  }
  return pairs.reverse();
}

/* ---------- API chính ---------- */

/**
 * Chấm một câu.
 *
 * @returns {{
 *   score: number,                  // 0–100
 *   refWords: Array<{text,level,similarity,heard}>,   // câu gốc, tô màu
 *   hypWords: Array<{text,level,similarity}>,         // câu bạn đọc, tô màu
 *   counts: {good:number, near:number, bad:number, missing:number, extra:number},
 *   weakWords: string[],            // từ trong câu gốc bị sai/thiếu
 *   transcript: string,
 * }}
 */
export function scoreReading(reference, spoken) {
  const refTokens = tokenize(reference);
  const hypTokens = tokenize(spoken);

  const refWords = refTokens.map((t) => ({ text: t, level: 'miss', similarity: 0, heard: null }));
  const hypWords = hypTokens.map((t) => ({ text: t, level: 'extra', similarity: 0 }));

  if (!refTokens.length) {
    return {
      score: 0, refWords, hypWords,
      counts: { good: 0, near: 0, bad: 0, missing: 0, extra: hypTokens.length },
      weakWords: [], transcript: String(spoken || ''),
    };
  }

  for (const p of align(refTokens, hypTokens)) {
    if (p.refIndex >= 0 && p.hypIndex >= 0) {
      refWords[p.refIndex] = { text: p.ref, level: p.level, similarity: p.similarity, heard: p.hyp };
      hypWords[p.hypIndex] = { text: p.hyp, level: p.level, similarity: p.similarity };
    }
    // level 'miss' / 'extra' giữ nguyên giá trị khởi tạo ở trên.
  }

  const counts = { good: 0, near: 0, bad: 0, missing: 0, extra: 0 };
  for (const w of refWords) {
    if (w.level === 'good') counts.good++;
    else if (w.level === 'near') counts.near++;
    else if (w.level === 'miss') counts.missing++;
    else counts.bad++;
  }
  counts.extra = hypWords.filter((w) => w.level === 'extra').length;

  // Đúng = 1 điểm, gần đúng = 0.5. Thừa từ bị phạt nhẹ nhưng không dưới 0.
  const earned = counts.good + counts.near * 0.5;
  const penalty = Math.min(counts.extra * 0.25, refTokens.length * 0.2);
  const score = Math.max(0, Math.round(((earned - penalty) / refTokens.length) * 100));

  const weakWords = refWords
    .filter((w) => w.level === 'bad' || w.level === 'miss')
    .map((w) => w.text);

  return { score, refWords, hypWords, counts, weakWords, transcript: String(spoken || '') };
}

/** Chấm một từ đơn (Bài 1). */
export function scoreWord(reference, spoken) {
  const r = scoreReading(reference, spoken);
  return { ...r, level: r.refWords[0]?.level || 'bad' };
}
