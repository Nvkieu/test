#!/usr/bin/env node
/**
 * Kiểm tra dữ liệu và logic chấm điểm mà không cần trình duyệt.
 *   node scripts/check.mjs
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { scoreReading, tokenize, phoneticKey, wordSimilarity } from '../js/scoring.js';
import { pickDaily, rngFrom, resolveToday, formatDateVi } from '../js/daily.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
let checks = 0;

function ok(condition, label, extra = '') {
  checks++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${extra ? '\n      → ' + extra : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

function load(name) {
  return JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));
}

/* ---------- 1. Dữ liệu ---------- */

section('1. data/words.json');
const words = load('words.json');
ok(Array.isArray(words), 'là một mảng JSON hợp lệ');
ok(words.length >= 300, `có ít nhất 300 từ (hiện có ${words.length})`);
ok(new Set(words.map((w) => w.id)).size === words.length, 'không trùng id');
ok(new Set(words.map((w) => w.word)).size === words.length, 'không trùng từ');

const badWord = words.find((w) =>
  !w.id || !w.word || !w.ipa || !w.pos || !w.vi || !w.example || !w.exampleVi);
ok(!badWord, 'mọi từ có đủ 7 trường bắt buộc', badWord && JSON.stringify(badWord));

const badIpa = words.find((w) => !/^\/.+\/$/.test(w.ipa));
ok(!badIpa, 'IPA luôn nằm giữa hai dấu /', badIpa && `${badIpa.id}: ${badIpa.ipa}`);

const exampleMissingWord = words.filter((w) => {
  const head = w.word.toLowerCase().split(' ')[0].replace(/e$/, '');
  return !w.example.toLowerCase().includes(head.slice(0, Math.max(4, head.length - 2)));
});
ok(exampleMissingWord.length <= 15,
  `câu ví dụ chứa chính từ đó (${words.length - exampleMissingWord.length}/${words.length})`,
  exampleMissingWord.slice(0, 5).map((w) => w.id + ':' + w.word).join(', '));

section('2. data/sentences.json');
const sentences = load('sentences.json');
ok(sentences.length >= 150, `có ít nhất 150 câu (hiện có ${sentences.length})`);
ok(new Set(sentences.map((s) => s.id)).size === sentences.length, 'không trùng id');
ok(new Set(sentences.map((s) => s.text)).size === sentences.length, 'không trùng câu');

const badSentence = sentences.find((s) => !s.id || !s.text || !s.vi || !s.focus);
ok(!badSentence, 'mọi câu có đủ id / text / vi / focus', badSentence && JSON.stringify(badSentence));

const focusNotInText = sentences.filter(
  (s) => !tokenize(s.text).includes(tokenize(s.focus)[0]));
ok(focusNotInText.length === 0, 'từ "focus" luôn xuất hiện trong câu',
  focusNotInText.slice(0, 5).map((s) => `${s.id}: "${s.focus}" ∉ "${s.text}"`).join(' | '));

const tooLong = sentences.filter((s) => tokenize(s.text).length > 12);
ok(tooLong.length === 0, 'mọi câu không quá 12 từ (hợp trình độ A2)',
  tooLong.slice(0, 5).map((s) => s.id).join(', '));

section('3. data/dialogues.json');
const dialogues = load('dialogues.json');
ok(dialogues.length >= 30, `có ít nhất 30 bài nghe (hiện có ${dialogues.length})`);
ok(new Set(dialogues.map((d) => d.id)).size === dialogues.length, 'không trùng id');

const badDialogue = dialogues.find((d) =>
  !d.id || !d.title || !d.titleVi || !d.type || !Array.isArray(d.lines) || !Array.isArray(d.questions));
ok(!badDialogue, 'mọi bài có đủ trường bắt buộc', badDialogue && badDialogue.id);

const badType = dialogues.filter((d) => !['dialogue', 'passage'].includes(d.type));
ok(badType.length === 0, 'type chỉ là "dialogue" hoặc "passage"', badType.map((d) => d.id).join(', '));

const badSpeaker = dialogues.filter((d) => d.lines.some((l) => !['A', 'B', 'N'].includes(l.speaker)));
ok(badSpeaker.length === 0, 'speaker chỉ là A / B / N', badSpeaker.map((d) => d.id).join(', '));

