/**
 * Bài 1 — Từ vựng.
 * 10 từ A2+ với nghĩa tiếng Việt, ví dụ, nút nghe, nút đọc (chấm phát âm)
 * và nút "đã nhớ" (đánh dấu xong thì không hiện lại nữa).
 */

import { el, clear, toast, resultCard, setFeedback, progressDots, colorLegend } from './ui.js';
import { speak, listen, sttSupported, stopListening } from './speech.js';
import { scoreWord } from './scoring.js';
import { buildFeedback } from './feedback.js';
import * as store from './storage.js';

export function renderVocab(root, ctx) {
  const { words, today, onFinish, onReshuffle, onAiGenerate, aiAvailable } = ctx;
  clear(root);

  // readState: id → { spoken: 'good'|'near'|'bad'|null, known: bool }
  const readState = new Map(words.map((w) => [w.id, { spoken: null, known: store.isKnown(w.id) }]));
  const saved = store.getResult(today, 'ex1');

  root.append(
    el('div', { class: 'card exercise-head' },
      el('h1', {}, 'Bài 1 · Từ vựng'),
      el('p', {}, `${words.length} từ mới trình độ A2+. Nghe mẫu, đọc lại, và đánh dấu ✅ những từ bạn đã thuộc — chúng sẽ không xuất hiện lại.`),
      el('div', { class: 'head-actions' },
        el('button', { class: 'btn ghost small', onclick: onReshuffle }, '🔀 Đổi bài khác'),
        aiAvailable
          ? el('button', { class: 'btn ghost small', onclick: onAiGenerate }, '✨ Sinh bài mới bằng AI')
          : null,
      ),
      colorLegend(),
    ),
  );

  if (!words.length) {
    root.append(el('div', { class: 'card center' },
      el('p', {}, '🎉 Bạn đã đánh dấu "đã nhớ" cho toàn bộ ngân hàng từ vựng!'),
      el('p', { class: 'muted small' }, 'Vào Cài đặt → Từ đã nhớ để bỏ đánh dấu một số từ, hoặc dùng "Sinh bài mới bằng AI".')));
    return;
  }

  for (const w of words) root.append(wordCard(w, readState));

  const footer = el('div', { class: 'card' },
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn primary', id: 'ex1-finish' }, '✅ Kết thúc & tính điểm'),
      el('button', { class: 'btn ghost', onclick: () => speakAll(words) }, '🔊 Nghe lại tất cả'),
    ),
    el('p', { class: 'muted small', style: 'margin:8px 0 0' },
      'Điểm = số từ bạn đọc đúng + số từ bạn đánh dấu đã nhớ.'),
  );
  root.append(footer);

  footer.querySelector('#ex1-finish').addEventListener('click', () => {
    stopListening();
    finish(root, words, readState, today, onFinish);
  });

  if (saved) {
    root.append(resultCard(saved.score, saved.feedback));
  }
}

function wordCard(w, readState) {
  const st = readState.get(w.id);
  const card = el('div', { class: 'card word-card' + (st.known ? ' known' : '') });

  const result = el('span', { class: 'word-result' });
  const showLevel = (level, heard) => {
    const map = {
      good: ['✅ Đúng rồi!', 'var(--good)'],
      near: ['🟦 Gần đúng', 'var(--near)'],
      bad: ['❌ Chưa đúng', 'var(--bad)'],
    };
    const [text, color] = map[level] || map.bad;
    result.textContent = heard && level !== 'good' ? `${text} (nghe: “${heard}”)` : text;
    result.style.color = color;
  };
  if (st.spoken) showLevel(st.spoken);

  const btnKnown = el('button', {
    class: 'btn small' + (st.known ? ' primary' : ' ghost'),
  }, st.known ? '✅ Đã nhớ' : '☐ Đánh dấu đã nhớ');

  btnKnown.addEventListener('click', () => {
    st.known = !st.known;
    store.markKnown(w.id, st.known);
    btnKnown.textContent = st.known ? '✅ Đã nhớ' : '☐ Đánh dấu đã nhớ';
    btnKnown.className = 'btn small' + (st.known ? ' primary' : ' ghost');
    card.classList.toggle('known', st.known);
  });

  const btnRec = sttSupported()
    ? el('button', { class: 'btn small' }, '🎤 Đọc lại')
    : null;

  if (btnRec) {
    btnRec.addEventListener('click', async () => {
      btnRec.classList.add('rec-active');
      btnRec.textContent = '🔴 Đang nghe…';
      result.textContent = '';
      try {
        const { transcript } = await listen({ timeoutMs: 8000 });
        const r = scoreWord(w.word, transcript);
        st.spoken = r.level;
        showLevel(r.level, transcript);
      } catch (e) {
        result.textContent = e.message;
        result.style.color = 'var(--muted)';
      } finally {
        btnRec.classList.remove('rec-active');
        btnRec.textContent = '🎤 Đọc lại';
      }
    });
  }

  card.append(
    el('div', { class: 'word-top' },
      el('span', { class: 'word-en' }, w.word),
      el('span', { class: 'word-ipa' }, w.ipa || ''),
      el('span', { class: 'word-pos' }, viPos(w.pos)),
    ),
    el('div', { class: 'word-vi' }, 'Nghĩa: ', el('b', {}, w.vi)),
    el('div', { class: 'word-example' },
      el('div', { class: 'en' }, '“' + w.example + '”'),
      el('div', { class: 'vi' }, w.exampleVi),
    ),
    el('div', { class: 'word-actions' },
      el('button', { class: 'btn small', onclick: () => speak(w.word) }, '🔊 Nghe từ'),
      el('button', { class: 'btn small ghost', onclick: () => speak(w.example) }, '🔊 Nghe ví dụ'),
      btnRec,
      btnKnown,
      result,
    ),
  );
  return card;
}

const POS_VI = {
  noun: 'danh từ', verb: 'động từ', adjective: 'tính từ', adverb: 'trạng từ',
  phrase: 'cụm từ', preposition: 'giới từ',
};
function viPos(pos) { return POS_VI[pos] || pos || ''; }

async function speakAll(words) {
  for (const w of words) {
    await speak(w.word);
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function finish(root, words, readState, today, onFinish) {
  const states = [...readState.values()];
  const known = states.filter((s) => s.known).length;
  const spokenOk = states.filter((s) => s.spoken === 'good' || s.spoken === 'near').length;

  // Mỗi từ tính 1 điểm nếu đã nhớ HOẶC đọc đúng; đọc gần đúng mà chưa nhớ = 0.5.
  let earned = 0;
  for (const s of states) {
    if (s.known || s.spoken === 'good') earned += 1;
    else if (s.spoken === 'near') earned += 0.5;
  }
  const score = Math.round((earned / words.length) * 100);

  const wrongWords = words
    .filter((w) => readState.get(w.id).spoken === 'bad')
    .map((w) => w.word);

  const detail = { known, total: words.length, spokenOk, wrongWords };

  const old = document.getElementById('result-card');
  if (old) old.remove();
  root.append(resultCard(score, '', {
    loading: true,
    extra: el('div', {},
      el('p', { class: 'muted small', style: 'margin:10px 0 4px' },
        `Đã nhớ ${known}/${words.length} từ · Đọc đúng ${spokenOk}/${words.length} từ`),
      progressDots(words.length, known)),
  }));
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const feedback = await buildFeedback('ex1', score, detail, today);
  setFeedback(feedback);
  store.saveResult(today, 'ex1', { score, detail, feedback });
  toast(`Bài 1: ${score}/100`);
  onFinish?.();
}
