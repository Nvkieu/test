/**
 * Dựng báo cáo A4 bằng HTML (kèm biểu đồ Chart.js) rồi xuất PDF bằng html2pdf.js.
 * html2pdf chụp trang thành ảnh nên tiếng Việt có dấu hiển thị đúng mà không
 * cần nhúng font vào PDF.
 *
 * Thư viện được nạp từ CDN trong index.html: window.Chart, window.html2pdf.
 */

import { FIELDS, formatVN, formatPct, formatPeriod, buildInsights } from './metrics.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const label = (key) => FIELDS.find((f) => f.key === key)?.label ?? key;

function money(n, cls = '') {
  const neg = Number.isFinite(n) && n < 0;
  return `<span class="num ${neg ? 'neg' : ''} ${cls}">${formatVN(n)}</span>`;
}

function debtBlock(title, total, overdue, inTerm) {
  const pct = Number.isFinite(total) && total > 0 && Number.isFinite(overdue) ? Math.min(1, overdue / total) : 0;
  return `
    <div class="r-card">
      <h3>${title}</h3>
      <div class="r-big">${money(total)} <small>triệu đồng</small></div>
      <div class="r-split">
        <div><span class="r-muted">Quá hạn</span><br>${money(overdue, 'warn')}</div>
        <div class="right"><span class="r-muted">Trong hạn</span><br>${money(inTerm)}</div>
      </div>
      <div class="r-bar"><span style="width:${(pct * 100).toFixed(1)}%"></span></div>
      <div class="r-muted small">Quá hạn chiếm ${formatPct(pct)}</div>
    </div>`;
}

/** Tên file PDF: BaoCao_TaiChinh_T11_2026.pdf */
export function pdfFilename(report) {
  const p = report.period;
  if (p?.month && p?.year) return `BaoCao_TaiChinh_T${p.month}_${p.year}.pdf`;
  const d = new Date();
  return `BaoCao_TaiChinh_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.pdf`;
}

/**
 * Vẽ báo cáo vào phần tử `el`.
 * @param {HTMLElement} el
 * @param {object} report
 * @param {{company?:string, today?:string}} meta
 */
