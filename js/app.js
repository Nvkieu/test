/**
 * Điều phối app: tải dữ liệu, chọn bài của ngày, chuyển tab, cài đặt, tổng kết.
 */

import * as store from './storage.js';
import { pickDaily, pickOne, resolveToday, formatDateVi } from './daily.js';
import { el, clear, toast } from './ui.js';
import { loadVoices, getEnglishVoices, speak, stopSpeaking, stopListening } from './speech.js';
import { renderVocab } from './ex1-vocab.js';
import { renderListening } from './ex2-listening.js';
import { renderPronounce } from './ex3-pronounce.js';
import { hasApiKey, generateWords, generateDialogue, generateSentences } from './ai.js';

const TODAY = resolveToday();

const bank = { words: [], dialogues: [], sentences: [] };
const daily = { words: [], dialogue: null, sentences: [], salt: { ex1: 0, ex2: 0, ex3: 0 } };
const aiOverride = { words: null, dialogue: null, sentences: null };

let currentView = 'ex1';

/* ---------- Khởi động ---------- */

init().catch((e) => {
  console.error(e);
  document.getElementById('view-loading').innerHTML =
    `<div class="card center"><p>❌ Không tải được dữ liệu bài học.</p>
     <p class="muted small">${escapeHtml(e.message)}</p>
     <p class="muted small">Nếu bạn mở file trực tiếp bằng file://, hãy chạy qua web server
     (ví dụ <code>python3 -m http.server</code>) vì trình duyệt chặn fetch trên file://.</p></div>`;
});

async function init() {
  applyTheme(store.getSettings().theme);
  document.getElementById('today-label').textContent = formatDateVi(TODAY);

  const [words, dialogues, sentences] = await Promise.all([
    fetchJSON('./data/words.json'),
    fetchJSON('./data/dialogues.json'),
    fetchJSON('./data/sentences.json'),
  ]);
  bank.words = words;
  bank.dialogues = dialogues;
  bank.sentences = sentences;

  pickAll();
  wireTabs();
  wireSettings();
  refreshHeader();

  document.getElementById('view-loading').hidden = true;
  show('ex1');

  loadVoices().then(fillVoiceSelect);
}