const tooFewQuestions = dialogues.filter((d) => d.questions.length < 4);
ok(tooFewQuestions.length === 0, 'mỗi bài có ít nhất 4 câu hỏi',
  tooFewQuestions.map((d) => `${d.id}=${d.questions.length}`).join(', '));

const badAnswer = [];
for (const d of dialogues) {
  for (const [i, q] of d.questions.entries()) {
    if (!q.q || !Array.isArray(q.options) || q.options.length !== 4) badAnswer.push(`${d.id}#${i} options`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) badAnswer.push(`${d.id}#${i} answer=${q.answer}`);
    else if (!q.explainVi) badAnswer.push(`${d.id}#${i} explainVi`);
    else if (new Set(q.options).size !== 4) badAnswer.push(`${d.id}#${i} options trùng nhau`);
  }
}
ok(badAnswer.length === 0, 'mọi câu hỏi có 4 lựa chọn khác nhau, answer 0–3 và explainVi',
  badAnswer.slice(0, 6).join(' | '));

const shortPassage = dialogues.filter((d) => {
  const total = d.lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  return total < 60;
});
ok(shortPassage.length === 0, 'mỗi bài nghe dài ít nhất 60 từ',
  shortPassage.map((d) => d.id).join(', '));

/* ---------- 4. Chấm phát âm ---------- */

section('4. js/scoring.js — chấm phát âm');

{
  const r = scoreReading('She usually takes the bus to work.', 'she usually takes the bus to work');
  ok(r.score === 100, 'đọc đúng hoàn toàn → 100 điểm', `nhận được ${r.score}`);
  ok(r.refWords.every((w) => w.level === 'good'), 'mọi từ đều xanh lá');
  ok(r.weakWords.length === 0, 'không có từ yếu nào');
}

{
  // Đọc thiếu "usually" — alignment phải giữ các từ còn lại đúng chỗ.
  const r = scoreReading('She usually takes the bus to work.', 'she takes the bus to work');
  const missing = r.refWords.filter((w) => w.level === 'miss');
  ok(missing.length === 1 && missing[0].text === 'usually',
    'đọc thiếu 1 từ → đúng từ đó bị đánh dấu thiếu',
    r.refWords.map((w) => `${w.text}:${w.level}`).join(' '));
  ok(r.refWords.filter((w) => w.level === 'good').length === 6,
    'sáu từ còn lại vẫn xanh lá (alignment hoạt động)');
  ok(r.score > 70 && r.score < 100, `điểm nằm giữa 70 và 100 (nhận được ${r.score})`);
}

{
  // Đọc thừa từ ở giữa câu.
  const r = scoreReading('I like coffee', 'i really like coffee');
  ok(r.counts.extra === 1, 'phát hiện đúng 1 từ thừa', JSON.stringify(r.counts));
  ok(r.refWords.every((w) => w.level === 'good'), 'các từ gốc vẫn đúng dù có từ thừa');
  ok(r.score < 100, `bị trừ điểm nhẹ vì từ thừa (${r.score})`);
}

{
  const r = scoreReading('sheep', 'ship');
  ok(r.refWords[0].level === 'near', 'sheep vs ship → gần đúng (xanh dương)',
    `similarity=${r.refWords[0].similarity.toFixed(2)} level=${r.refWords[0].level}`);
}

{
  const r = scoreReading('cat', 'dog');
  ok(r.refWords[0].level === 'bad', 'cat vs dog → sai (đỏ)',
    `similarity=${r.refWords[0].similarity.toFixed(2)}`);
  ok(r.score === 0, 'đọc sai hoàn toàn → 0 điểm');
}

{
  const pairs = [['think', 'sink'], ['three', 'tree'], ['rice', 'lice'], ['work', 'walk']];
  const levels = pairs.map(([a, b]) => scoreReading(a, b).refWords[0].level);
  ok(levels.every((l) => l === 'near'),
    'các cặp người Việt hay nhầm đều ra "gần đúng"',
    pairs.map(([a, b], i) => `${a}/${b}=${levels[i]}`).join(' '));
}