export function renderReport(el, report, meta = {}) {
  const v = report.values;
  const company = meta.company || report.company || 'Công ty';
  const period = formatPeriod(report.period);
  const insights = buildInsights(report);
  const finRows = ['tong_tien', 'tien_mat', 'tien_gui', 'phai_thu', 'phai_tra'];
  const bizRows = ['doanh_thu', 'chi_phi', 'loi_nhuan', 'ton_kho'];
  const inv = [...(report.inventory || [])].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);

  el.innerHTML = `
    <header class="r-head">
      <div>
        <div class="r-kicker">BÁO CÁO TÀI CHÍNH ${esc(period.toUpperCase())}</div>
        <h1>${esc(company)}</h1>
      </div>
      <div class="r-date">Ngày lập: ${esc(meta.today || '')}<br>ĐVT: triệu đồng</div>
    </header>

    <section class="r-kpis">
      <div class="r-kpi"><span>Doanh thu tháng</span>${money(v.doanh_thu)}</div>
      <div class="r-kpi"><span>Chi phí tháng</span>${money(v.chi_phi)}</div>
      <div class="r-kpi"><span>Lợi nhuận tháng</span>${money(v.loi_nhuan, 'good')}</div>
      <div class="r-kpi"><span>Tổng tiền</span>${money(v.tong_tien)}</div>
    </section>

    <section class="r-grid2">
      <div class="r-card">
        <h3>Tình hình tài chính</h3>
        <table class="r-table">
          ${finRows.map((k) => `<tr><td class="${k.startsWith('tien_') ? 'indent' : ''}">${label(k)}</td><td>${money(v[k])}</td></tr>`).join('')}
        </table>
      </div>
      <div class="r-card">
        <h3>Kết quả kinh doanh tháng</h3>
        <table class="r-table">
          ${bizRows.map((k) => `<tr><td>${label(k).replace(' (tháng)', '')}</td><td>${money(v[k])}</td></tr>`).join('')}
          <tr><td>Biên lợi nhuận</td><td><span class="num">${formatPct(Number.isFinite(v.loi_nhuan) && v.doanh_thu ? v.loi_nhuan / v.doanh_thu : null)}</span></td></tr>
        </table>
      </div>
    </section>

    <section class="r-card">
      <div class="r-row">
        <h3>Doanh thu, chi phí, lợi nhuận năm ${esc(report.period?.year ?? '')}</h3>
        <div class="r-ytd">
          <span>Doanh thu <b class="c-dt">${formatVN(v.dt_nam)}</b></span>
          <span>Chi phí <b class="c-cp">${formatVN(v.cp_nam)}</b></span>
          <span>Lợi nhuận <b class="c-ln">${formatVN(v.ln_nam)}</b></span>
        </div>
      </div>
      ${report.monthly?.length ? '<div class="r-chart"><canvas width="720" height="210"></canvas></div>' : '<p class="r-muted">Chưa có bảng số liệu theo tháng.</p>'}
    </section>

    <section class="r-grid2">
      ${debtBlock('Nợ phải thu theo hạn nợ', v.npt_tong, v.npt_qua_han, v.npt_trong_han)}
      ${debtBlock('Nợ phải trả theo hạn nợ', v.nptr_tong, v.nptr_qua_han, v.nptr_trong_han)}
    </section>

    <section class="r-grid2">
      <div class="r-card">
        <h3>Hàng tồn kho – ${money(v.ton_kho)} <small>triệu đồng</small></h3>
        ${inv.length ? `
        <table class="r-table">
          <tr class="th"><td>Mặt hàng (giá trị lớn nhất)</td><td>Số lượng</td><td>Giá trị</td></tr>
          ${inv.map((i) => `<tr><td>${esc(i.name)}</td><td><span class="num">${formatVN(i.qty, 0)}</span></td><td><span class="num">${formatVN(i.value, 2)}</span></td></tr>`).join('')}
        </table>` : '<p class="r-muted">Chưa có chi tiết tồn kho.</p>'}
      </div>
      <div class="r-card">
        <h3>Nhận xét nhanh</h3>
        ${insights.length ? `<ul class="r-list">${insights.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="r-muted">Không có điểm bất thường.</p>'}
      </div>
    </section>

    <footer class="r-foot">Báo cáo được lập tự động từ số liệu xuất từ phần mềm kế toán.</footer>
  `;

  const canvas = el.querySelector('canvas');
  if (canvas && window.Chart) drawChart(canvas, report.monthly);
}

let chart = null;

function drawChart(canvas, monthly) {
  if (chart) chart.destroy();
  const months = [...monthly].sort((a, b) => a.month - b.month);
  chart = new window.Chart(canvas, {
    data: {
      labels: months.map((m) => `Th ${m.month}`),
      datasets: [
        { type: 'line', label: 'Lợi nhuận', data: months.map((m) => m.ln), borderColor: '#f97316', backgroundColor: '#f97316', pointRadius: 3, borderWidth: 2, tension: 0.25, order: 0 },
        { type: 'bar', label: 'Doanh thu', data: months.map((m) => m.dt), backgroundColor: '#22a06b', borderRadius: 3, order: 1 },
        { type: 'bar', label: 'Chi phí', data: months.map((m) => m.cp), backgroundColor: '#d9577a', borderRadius: 3, order: 1 },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      devicePixelRatio: 2,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { ticks: { font: { size: 11 }, callback: (val) => formatVN(val) }, grid: { color: '#eef0f4' } },
      },
    },
  });
}

/**
 * Xuất phần tử báo cáo thành PDF (Blob).
 * @param {HTMLElement} el
 */
export async function exportPdf(el, filename) {
  if (!window.html2pdf) throw new Error('Chưa tải được thư viện tạo PDF (kiểm tra kết nối mạng).');
  return window
    .html2pdf()
    .set({
      margin: [6, 6, 6, 6],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] },
    })
    .from(el)
    .outputPdf('blob');
}
