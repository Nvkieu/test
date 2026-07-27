/** Tiện ích DOM dùng chung cho các bài. */

/** Tạo element: el('div', { class: 'card' }, 'text', childNode) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let toastTimer = null;
export function toast(message, ms = 3200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** Thẻ kết quả cuối bài: điểm to + nhận xét (có trạng thái đang tải). */
export function resultCard(score, feedbackText, { loading = false, extra = null } = {}) {
  return el('div', { class: 'card result-card', id: 'result-card' },
    el('div', { class: 'muted small' }, 'Kết quả bài này'),
    el('div', { class: 'score-big' }, String(score), el('small', {}, '/100')),
    el('p', { class: 'feedback' + (loading ? ' loading' : ''), id: 'feedback-text' },
      loading ? 'Đang viết nhận xét…' : feedbackText),
    extra,
  );
}

/** Cập nhật phần nhận xét trong thẻ kết quả đã render. */
export function setFeedback(text) {
  const p = document.getElementById('feedback-text');
  if (p) {
    p.textContent = text;
    p.classList.remove('loading');
  }
}

/** Dãy chấm tiến độ (đã làm bao nhiêu / tổng). */
export function progressDots(total, doneCount) {
  return el('div', { class: 'progress-dots' },
    Array.from({ length: total }, (_, i) =>
      el('div', { class: 'dot' + (i < doneCount ? ' done' : '') })));
}

/** Chú thích màu cho phần chấm phát âm. */
export function colorLegend() {
  return el('div', { class: 'legend' },
    el('span', { class: 'lg-good' }, 'Đúng'),
    el('span', { class: 'lg-near' }, 'Gần đúng'),
    el('span', { class: 'lg-bad' }, 'Sai / thiếu'),
  );
}

/** Render một dãy từ đã chấm màu thành các <span class="w w-…">. */
export function renderScoredWords(words, { showMissing = true } = {}) {
  const cls = { good: 'w-good', near: 'w-near', bad: 'w-bad', miss: 'w-miss', extra: 'w-extra' };
  return el('div', { class: 'readback-line' },
    words
      .filter((w) => showMissing || w.level !== 'miss')
      .map((w) => el('span', {
        class: 'w ' + (cls[w.level] || 'w-bad'),
        title: w.heard ? `Bạn đọc thành: “${w.heard}”` : undefined,
      }, w.text)));
}