{
  ok(scoreReading("I can't go", 'i cannot go').score === 100,
    "viết tắt can't = cannot được chuẩn hoá");
  ok(scoreReading('I have 3 books', 'i have three books').score === 100,
    'số 3 = "three" được chuẩn hoá');
  ok(scoreReading('Hello, world!', 'hello world').score === 100,
    'dấu câu và chữ hoa không ảnh hưởng');
}

{
  const r = scoreReading('The quick brown fox', '');
  ok(r.score === 0, 'không nói gì → 0 điểm');
  ok(r.refWords.every((w) => w.level === 'miss'), 'mọi từ bị đánh dấu thiếu');
}

{
  ok(phoneticKey('night') === phoneticKey('nite'), 'khoá ngữ âm: night = nite');
  ok(wordSimilarity('bank', 'bank') === 1, 'từ giống hệt → similarity 1');
}

/* ---------- 5. Chọn bài theo ngày ---------- */

section('5. js/daily.js — chọn bài theo ngày');

{
  const opts = { date: '2026-07-27', count: 10 };
  const a = pickDaily(words, opts).map((w) => w.id);
  const b = pickDaily(words, opts).map((w) => w.id);
  ok(JSON.stringify(a) === JSON.stringify(b), 'cùng một ngày → cùng một bộ từ');
  ok(a.length === 10, 'bốc đúng 10 từ');
  ok(new Set(a).size === 10, 'không lặp từ trong cùng một ngày');
}

{
  const d1 = pickDaily(words, { date: '2026-07-27', count: 10 }).map((w) => w.id);
  const d2 = pickDaily(words, { date: '2026-07-28', count: 10 }).map((w) => w.id);
  ok(JSON.stringify(d1) !== JSON.stringify(d2), 'ngày khác → bộ từ khác');
}

{
  // Mô phỏng 30 ngày liên tiếp, cập nhật lastUsed như app thật.
  const lastUsed = {};
  const seen = [];
  const date0 = new Date('2026-01-01T00:00:00');
  for (let i = 0; i < 30; i++) {
    const d = new Date(date0);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const picked = pickDaily(words, { date: key, count: 10, lastUsed });
    ok(picked.length === 10, `ngày ${i + 1}: bốc đủ 10 từ`);
    for (const w of picked) { lastUsed[w.id] = key; seen.push(w.id); }
  }
  ok(new Set(seen).size === 300, '30 ngày liên tiếp dùng hết 300 từ không lặp lại từ nào',
    `chỉ có ${new Set(seen).size} từ khác nhau`);
}

{
  const exclude = new Set(words.slice(0, 295).map((w) => w.id));
  const picked = pickDaily(words, { date: '2026-07-27', count: 10, exclude });
  ok(picked.length === 5, 'loại trừ từ đã nhớ → chỉ trả về số từ còn lại');
  ok(picked.every((w) => !exclude.has(w.id)), 'không bốc phải từ đã bị loại trừ');
}

{
  const a = pickDaily(sentences, { date: '2026-07-27', count: 10, salt: 0 }).map((s) => s.id);
  const b = pickDaily(sentences, { date: '2026-07-27', count: 10, salt: 1 }).map((s) => s.id);
  ok(JSON.stringify(a) !== JSON.stringify(b), 'đổi salt ("Đổi bài khác") → bộ câu khác');
}

{
  const r = rngFrom('seed')();
  ok(r >= 0 && r < 1, 'RNG trả về giá trị trong [0, 1)');
  ok(resolveToday('?date=2026-03-15') === '2026-03-15', 'tham số ?date= được nhận đúng');
  ok(/^Chủ nhật|^Thứ/.test(formatDateVi('2026-07-27')), 'định dạng ngày tiếng Việt hợp lệ');
}

/* ---------- 6. PWA ---------- */

section('6. PWA — manifest, icon, service worker');

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
ok(!!manifest.name && !!manifest.short_name, 'manifest có name và short_name');
ok(manifest.short_name.length <= 12,
  `short_name đủ ngắn để hiện dưới icon (${manifest.short_name.length} ký tự)`);
ok(manifest.display === 'standalone', 'display = standalone (mở như app, không có thanh địa chỉ)');
ok(manifest.start_url === './' && manifest.scope === './',
  'start_url và scope dùng đường dẫn tương đối (chạy được dưới /test/ của Pages)');
ok(!!manifest.theme_color && !!manifest.background_color, 'có theme_color và background_color');

