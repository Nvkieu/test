/**
 * Ghép các phần lại: nhập Excel → sửa số → xem trước báo cáo + tin nhắn → gửi Zalo.
 */

import { FIELDS, emptyReport, fillDerived, formatVN, parseVN, templateVars } from './metrics.js';
import { extractReport, UNITS, parsePeriod } from './excel-import.js';
import { renderTemplate, VARIABLE_HELP, DEFAULT_TEMPLATE } from './template.js';
import { renderReport, exportPdf, pdfFilename } from './pdf.js';
import {
  loadSettings, saveSettings, normalizePhone, defaultGuideUrl,
  saveLastReport, loadLastReport, settingsLink, settingsFromHash,
} from './settings.js';
import { sendDesktop, shareText, shareFile, canSharePhone, copyText, downloadBlob, zaloChatUrl } from './zalo-share.js';
import { SAMPLE_SHEETS } from './sample-data.js';

const $ = (sel) => document.querySelector(sel);
const settings = loadSettings();
let report = emptyReport();
let sourceName = '';
let pdf = { blob: null, key: '' }; // PDF đã tạo cho trạng thái dữ liệu nào
let renderTimer = 0;
let pdfTimer = 0;

const todayVN = () => new Date().toLocaleDateString('vi-VN');

/* ---------- Thông báo ---------- */

function toast(msg, kind = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.kind = kind;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 4500);
}

/* ---------- Bước 1: nhập dữ liệu ---------- */

function readWorkbook(arrayBuffer) {
  if (!window.XLSX) throw new Error('Chưa tải được thư viện đọc Excel (kiểm tra kết nối mạng).');
  const wb = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  return wb.SheetNames.map((name) => ({
    name,
    rows: window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }),
  }));
}

function loadSheets(sheets, name, { quiet = false } = {}) {
  const { report: r, found, derived } = extractReport(sheets, {
    customAliases: settings.customAliases,
    unit: settings.unit,
  });
  if (!r.period) {
    const d = new Date();
    r.period = { month: d.getMonth() + 1, year: d.getFullYear() };
  }
  report = r;
  sourceName = name;
  lastSheets = sheets;

  const total = FIELDS.length;
  const got = FIELDS.filter((f) => report.values[f.key] !== null).length;
  const parts = [`Đã đọc <b>${escapeHtml(name)}</b>: nhận diện ${found.length} chỉ số`];
  if (derived.length) parts.push(`tự tính thêm ${derived.length}`);
  parts.push(`bảng theo tháng: ${report.monthly.length ? report.monthly.length + ' tháng' : 'không có'}`);
  parts.push(`tồn kho: ${report.inventory.length ? report.inventory.length + ' mặt hàng' : 'không có'}`);
  const status = $('#import-status');
  status.innerHTML = parts.join(' · ') + '.' +
    (got < total ? ` <span class="warn">Còn ${total - got} ô trống — điền tay ở bước 2 hoặc khai báo nhãn trong "Ánh xạ nhãn".</span>` : '');
  status.hidden = false;

  buildForm();
  scheduleRender();
  if (!quiet) $('#step-2').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let lastSheets = null;

async function onFile(file) {
  if (!file) return;
  try {
    const sheets = readWorkbook(await file.arrayBuffer());
    loadSheets(sheets, file.name);
  } catch (err) {
    console.error(err);
    toast(`Không đọc được file: ${err.message}`, 'error');
  }
}

function setupImport() {
  const drop = $('#drop');
  const input = $('#file');
  input.addEventListener('change', () => onFile(input.files[0]));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    onFile(e.dataTransfer.files[0]);
  });

  const unit = $('#unit');
  unit.innerHTML = Object.entries(UNITS).map(([k, u]) => `<option value="${k}">${u.label}</option>`).join('');
  unit.value = settings.unit;
  unit.addEventListener('change', () => {
    settings.unit = unit.value;
    saveSettings(settings);
    if (lastSheets) loadSheets(lastSheets, sourceName);
  });

  $('#use-sample').addEventListener('click', () => {
    const prevUnit = settings.unit;
    settings.unit = 'trieu';
    loadSheets(SAMPLE_SHEETS, 'dữ liệu mẫu');
    settings.unit = prevUnit;
  });

  $('#download-sample').addEventListener('click', () => {
    if (!window.XLSX) return toast('Chưa tải được thư viện Excel.', 'error');
    const wb = window.XLSX.utils.book_new();
    for (const s of SAMPLE_SHEETS) {
      const ws = window.XLSX.utils.aoa_to_sheet(s.rows);
      ws['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
      window.XLSX.utils.book_append_sheet(wb, ws, s.name);
    }
    window.XLSX.writeFile(wb, 'mau-du-lieu.xlsx');
  });
}

