/**
 * Bài 3 — Đọc & phát âm.
 * 10 câu, mỗi câu: nghe mẫu → đọc lại → chấm từng từ 3 mức màu và hiển thị
 * đúng những gì máy nghe được để bạn tự so sánh.
 */

import {
  el, clear, toast, resultCard, setFeedback, colorLegend, renderScoredWords,
} from './ui.js';
import { speak, listen, sttSupported, stopListening } from './speech.js';
import { scoreReading } from './scoring.js';
import { buildFeedback } from './feedback.js';
import * as store from './storage.js';

/**
 * Hook test: khi mở trang với ?debug=1 có thể chạy
 *   window.__setMockTranscript('câu giả lập')
 * để chấm điểm mà không cần micro (dùng cho kiểm thử tự động).
 */
let mockTranscript = null;
if (typeof window !== 'undefined' && /[?&]debug=1/.test(location.search)) {
  window.__setMockTranscript = (t) => { mockTranscript = t; };
}

export function renderPronounce(root, ctx) {
  const { sentences, today, onFinish, onReshuffle, onAiGenerate, aiAvailable } = ctx;
  clear(root);

  // id → { best: number|null, weakWords: string[], attempts: number }
  const results = new Map(sentences.map((s) => [s.id, { best: null, weakWords: [], attempts: 0 }]));
  const saved = store.getResult(today, 'ex3');

  root.append(
    el('div', { class: 'card exercise-head' },
      el('h1', {}, 'Bài 3 · Đọc & phát âm'),
      el('p', {}, `${sentences.length} câu. Bấm 🔊 nghe mẫu, rồi 🎤 đọc lại. `
        + 'Máy sẽ tô màu từng từ và hiện lại câu bạn vừa đọc để so sánh với câu gốc.'),
      el('div', { class: 'head-actions' },
        el('button', { class: 'btn ghost small', onclick: onReshuffle }, '🔀 Đổi bài khác'),
        aiAvailable
          ? el('button', { class: 'btn ghost small', onclick: onAiGenerate }, '✨ Sinh bài mới bằng AI')
          : null,
      ),
      colorLegend(),
      sttSupported() ? null : el('div', { class: 'warn small' },
        '⚠️ Trình duyệt này không hỗ trợ thu âm nên không chấm phát âm tự động được. '
        + 'Bạn vẫn nghe và đọc theo bình thường, rồi tự đánh giá bằng nút bên dưới mỗi câu. '
        + 'Để chấm tự động, hãy mở bằng Chrome hoặc Edge.'),
    ),
  );

  sentences.forEach((s, i) => root.append(sentenceCard(s, i, results)));

  const btnFinish = el('button', { class: 'btn primary' }, '✅ Kết thúc & tính điểm');
  btnFinish.addEventListener('click', () => {
    stopListening();
    finish(root, sentences, results, today, onFinish);
  });
  root.append(el('div', { class: 'card' },
    el('div', { class: 'btn-row' }, btnFinish),
    el('p', { class: 'muted small', style: 'margin:8px 0 0' },
      'Bạn đọc lại được bao nhiêu lần tuỳ thích — hệ thống lấy lần điểm cao nhất.')));

  if (saved) root.append(resultCard(saved.score, saved.feedback));
}