const iconSrcs = manifest.icons.map((i) => i.src);
ok(manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png'), 'có icon PNG 192×192');
ok(manifest.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png'), 'có icon PNG 512×512');
ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'có icon maskable cho Android');

const missingIcons = iconSrcs.filter((src) => !existsSync(join(ROOT, src)));
ok(missingIcons.length === 0, 'mọi icon khai báo trong manifest đều tồn tại', missingIcons.join(', '));

const emptyIcons = iconSrcs.filter((src) => existsSync(join(ROOT, src)) && statSync(join(ROOT, src)).size < 500);
ok(emptyIcons.length === 0, 'không có file icon rỗng/hỏng', emptyIcons.join(', '));

ok(existsSync(join(ROOT, 'icons', 'apple-touch-icon.png')), 'có apple-touch-icon.png cho iOS');

const shortcutUrls = (manifest.shortcuts || []).map((s) => s.url);
ok(shortcutUrls.every((u) => /^\.\/\?view=(ex1|ex2|ex3|summary)$/.test(u)),
  'shortcut trỏ tới các view hợp lệ', shortcutUrls.join(', '));

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
ok(html.includes('rel="manifest"'), 'index.html có khai báo manifest');
ok(html.includes('apple-touch-icon'), 'index.html có apple-touch-icon');
ok(html.includes('apple-mobile-web-app-capable'), 'index.html có meta cho iOS standalone');

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const precached = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1])
  .filter((p) => p !== './' && !p.includes('index.html') || p === './index.html');

const missingPrecache = [...new Set(precached)]
  .filter((p) => p !== './')
  .filter((p) => !existsSync(join(ROOT, p)));
ok(missingPrecache.length === 0,
  'mọi file trong danh sách precache của service worker đều tồn tại',
  missingPrecache.join(', '));

// Mọi file JS mà app thực sự nạp đều phải nằm trong precache, nếu không sẽ
// trắng trang khi offline.
const jsFiles = ['app', 'storage', 'daily', 'speech', 'scoring', 'feedback', 'ai', 'ui', 'pwa',
  'ex1-vocab', 'ex2-listening', 'ex3-pronounce'].map((n) => `./js/${n}.js`);
const notPrecached = jsFiles.filter((f) => !sw.includes(f));
ok(notPrecached.length === 0, 'mọi module JS đều được precache', notPrecached.join(', '));

const dataFiles = ['./data/words.json', './data/dialogues.json', './data/sentences.json'];
ok(dataFiles.every((f) => sw.includes(f)), 'cả 3 file dữ liệu đều được precache');

ok(/url\.origin !== self\.location\.origin/.test(sw),
  'service worker bỏ qua request khác origin (không cache API key / phản hồi API)');
ok(/CACHE_VERSION\s*=\s*'v\d+'/.test(sw), 'service worker có đánh số phiên bản cache');

/* ---------- 7. Chạy trên Windows ---------- */

section('7. Windows — run-windows.bat + scripts/serve.ps1');

const batRaw = readFileSync(join(ROOT, 'run-windows.bat'));
const psRaw = readFileSync(join(ROOT, 'scripts', 'serve.ps1'));
const bat = batRaw.toString('utf8');
const ps = psRaw.toString('utf8');

ok(batRaw.includes(Buffer.from('\r\n')), 'run-windows.bat dùng xuống dòng CRLF (cmd.exe cần)');
ok(psRaw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
  'serve.ps1 có BOM UTF-8 (PowerShell 5.1 mới đọc đúng tiếng Việt)');
ok(bat.includes('scripts\\serve.ps1'), 'bat gọi đúng đường dẫn serve.ps1');
ok(bat.includes('ExecutionPolicy Bypass'),
  'bat bỏ qua ExecutionPolicy (mặc định Windows chặn chạy .ps1)');
ok(bat.includes('cd /d "%~dp0"'), 'bat chuyển về thư mục dự án trước khi chạy');