async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Không đọc được ${path} (HTTP ${res.status})`);
  return res.json();
}

/* ---------- Chọn bài của ngày ---------- */

function pickAll() {
  const st = store.getState();

  daily.words = pickDaily(bank.words, {
    date: TODAY,
    count: 10,
    exclude: new Set(st.knownWords),
    lastUsed: st.seenWords,
    salt: daily.salt.ex1,
  });

  daily.dialogue = pickOne(bank.dialogues, {
    date: TODAY,
    lastUsed: st.usedDialogues,
    salt: daily.salt.ex2,
    minGapDays: 14,
  });

  daily.sentences = pickDaily(bank.sentences, {
    date: TODAY,
    count: 10,
    lastUsed: st.usedSentences,
    salt: daily.salt.ex3,
    minGapDays: 10,
  });

  store.markUsed('words', daily.words.map((w) => w.id), TODAY);
  if (daily.dialogue) store.markUsed('dialogues', [daily.dialogue.id], TODAY);
  store.markUsed('sentences', daily.sentences.map((s) => s.id), TODAY);
}

/* ---------- Điều hướng ---------- */

function wireTabs() {
  document.getElementById('tabs').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (tab) show(tab.dataset.view);
  });
}

function show(view) {
  stopSpeaking();
  stopListening();
  currentView = view;

  for (const t of document.querySelectorAll('.tab')) {
    t.classList.toggle('active', t.dataset.view === view);
  }
  for (const v of document.querySelectorAll('.view')) {
    if (v.id !== 'view-loading') v.hidden = v.id !== 'view-' + view;
  }

  const root = document.getElementById('view-' + view);
  if (view === 'ex1') {
    renderVocab(root, {
      words: aiOverride.words || daily.words,
      today: TODAY,
      onFinish: refreshHeader,
      onReshuffle: () => reshuffle('ex1'),
      onAiGenerate: () => runAi('ex1'),
      aiAvailable: hasApiKey(),
    });
  } else if (view === 'ex2') {
    renderListening(root, {
      item: aiOverride.dialogue || daily.dialogue,
      today: TODAY,
      onFinish: refreshHeader,
      onReshuffle: () => reshuffle('ex2'),
      onAiGenerate: () => runAi('ex2'),
      aiAvailable: hasApiKey(),
    });
  } else if (view === 'ex3') {
    renderPronounce(root, {
      sentences: aiOverride.sentences || daily.sentences,
      today: TODAY,
      onFinish: refreshHeader,
      onReshuffle: () => reshuffle('ex3'),
      onAiGenerate: () => runAi('ex3'),
      aiAvailable: hasApiKey(),
    });
  } else {
    renderSummary(root);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function reshuffle(ex) {
  daily.salt[ex]++;
  aiOverride[{ ex1: 'words', ex2: 'dialogue', ex3: 'sentences' }[ex]] = null;
  store.clearResult(TODAY, ex);
  pickAll();
  refreshHeader();
  show(ex);
  toast('Đã đổi sang bài khác.');
}

async function runAi(ex) {
  const label = { ex1: 'từ vựng', ex2: 'bài nghe', ex3: 'câu luyện đọc' }[ex];
  toast(`Đang nhờ Claude soạn ${label} mới…`, 60000);
  try {
    if (ex === 'ex1') {
      aiOverride.words = await generateWords(TODAY, bank.words.map((w) => w.word));
    } else if (ex === 'ex2') {
      aiOverride.dialogue = await generateDialogue(TODAY, bank.dialogues.map((d) => d.title));
    } else {
      aiOverride.sentences = await generateSentences(TODAY, bank.sentences.slice(0, 40).map((s) => s.text));
    }
    store.clearResult(TODAY, ex);
    refreshHeader();
    show(ex);
    toast('Đã có bài mới do AI soạn.');
  } catch (e) {
    console.error(e);
    toast('Không sinh được bài mới: ' + e.message, 6000);
  }
}

/* ---------- Header & tổng kết ---------- */

function refreshHeader() {
  document.getElementById('streak-count').textContent = store.getStreak(TODAY);
  for (const [ex, id] of [['ex1', 'tab-score-1'], ['ex2', 'tab-score-2'], ['ex3', 'tab-score-3']]) {
    const r = store.getResult(TODAY, ex);
    document.getElementById(id).textContent = r ? `${r.score}/100` : '';
  }
}

function renderSummary(root) {
  clear(root);
  const results = ['ex1', 'ex2', 'ex3'].map((ex) => store.getResult(TODAY, ex));
  const done = results.filter(Boolean);
  const avg = done.length
    ? Math.round(done.reduce((a, r) => a + r.score, 0) / done.length)
    : null;

  root.append(el('div', { class: 'card exercise-head' },
    el('h1', {}, 'Tổng kết hôm nay'),
    el('p', {}, formatDateVi(TODAY))));

  root.append(el('div', { class: 'card' },
    el('div', { class: 'summary-grid' },
      stat('Điểm trung bình', avg === null ? '—' : `${avg}`),
      stat('Bài đã xong', `${done.length}/3`),
      stat('Chuỗi ngày học', `${store.getStreak(TODAY)} 🔥`),
      stat('Từ đã nhớ', `${store.getKnownWords().length}`),
    )));

  const names = { ex1: 'Bài 1 · Từ vựng', ex2: 'Bài 2 · Nghe hiểu', ex3: 'Bài 3 · Phát âm' };
  const list = el('div', { class: 'card' }, el('h2', { style: 'font-size:17px;margin:0 0 10px' }, 'Chi tiết từng bài'));
  ['ex1', 'ex2', 'ex3'].forEach((ex, i) => {
    const r = results[i];
    list.append(el('div', { class: 'q-block' },
      el('p', { class: 'q-text' }, names[ex], ' — ',
        r ? el('b', { style: 'color:var(--accent)' }, `${r.score}/100`)
          : el('span', { class: 'muted' }, 'chưa làm')),
      r ? el('p', { class: 'muted small', style: 'margin:0' }, r.feedback)
        : el('button', { class: 'btn small', onclick: () => show(ex) }, 'Làm bài này →')));
  });
  root.append(list);

  root.append(el('div', { class: 'card' },
    el('h2', { style: 'font-size:17px;margin:0 0 4px' }, '7 ngày gần nhất'),
    el('p', { class: 'muted small', style: 'margin:0' }, 'Điểm trung bình mỗi ngày'),
    chart(store.getRecentDays(TODAY, 7))));
}

function stat(label, value) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' }, value));
}

function chart(days) {
  return el('div', { class: 'chart' },
    days.map((d) => {
      const h = d.score === null ? 3 : Math.max(4, Math.round(d.score * 0.85));
      return el('div', { class: 'bar-wrap' },
        el('div', { class: 'bar-value' }, d.score === null ? '' : String(d.score)),
        el('div', { class: 'bar' + (d.score === null ? ' empty' : ''), style: `height:${h}px` }),
        el('div', { class: 'bar-label' }, d.date.slice(8) + '/' + d.date.slice(5, 7)));
    }));
}

/* ---------- Cài đặt ---------- */

function wireSettings() {
  const dlg = document.getElementById('dlg-settings');
  const s = store.getSettings();

  document.getElementById('btn-settings').addEventListener('click', () => {
    fillKnownWords();
    document.getElementById('set-apikey').value = s.apiKey || '';
    document.getElementById('set-rate').value = s.rate;
    document.getElementById('set-rate-val').textContent = `${Number(s.rate).toFixed(2)}×`;
    dlg.showModal();
  });

  dlg.addEventListener('close', () => {
    // Lưu key khi đóng hộp thoại; đổi trạng thái nút AI nếu cần.
    const hadKey = hasApiKey();
    store.setSetting('apiKey', document.getElementById('set-apikey').value.trim());
    if (hadKey !== hasApiKey()) show(currentView);
  });

  document.getElementById('btn-theme').addEventListener('click', () => {
    const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
    applyTheme(next);
    store.setSetting('theme', next);
  });

  const rate = document.getElementById('set-rate');
  rate.addEventListener('input', () => {
    document.getElementById('set-rate-val').textContent = `${Number(rate.value).toFixed(2)}×`;
    store.setSetting('rate', Number(rate.value));
  });

  document.getElementById('set-voice').addEventListener('change', (ev) => {
    store.setSetting('voiceURI', ev.target.value);
  });

  document.getElementById('btn-test-voice').addEventListener('click', () => {
    speak('Hello! This is how your daily English lesson will sound.');
  });

  document.getElementById('btn-clear-known').addEventListener('click', () => {
    if (!confirm('Bỏ đánh dấu tất cả các từ đã nhớ?')) return;
    store.clearKnown();
    fillKnownWords();
    pickAll();
    toast('Đã bỏ đánh dấu tất cả.');
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `tien-do-hoc-${TODAY}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const fileInput = document.getElementById('file-import');
  document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      store.importJSON(await f.text());
      toast('Đã nhập tiến độ. Đang tải lại…');
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      toast('File không hợp lệ: ' + e.message, 5000);
    }
    fileInput.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Xoá toàn bộ tiến độ (từ đã nhớ, điểm, streak)? Không thể hoàn tác.')) return;
    store.resetAll();
    location.reload();
  });
}