/* ---------- Bước 2: kiểm tra / sửa số ---------- */

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function buildForm() {
  const groups = new Map();
  for (const f of FIELDS) {
    if (!groups.has(f.group)) groups.set(f.group, []);
    groups.get(f.group).push(f);
  }

  const p = report.period || {};
  $('#company').value = settings.company || report.company || '';
  $('#period').value = p.month && p.year ? `${p.month}/${p.year}` : '';

  $('#fields').innerHTML = [...groups]
    .map(
      ([group, fields]) => `
      <fieldset>
        <legend>${group}</legend>
        ${fields
          .map((f) => {
            const val = report.values[f.key];
            return `<label class="field ${val === null ? 'missing' : ''}">
              <span>${f.label}</span>
              <input inputmode="decimal" data-key="${f.key}" value="${val === null ? '' : formatVN(val, Number.isInteger(val) ? 0 : 2)}" placeholder="trống">
            </label>`;
          })
          .join('')}
      </fieldset>`,
    )
    .join('');

  $('#aliases').innerHTML = FIELDS.map(
    (f) => `<label class="field"><span>${f.label}</span>
      <input data-alias="${f.key}" value="${escapeHtml((settings.customAliases[f.key] || []).join('; '))}" placeholder="vd: ${escapeHtml(f.aliases[0])}"></label>`,
  ).join('');
}

function setupForm() {
  $('#fields').addEventListener('input', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    const n = parseVN(e.target.value);
    report.values[key] = n;
    e.target.closest('.field').classList.toggle('missing', n === null);
    e.target.classList.toggle('invalid', e.target.value.trim() !== '' && n === null);
    scheduleRender();
  });

  $('#company').addEventListener('input', (e) => {
    settings.company = e.target.value;
    saveSettings(settings);
    scheduleRender();
  });

  $('#period').addEventListener('input', (e) => {
    const p = parsePeriod(e.target.value);
    e.target.classList.toggle('invalid', !p);
    if (p) {
      report.period = p;
      scheduleRender();
    }
  });

  $('#aliases').addEventListener('change', (e) => {
    const key = e.target.dataset.alias;
    if (!key) return;
    const list = e.target.value.split(';').map((s) => s.trim()).filter(Boolean);
    if (list.length) settings.customAliases[key] = list;
    else delete settings.customAliases[key];
    saveSettings(settings);
    if (lastSheets) {
      loadSheets(lastSheets, sourceName);
      toast('Đã lưu nhãn và đọc lại file.');
    }
  });

  $('#recalc').addEventListener('click', () => {
    // Chỉ điền vào ô còn trống, không ghi đè số đã nhập.
    fillDerived(report);
    buildForm();
    scheduleRender();
  });
}

/* ---------- Bước 3: tin nhắn ---------- */

function currentMessage() {
  const vars = templateVars(report, {
    company: settings.company || report.company,
    bossTitle: settings.bossTitle,
    guideUrl: settings.guideUrl,
    today: todayVN(),
  });
  return renderTemplate(settings.template, vars);
}

function setupMessage() {
  const bind = (id, key, after) => {
    const el = $(id);
    el.value = settings[key];
    el.addEventListener('input', () => {
      settings[key] = el.value;
      saveSettings(settings);
      after?.(el);
      scheduleRender();
    });
  };
  bind('#boss-title', 'bossTitle');
  bind('#boss-phone', 'bossPhone', (el) => {
    el.classList.toggle('invalid', el.value.trim() !== '' && !normalizePhone(el.value));
  });
  bind('#guide-url', 'guideUrl');
  bind('#template', 'template');

  $('#reset-template').addEventListener('click', () => {
    settings.template = DEFAULT_TEMPLATE;
    settings.guideUrl = settings.guideUrl || defaultGuideUrl();
    $('#template').value = settings.template;
    saveSettings(settings);
    scheduleRender();
  });

  $('#vars').innerHTML = VARIABLE_HELP.map(
    ([k, d]) => `<button type="button" class="chip" data-var="${k}" title="${escapeHtml(d)}">{{${k}}}</button>`,
  ).join('');
  $('#vars').addEventListener('click', (e) => {
    const v = e.target.dataset.var;
    if (!v) return;
    const ta = $('#template');
    const pos = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, pos) + `{{${v}}}` + ta.value.slice(ta.selectionEnd ?? pos);
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  });
}

/* ---------- Xem trước + PDF ---------- */

function stateKey() {
  return JSON.stringify([report, settings.company]);
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
}

