/**
 * Bài 2 — Nghe hiểu.
 * Phát một đoạn hội thoại / đoạn văn bằng TTS, transcript ẩn mặc định,
 * rồi trả lời 4–5 câu hỏi trắc nghiệm.
 */

import { el, clear, toast, resultCard, setFeedback } from './ui.js';
import { speak, speakLines, stopSpeaking } from './speech.js';
import { buildFeedback } from './feedback.js';
import * as store from './storage.js';

export function renderListening(root, ctx) {
  const { item, today, onFinish, onReshuffle, onAiGenerate, aiAvailable } = ctx;
  clear(root);

  if (!item) {
    root.append(el('div', { class: 'card center' }, el('p', {}, 'Không tải được bài nghe hôm nay.')));
    return;
  }

  const state = {
    answers: new Array(item.questions.length).fill(null),
    replays: 0,
    usedTranscript: false,
    rate: 0.9,
    playing: false,
  };
  const saved = store.getResult(today, 'ex2');

  root.append(
    el('div', { class: 'card exercise-head' },
      el('h1', {}, 'Bài 2 · Nghe hiểu'),
      el('p', {}, `Chủ đề: “${item.title}”${item.titleVi ? ` (${item.titleVi})` : ''}. `
        + 'Nghe kỹ rồi trả lời câu hỏi. Chỉ mở transcript khi bạn thật sự chưa nghe ra.'),
      el('div', { class: 'head-actions' },
        el('button', { class: 'btn ghost small', onclick: onReshuffle }, '🔀 Đổi bài khác'),
        aiAvailable
          ? el('button', { class: 'btn ghost small', onclick: onAiGenerate }, '✨ Sinh bài mới bằng AI')
          : null,
      ),
    ),
  );

  root.append(playerCard(item, state));
  root.append(questionsCard(item, state, root, today, onFinish));

  if (saved) root.append(resultCard(saved.score, saved.feedback));
}

function playerCard(item, state) {
  const btnPlay = el('button', { class: 'btn primary' }, '▶️ Phát đoạn hội thoại');
  const btnStop = el('button', { class: 'btn ghost' }, '⏹ Dừng');
  const rateSel = el('select', { class: 'btn' },
    el('option', { value: '0.75' }, '0.75× chậm'),
    el('option', { value: '0.9', selected: true }, '0.9× vừa'),
    el('option', { value: '1' }, '1× bình thường'));
  const replayInfo = el('span', { class: 'muted small' });

  rateSel.addEventListener('change', () => { state.rate = Number(rateSel.value); });

  const transcript = el('div', { class: 'transcript', hidden: true },
    item.lines.map((l) =>
      el('p', { class: 'transcript-line' },
        l.speaker && l.speaker !== 'N' ? el('b', {}, l.speaker + ': ') : null,
        l.text)));

  const btnTranscript = el('button', { class: 'btn ghost' }, '👁 Xem transcript');
  btnTranscript.addEventListener('click', () => {
    const showing = !transcript.hidden;
    transcript.hidden = showing;
    btnTranscript.textContent = showing ? '👁 Xem transcript' : '🙈 Ẩn transcript';
    if (!showing) state.usedTranscript = true;
  });

  btnPlay.addEventListener('click', async () => {
    if (state.playing) return;
    state.playing = true;
    state.replays++;
    replayInfo.textContent = `Đã nghe ${state.replays} lượt`;
    btnPlay.textContent = '🔊 Đang phát…';
    btnPlay.disabled = true;
    try {
      await speakLines(item.lines, { rate: state.rate });
    } finally {
      state.playing = false;
      btnPlay.textContent = '🔁 Nghe lại';
      btnPlay.disabled = false;
    }
  });

  btnStop.addEventListener('click', () => {
    stopSpeaking();
    state.playing = false;
    btnPlay.disabled = false;
    btnPlay.textContent = '🔁 Nghe lại';
  });

  return el('div', { class: 'card' },
    el('div', { class: 'player' }, btnPlay, btnStop, rateSel, btnTranscript, replayInfo),
    transcript);
}

function questionsCard(item, state, root, today, onFinish) {
  const card = el('div', { class: 'card' },
    el('h2', { style: 'font-size:17px;margin:0 0 10px' }, 'Câu hỏi'));

  item.questions.forEach((q, qi) => {
    const block = el('div', { class: 'q-block' },
      el('p', { class: 'q-text' }, `${qi + 1}. ${q.q}`));
    const explain = el('div', { class: 'q-explain', hidden: true }, q.explainVi);
    const buttons = [];

    q.options.forEach((opt, oi) => {
      const b = el('button', { class: 'opt' }, `${'ABCD'[oi]}. ${opt}`);
      b.addEventListener('click', () => {
        if (state.answers[qi] !== null) return;
        state.answers[qi] = oi;
        buttons.forEach((x, xi) => {
          x.disabled = true;
          if (xi === q.answer) x.classList.add('correct');
          else if (xi === oi) x.classList.add('wrong');
        });
        explain.hidden = false;
        explain.textContent = (oi === q.answer ? '✅ Chính xác. ' : '❌ Chưa đúng. ') + q.explainVi;
      });
      buttons.push(b);
      block.append(b);
    });

    block.append(explain);
    card.append(block);
  });

  const btnPlayQ = el('button', { class: 'btn ghost' }, '🔊 Đọc lại câu hỏi');
  btnPlayQ.addEventListener('click', async () => {
    for (const q of item.questions) { await speak(q.q); await new Promise((r) => setTimeout(r, 200)); }
  });

  const btnFinish = el('button', { class: 'btn primary' }, '✅ Kết thúc & tính điểm');
  btnFinish.addEventListener('click', () => {
    stopSpeaking();
    finish(root, item, state, today, onFinish);
  });

  card.append(el('div', { class: 'btn-row', style: 'margin-top:14px' }, btnFinish, btnPlayQ));
  return card;
}

async function finish(root, item, state, today, onFinish) {
  const total = item.questions.length;
  const correct = item.questions.reduce(
    (n, q, i) => n + (state.answers[i] === q.answer ? 1 : 0), 0);
  const unanswered = state.answers.filter((a) => a === null).length;

  let score = Math.round((correct / total) * 100);
  // Mở transcript trước khi trả lời thì trừ nhẹ, vì đó không còn là bài "nghe".
  if (state.usedTranscript) score = Math.round(score * 0.9);

  const detail = { correct, total, unanswered, usedTranscript: state.usedTranscript, replays: state.replays };

  const old = document.getElementById('result-card');
  if (old) old.remove();
  root.append(resultCard(score, '', {
    loading: true,
    extra: el('p', { class: 'muted small', style: 'margin:10px 0 0' },
      `Đúng ${correct}/${total} câu`
      + (unanswered ? ` · còn ${unanswered} câu chưa trả lời` : '')
      + (state.usedTranscript ? ' · đã xem transcript (−10%)' : '')
      + ` · nghe ${state.replays} lượt`),
  }));
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const feedback = await buildFeedback('ex2', score, detail, today);
  setFeedback(feedback);
  store.saveResult(today, 'ex2', { score, detail, feedback });
  toast(`Bài 2: ${score}/100`);
  onFinish?.();
}