function fillVoiceSelect() {
  const sel = document.getElementById('set-voice');
  const voices = getEnglishVoices();
  clear(sel);
  if (!voices.length) {
    sel.append(el('option', { value: '' }, 'Không tìm thấy giọng tiếng Anh'));
    return;
  }
  sel.append(el('option', { value: '' }, 'Tự động'));
  const cur = store.getSettings().voiceURI;
  for (const v of voices) {
    sel.append(el('option', { value: v.voiceURI, selected: v.voiceURI === cur || false },
      `${v.name} (${v.lang})`));
  }
}

function fillKnownWords() {
  const box = document.getElementById('known-words-list');
  clear(box);
  const ids = store.getKnownWords();
  if (!ids.length) {
    box.append(el('p', { class: 'muted small', style: 'margin:0' }, 'Chưa có từ nào được đánh dấu.'));
    return;
  }
  for (const id of ids) {
    const w = bank.words.find((x) => x.id === id);
    const chip = el('button', { class: 'chip', type: 'button', title: 'Bấm để bỏ đánh dấu' },
      w ? w.word : id);
    chip.addEventListener('click', () => {
      store.markKnown(id, false);
      fillKnownWords();
      pickAll();
    });
    box.append(chip);
  }
}

/* ---------- Tiện ích ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