function render() {
  const hasData = FIELDS.some((f) => report.values[f.key] !== null);
  if (hasData && sourceName !== 'dữ liệu mẫu') saveLastReport(report, sourceName);
  $('#preview-empty').hidden = hasData;
  $('#paper-wrap').hidden = !hasData;

  const msg = currentMessage();
  $('#message').value = msg.text;
  const warn = [];
  if (msg.unknown.length) warn.push(`Biến không tồn tại: ${msg.unknown.map((v) => `{{${v}}}`).join(', ')}`);
  const emptyVars = msg.empty.filter((k) => k !== 'nhan_xet');
  if (emptyVars.length) warn.push(`Chưa có số: ${emptyVars.map((v) => `{{${v}}}`).join(', ')}`);
  if (!settings.guideUrl.trim() && settings.template.includes('{{link_huong_dan}}')) warn.push('Chưa có link hướng dẫn.');
  $('#message-warn').textContent = warn.join(' · ');
  $('#message-warn').hidden = !warn.length;

  const phone = normalizePhone(settings.bossPhone);
  const phoneMode = canSharePhone();
  $('#send-target').textContent = phoneMode
    ? 'Trên điện thoại: tin nhắn và PDF được chuyển sang Zalo, bạn chọn sếp trong Zalo.'
    : phone ? `Mở chat Zalo với ${phone}` : 'Chưa có SĐT sếp — sẽ mở Zalo Web để bạn tự chọn người nhận';
  $('#desktop-hint').hidden = phoneMode;

  if (hasData) {
    renderReport($('#paper'), report, { company: settings.company || report.company, today: todayVN() });
    $('#pdf-name').textContent = pdfFilename(report);
    fitPaper();
  }
  $('#send').disabled = !hasData;
  $('#only-pdf').disabled = !hasData;

  // Tạo sẵn PDF khi người dùng ngừng sửa — để lúc bấm Gửi trên điện thoại
  // bảng chia sẻ mở ngay (trình duyệt chỉ cho mở trong vài giây sau cú bấm).
  if (pdf.key !== stateKey()) {
    pdf.blob = null;
    clearTimeout(pdfTimer);
    if (hasData) pdfTimer = setTimeout(() => ensurePdf().catch(() => {}), 1200);
  }
}

/** Thu nhỏ trang A4 (760px) cho vừa khung xem trước mà không đổi bản PDF. */
function fitPaper() {
  const wrap = $('#paper-wrap');
  const paper = $('#paper');
  const scale = Math.min(1, wrap.clientWidth / paper.offsetWidth || 1);
  $('#paper-scale').style.transform = scale < 1 ? `scale(${scale})` : '';
  wrap.style.height = `${Math.ceil(paper.offsetHeight * scale)}px`;
}
try {
  new ResizeObserver(() => !$('#paper-wrap').hidden && fitPaper()).observe($('#paper-wrap'));
} catch {
  window.addEventListener('resize', () => !$('#paper-wrap').hidden && fitPaper());
}

let pdfJob = null;
async function ensurePdf() {
  const key = stateKey();
  if (pdf.blob && pdf.key === key) return pdf.blob;
  if (pdfJob && pdfJob.key === key) return pdfJob.promise;
  clearTimeout(renderTimer);
  render();
  const promise = exportPdf($('#paper'), pdfFilename(report)).then((blob) => {
    if (stateKey() === key) pdf = { blob, key };
    return blob;
  });
  pdfJob = { key, promise };
  try {
    return await promise;
  } finally {
    if (pdfJob?.promise === promise) pdfJob = null;
  }
}

/* ---------- Bước 4: gửi ---------- */

function setBusy(btn, busy, text) {
  btn.disabled = busy;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.textContent = text;
  } else if (btn.dataset.label) {
    btn.textContent = btn.dataset.label;
  }
}