ok(/Prefixes\.Add\("http:\/\/localhost:/.test(ps),
  'serve.ps1 chỉ lắng nghe localhost (không mở ra mạng LAN, không bị Firewall hỏi)');
ok(!/http:\/\/\+:|0\.0\.0\.0/.test(ps), 'serve.ps1 không bind ra mọi địa chỉ');
ok(ps.includes('StartsWith($rootPrefix'),
  'serve.ps1 chặn truy cập ra ngoài thư mục dự án');

const braces = (s, c) => (s.match(new RegExp('\\' + c, 'g')) || []).length;
ok(braces(ps, '{') === braces(ps, '}'), 'serve.ps1 cân bằng dấu ngoặc nhọn',
  `${braces(ps, '{')} mở / ${braces(ps, '}')} đóng`);
ok(braces(ps, '(') === braces(ps, ')'), 'serve.ps1 cân bằng dấu ngoặc tròn');

// Thiếu MIME type nào là trình duyệt từ chối nạp file đó — nhất là .js
// (ES module bị chặn nếu sai MIME) và .webmanifest. Chỉ xét đúng những file
// trình duyệt thật sự tải, tức là danh sách precache của service worker;
// run-windows.bat hay serve.ps1 không bao giờ được yêu cầu qua HTTP.
const webExts = new Set(
  [...new Set(precached)]
    .filter((p) => p !== './' && p.includes('.'))
    .map((p) => p.slice(p.lastIndexOf('.')).toLowerCase()),
);

const uncovered = [...webExts].filter((ext) => !ps.includes(`'${ext}'`));
ok(uncovered.length === 0,
  `bảng MIME của serve.ps1 phủ hết ${webExts.size} loại file mà app tải`,
  'thiếu: ' + uncovered.join(', '));

ok(ps.includes("'.js'") && /\.js'\s*=\s*'text\/javascript/.test(ps),
  '.js được trả đúng MIME text/javascript (ES module sẽ bị chặn nếu sai)');
ok(/\.webmanifest'\s*=\s*'application\/manifest\+json/.test(ps),
  '.webmanifest được trả đúng MIME');

/* ---------- 8. Công cụ gửi báo cáo Zalo ---------- */

section('8. zalo-report — đọc số, nhận diện Excel, template tin nhắn');
{
  const { parseVN, formatVN, fillDerived, emptyReport, templateVars } = await import('../zalo-report/js/metrics.js');
  const { extractReport, parsePeriod, parseMonthCell } = await import('../zalo-report/js/excel-import.js');
  const { renderTemplate, DEFAULT_TEMPLATE, VARIABLE_HELP } = await import('../zalo-report/js/template.js');
  const { normalizePhone } = await import('../zalo-report/js/settings.js');
  const { SAMPLE_SHEETS } = await import('../zalo-report/js/sample-data.js');

  const cases = [
    ['1.603', 1603], ['(28.311)', -28311], ['-29.914', -29914], ['1.659.498.280,000', 1659498280],
    ['217,34', 217.34], ['12.5', 12.5], ['1,234,567', 1234567], [131581, 131581], ['abc', null], ['', null],
  ];
  const badParse = cases.filter(([s, want]) => parseVN(s) !== want);
  ok(badParse.length === 0, 'parseVN đọc đúng số kiểu VN', badParse.map(([s]) => `${s} → ${parseVN(s)}`).join(', '));

  ok(formatVN(-28311) === '(28.311)' && formatVN(1603) === '1.603' && formatVN(217.34, 2) === '217,34' && formatVN(null) === '—',
    'formatVN định dạng như dashboard');

  ok(parsePeriod('Tháng 11/2026')?.month === 11 && parsePeriod('11-2026')?.year === 2026 && parsePeriod('xyz') === null,
    'đọc kỳ báo cáo "Tháng 11/2026"');
  ok(parseMonthCell('Th 10') === 10 && parseMonthCell('Tháng 01') === 1 && parseMonthCell(12) === 12 && parseMonthCell('Tổng') === null,
    'đọc ô tháng "Th 10" / "Tháng 01" / 12');

  const { report, found } = extractReport(SAMPLE_SHEETS);
  const v = report.values;
  ok(found.length === 18, `nhận diện đủ 18 chỉ số từ file mẫu (được ${found.length})`);
  ok(v.tong_tien === -28311 && v.doanh_thu === 14814 && v.loi_nhuan === 8544 && v.ton_kho === 131581,
    'số trên file mẫu khớp dashboard');
  ok(v.npt_qua_han === 2875 && v.nptr_trong_han === 542, '"Quá hạn"/"Trong hạn" hiểu theo mục công nợ phía trên');
  ok(report.monthly.length === 12 && report.inventory.length === 5, 'đọc được bảng 12 tháng và 5 mặt hàng tồn kho');
  ok(report.company.includes('Vật liệu') && report.period?.month === 11, 'đọc được tên công ty và kỳ báo cáo');

  const inDong = extractReport([{ name: 'x', rows: [['Tiền mặt', 1603000000], ['Tiền gửi', 500000000]] }], { unit: 'dong' });
  ok(inDong.report.values.tien_mat === 1603 && inDong.report.values.tong_tien === 2103 && inDong.derived.includes('tong_tien'),
    'đổi đơn vị đồng → triệu và tự tính tổng tiền');

  const custom = extractReport([{ name: 'x', rows: [['Tiền và tương đương tiền', 999]] }],
    { customAliases: { tong_tien: ['Tiền và tương đương tiền'] } });
  ok(custom.report.values.tong_tien === 999, 'nhãn tự khai báo (ánh xạ nhãn) được dùng');

  const r2 = emptyReport();
  r2.monthly = [{ month: 1, dt: 10, cp: 4, ln: 6 }, { month: 2, dt: 20, cp: 5, ln: 15 }];
  r2.period = { month: 2, year: 2026 };
  fillDerived(r2);
  ok(r2.values.dt_nam === 30 && r2.values.doanh_thu === 20, 'luỹ kế năm và số tháng lấy từ bảng theo tháng');

  const vars = templateVars(report, { guideUrl: 'https://example.com/hd', bossTitle: 'anh Hùng' });
  const known = new Set(Object.keys(vars));
  const missingHelp = VARIABLE_HELP.filter(([k]) => !known.has(k)).map(([k]) => k);
  ok(missingHelp.length === 0, 'mọi biến trong danh sách gợi ý đều có giá trị', missingHelp.join(', '));

  const msg = renderTemplate(DEFAULT_TEMPLATE, vars);
  ok(msg.unknown.length === 0 && msg.empty.length === 0 && !msg.text.includes('{{'), 'template mặc định điền hết biến');
  ok(msg.text.includes('anh Hùng') && msg.text.includes('14.814') && msg.text.includes('https://example.com/hd'),
    'tin nhắn có xưng hô, số liệu và link hướng dẫn');
  ok(vars.link_xem_mobile === 'https://example.com/hd#amis-mobile' && msg.text.includes('#amis-mobile'),
    'tin nhắn có link hướng dẫn xem số liệu trên điện thoại');
  ok(msg.text.includes('27,6%'), 'nhận xét tự động cảnh báo nợ quá hạn 27,6%');
  ok(renderTemplate('{{khong_co}}', vars).unknown[0] === 'khong_co', 'báo biến không tồn tại');

  ok(normalizePhone('+84 912 345 678') === '0912345678' && normalizePhone('0912.345.678') === '0912345678' && normalizePhone('123') === '',
    'chuẩn hoá SĐT cho link zalo.me');

  const { settingsLink, settingsFromHash, defaultSettings } = await import('../zalo-report/js/settings.js');
  const cfg = { ...defaultSettings(), bossPhone: '0912345678', bossTitle: 'anh Hùng', template: 'Dạ em gửi {{xung_ho}} ✅' };
  const link = settingsLink(cfg, 'https://nvkieu.github.io/test/zalo-report/');
  const back = settingsFromHash(new URL(link).hash);
  ok(back?.bossPhone === '0912345678' && back.bossTitle === 'anh Hùng' && back.template === cfg.template,
    'link cài đặt mang đủ SĐT, xưng hô, template (cả tiếng Việt và emoji)');
  ok(settingsFromHash('#khac') === null && settingsFromHash('#cfg=!!!') === null, 'bỏ qua hash không phải cài đặt');

  ok(sw.includes('/zalo-report/'), 'service worker của app tiếng Anh bỏ qua /zalo-report/');
}

/* ---------- Tổng kết ---------- */

console.log(`\n${'─'.repeat(52)}`);
if (failures === 0) {
  console.log(`✅ Tất cả ${checks} kiểm tra đều đạt.`);
} else {
  console.log(`❌ ${failures}/${checks} kiểm tra thất bại.`);
  process.exit(1);
}