function sentenceCard(s, index, results) {
  const rs = results.get(s.id);
  const card = el('div', { class: 'card' });
  const scoreLabel = el('span', { class: 'sent-score muted' }, 'chưa đọc');
  const readback = el('div', { class: 'readback' });

  const updateScore = () => {
    if (rs.best === null) return;
    scoreLabel.textContent = `${rs.best}/100`;
    scoreLabel.className = 'sent-score';
    scoreLabel.style.color =
      rs.best >= 80 ? 'var(--good)' : rs.best >= 50 ? 'var(--near)' : 'var(--bad)';
  };

  const applyResult = (r) => {
    rs.attempts++;
    if (rs.best === null || r.score > rs.best) {
      rs.best = r.score;
      rs.weakWords = r.weakWords;
    }
    updateScore();

    clear(readback);
    readback.append(
      el('div', { class: 'readback-label' }, 'Câu gốc (đã chấm)'),
      renderScoredWords(r.refWords),
      el('div', { class: 'readback-label' }, 'Bạn đã đọc'),
      r.hypWords.length
        ? renderScoredWords(r.hypWords)
        : el('p', { class: 'muted' }, '(không nghe được từ nào)'),
      el('p', { class: 'muted small', style: 'margin:0' },
        `Lần này: ${r.score}/100 · đúng ${r.counts.good}, gần đúng ${r.counts.near}, `
        + `sai ${r.counts.bad}, thiếu ${r.counts.missing}`
        + (r.counts.extra ? `, thừa ${r.counts.extra}` : '')
        + (rs.attempts > 1 ? ` · điểm cao nhất: ${rs.best}/100` : '')),
    );
  };

  const btnRec = el('button', { class: 'btn' }, '🎤 Đọc lại');
  btnRec.addEventListener('click', async () => {
    if (mockTranscript !== null) {                 // chỉ có khi ?debug=1
      applyResult(scoreReading(s.text, mockTranscript));
      mockTranscript = null;
      return;
    }
    if (!sttSupported()) {
      toast('Trình duyệt này không hỗ trợ thu âm. Dùng Chrome/Edge hoặc tự đánh giá bên dưới.');
      return;
    }
    btnRec.classList.add('rec-active');
    btnRec.textContent = '🔴 Đang nghe… đọc đi!';
    btnRec.disabled = true;
    try {
      const { transcript } = await listen({ timeoutMs: 14000 });
      applyResult(scoreReading(s.text, transcript));
    } catch (e) {
      clear(readback).append(el('p', { class: 'muted small' }, e.message));
    } finally {
      btnRec.classList.remove('rec-active');
      btnRec.textContent = '🎤 Đọc lại';
      btnRec.disabled = false;
    }
  });

  // Tự đánh giá — cứu cánh cho trình duyệt không có STT.
  const selfRate = el('div', { class: 'btn-row', style: 'margin-top:10px' },
    el('span', { class: 'muted small', style: 'align-self:center' }, 'Tự đánh giá:'),
    ...[['Dễ', 100], ['Tạm được', 70], ['Khó', 40]].map(([label, val]) =>
      el('button', { class: 'btn small ghost', onclick: () => {
        rs.attempts++;
        if (rs.best === null || val > rs.best) rs.best = val;
        updateScore();
        toast(`Đã ghi nhận: ${label}`);
      } }, label)),
  );

  // Lọc null trước khi append: DOM.append(null) sẽ chèn chuỗi "null" vào trang.
  card.append(...[
    el('div', { class: 'sent-en' }, `${index + 1}. ${s.text}`),
    el('div', { class: 'sent-vi' }, s.vi),
    el('div', { class: 'sent-actions' },
      el('button', { class: 'btn', onclick: () => speak(s.text) }, '🔊 Nghe mẫu'),
      el('button', { class: 'btn ghost small', onclick: () => speak(s.text, { rate: 0.7 }) }, '🐢 Chậm'),
      btnRec,
      s.focus ? el('span', { class: 'word-pos' }, 'chú ý: ' + s.focus) : null,
      scoreLabel,
    ),
    readback,
    sttSupported() ? null : selfRate,
  ].filter(Boolean));
  return card;
}

async function finish(root, sentences, results, today, onFinish) {
  const all = [...results.values()];
  const attempted = all.filter((r) => r.best !== null);
  // Câu chưa đọc tính 0 điểm — nếu không, bỏ qua câu khó sẽ được điểm cao oan.
  const score = Math.round(all.reduce((sum, r) => sum + (r.best ?? 0), 0) / sentences.length);

  const weakCount = {};
  for (const r of all) for (const w of r.weakWords) weakCount[w] = (weakCount[w] || 0) + 1;
  const weakWords = Object.entries(weakCount).sort((a, b) => b[1] - a[1]).map(([w]) => w);

  const detail = {
    attempted: attempted.length,
    total: sentences.length,
    weakWords: weakWords.slice(0, 8),
    avgNear: 0,
  };

  const old = document.getElementById('result-card');
  if (old) old.remove();
  root.append(resultCard(score, '', {
    loading: true,
    extra: el('div', {},
      el('p', { class: 'muted small', style: 'margin:10px 0 4px' },
        `Đã đọc ${attempted.length}/${sentences.length} câu`),
      weakWords.length
        ? el('div', {},
            el('div', { class: 'readback-label' }, 'Từ cần luyện thêm'),
            el('div', { class: 'readback-line' },
              weakWords.slice(0, 12).map((w) => el('span', { class: 'w w-bad' }, w))))
        : null),
  }));
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const feedback = await buildFeedback('ex3', score, detail, today);
  setFeedback(feedback);
  store.saveResult(today, 'ex3', { score, detail, feedback });
  toast(`Bài 3: ${score}/100`);
  onFinish?.();
}