function setupSend() {
  $('#send').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = $('#message').value;

    if (canSharePhone()) {
      // Điện thoại: mở Zalo ngay với tin nhắn theo template (Zalo điền sẵn),
      // rồi hiện nút ② để gửi tiếp file PDF.
      for (const id of ['#share-text', '#share-pdf']) $(id).classList.remove('done');
      $('#mobile-steps').hidden = false;
      ensurePdf().catch((err) => toast(err.message, 'error')); // tạo PDF song song
      const result = await shareText(text);
      if (result === 'shared') {
        $('#share-text').classList.add('done');
        toast('Đã gửi tin sang Zalo. Tiếp theo: ② Gửi file PDF.', 'ok');
      } else if (result === 'failed') {
        copyText(text);
        toast('Không mở được bảng chia sẻ. Tin đã được chép — mở Zalo và dán vào.', 'error');
      }
      $('#mobile-steps').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    setBusy(btn, true, 'Đang chuẩn bị…');
    try {
      const blob = await ensurePdf();
      const copied = await sendDesktop({
        pdfBlob: blob,
        filename: pdfFilename(report),
        text,
        phone: normalizePhone(settings.bossPhone),
      });
      $('#desktop-steps').hidden = false;
      $('#desktop-steps').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast(copied ? 'Đã chép tin nhắn và tải PDF. Trong Zalo: Ctrl+V rồi kéo file vào.' : 'Đã tải PDF. Hãy chép tin nhắn ở bước 3 rồi dán vào Zalo.', copied ? 'ok' : 'error');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Không gửi được.', 'error');
    } finally {
      setBusy(btn, false);
    }
  });

  $('#share-text').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const result = await shareText($('#message').value);
    if (result === 'shared') {
      btn.classList.add('done');
      toast('Đã gửi tin sang Zalo. Tiếp theo: ② Gửi file PDF.', 'ok');
    } else if (result === 'failed') {
      toast('Không mở được bảng chia sẻ. Tin đã được chép sẵn — mở Zalo và dán vào.', 'error');
    }
  });

  $('#share-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const filename = pdfFilename(report);
    if (!pdf.blob || pdf.key !== stateKey()) {
      // Số liệu vừa đổi: tạo lại PDF, rồi bấm lần nữa để mở bảng chia sẻ.
      setBusy(btn, true, 'Đang tạo PDF…');
      try {
        await ensurePdf();
        toast('PDF đã cập nhật — bấm "② Gửi file PDF" lần nữa.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setBusy(btn, false);
      }
      return;
    }
    const result = await shareFile(pdf.blob, filename);
    if (result === 'shared') {
      btn.classList.add('done');
      toast('Đã gửi PDF sang Zalo.', 'ok');
    } else if (result === 'unsupported' || result === 'failed') {
      downloadBlob(pdf.blob, filename);
      toast('Trình duyệt này không chia sẻ được file — PDF đã tải về, hãy đính kèm trong Zalo.', 'error');
    }
  });

  $('#only-copy').addEventListener('click', async () => {
    const ok = await copyText($('#message').value);
    toast(ok ? 'Đã chép tin nhắn.' : 'Không chép được — hãy bôi đen và Ctrl+C.', ok ? 'ok' : 'error');
  });

  $('#only-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true, 'Đang tạo PDF…');
    try {
      downloadBlob(await ensurePdf(), pdfFilename(report));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(btn, false);
    }
  });

  $('#open-zalo').addEventListener('click', () => {
    window.open(zaloChatUrl(normalizePhone(settings.bossPhone)), '_blank', 'noopener');
  });
}

/* ---------- Khởi động ---------- */

function setupSettingsLink() {
  $('#copy-settings-link').addEventListener('click', async () => {
    const link = settingsLink(settings, location.href.split('#')[0]);
    const ok = await copyText(link);
    toast(ok ? 'Đã chép link. Gửi link này sang điện thoại (vd: Zalo "Cloud của tôi") rồi mở là có sẵn cài đặt.' : link, ok ? 'ok' : 'info');
  });
}

/** Nhận cài đặt từ link "#cfg=…" (mở từ máy khác), lưu lại rồi xoá khỏi thanh địa chỉ. */
function applySettingsFromLink() {
  const incoming = settingsFromHash(location.hash);
  if (!incoming) return false;
  Object.assign(settings, incoming);
  saveSettings(settings);
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* bỏ qua */
  }
  return true;
}

/** Mở trang là có số liệu: lần trước đã dùng gì thì hiện lại, chưa có thì dùng dữ liệu mẫu. */
function restoreData() {
  const last = loadLastReport();
  const status = $('#import-status');
  if (last) {
    report = last.report;
    sourceName = last.sourceName || '';
    const when = new Date(last.savedAt).toLocaleString('vi-VN');
    status.innerHTML = `Đang dùng số liệu lần trước (<b>${escapeHtml(sourceName || 'nhập tay')}</b>, lưu lúc ${when}). Kéo file mới vào để cập nhật.`;
    status.hidden = false;
    buildForm();
  } else {
    loadSheets(SAMPLE_SHEETS, 'dữ liệu mẫu', { quiet: true });
    status.innerHTML += ' <span class="warn">Đây là dữ liệu mẫu — kéo file Excel thật vào để thay.</span>';
  }
}

const fromLink = applySettingsFromLink();
setupImport();
setupForm();
setupMessage();
setupSend();
setupSettingsLink();
buildForm();
restoreData();
render();
if (fromLink) toast('Đã nhận cài đặt từ link: SĐT sếp, xưng hô, template.', 'ok');
