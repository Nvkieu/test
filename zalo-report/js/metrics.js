/**
 * Mô hình dữ liệu báo cáo + đọc/định dạng số kiểu Việt Nam.
 * Không phụ thuộc trình duyệt — chạy được cả trên Node (scripts/check.mjs).
 */

/** Các chỉ số đơn lẻ, bám theo dashboard "Tổng quan" của phần mềm kế toán. */
export const FIELDS = [
  // Tình hình tài chính (tháng này)
  { key: 'tong_tien', group: 'Tình hình tài chính', label: 'Tổng tiền', aliases: ['tong tien'] },
  { key: 'tien_mat', group: 'Tình hình tài chính', label: 'Tiền mặt', aliases: ['tien mat'] },
  { key: 'tien_gui', group: 'Tình hình tài chính', label: 'Tiền gửi', aliases: ['tien gui', 'tien gui ngan hang'] },
  { key: 'phai_thu', group: 'Tình hình tài chính', label: 'Phải thu', aliases: ['phai thu'] },
  { key: 'phai_tra', group: 'Tình hình tài chính', label: 'Phải trả', aliases: ['phai tra'] },
  { key: 'doanh_thu', group: 'Tình hình tài chính', label: 'Doanh thu (tháng)', aliases: ['doanh thu', 'doanh thu thang', 'doanh thu thang nay'] },
  { key: 'chi_phi', group: 'Tình hình tài chính', label: 'Chi phí (tháng)', aliases: ['chi phi', 'chi phi thang', 'chi phi thang nay'] },
  { key: 'loi_nhuan', group: 'Tình hình tài chính', label: 'Lợi nhuận (tháng)', aliases: ['loi nhuan', 'loi nhuan thang', 'loi nhuan thang nay'] },
  { key: 'ton_kho', group: 'Tình hình tài chính', label: 'Hàng tồn kho', aliases: ['hang ton kho', 'ton kho', 'tong cong ton kho', 'gia tri ton kho'] },

  // Luỹ kế năm
  { key: 'dt_nam', group: 'Luỹ kế năm', label: 'Doanh thu năm', aliases: ['doanh thu nam', 'doanh thu nam nay', 'doanh thu luy ke', 'tong doanh thu nam'] },
  { key: 'cp_nam', group: 'Luỹ kế năm', label: 'Chi phí năm', aliases: ['chi phi nam', 'chi phi nam nay', 'chi phi luy ke', 'tong chi phi nam'] },
  { key: 'ln_nam', group: 'Luỹ kế năm', label: 'Lợi nhuận năm', aliases: ['loi nhuan nam', 'loi nhuan nam nay', 'loi nhuan luy ke', 'tong loi nhuan nam'] },

  // Công nợ theo hạn nợ
  { key: 'npt_tong', group: 'Nợ phải thu theo hạn nợ', label: 'Nợ phải thu – Tổng', aliases: ['no phai thu', 'no phai thu tong', 'tong no phai thu'] },
  { key: 'npt_qua_han', group: 'Nợ phải thu theo hạn nợ', label: 'Nợ phải thu – Quá hạn', aliases: ['no phai thu qua han'] },
  { key: 'npt_trong_han', group: 'Nợ phải thu theo hạn nợ', label: 'Nợ phải thu – Trong hạn', aliases: ['no phai thu trong han'] },
  { key: 'nptr_tong', group: 'Nợ phải trả theo hạn nợ', label: 'Nợ phải trả – Tổng', aliases: ['no phai tra', 'no phai tra tong', 'tong no phai tra'] },
  { key: 'nptr_qua_han', group: 'Nợ phải trả theo hạn nợ', label: 'Nợ phải trả – Quá hạn', aliases: ['no phai tra qua han'] },
  { key: 'nptr_trong_han', group: 'Nợ phải trả theo hạn nợ', label: 'Nợ phải trả – Trong hạn', aliases: ['no phai tra trong han'] },
];

export const FIELD_KEYS = FIELDS.map((f) => f.key);

/** Báo cáo rỗng. */
export function emptyReport() {
  const r = { values: {}, monthly: [], inventory: [], period: null, company: '' };
  for (const k of FIELD_KEYS) r.values[k] = null;
  return r;
}

/** Bỏ dấu, thường hoá, bỏ ký tự thừa: "Nợ phải thu – Quá hạn:" → "no phai thu qua han". */
export function normalizeLabel(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Đọc số theo kiểu Việt Nam.
 *   1.603 → 1603 · (28.311) → -28311 · 1.659.498.280,000 → 1659498280 · 217,34 → 217.34
 * Trả về null nếu không phải số.
 */
export function parseVN(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  let s = String(input).trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\s|đ|vnd|vnđ|₫/gi, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // Dấu nào đứng sau cùng là dấu thập phân.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot) {
    // "1.603" và "131.581" là phần nghìn; "12.5" là thập phân.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  } else if (hasComma) {
    // Kiểu VN: dấu phẩy là thập phân, trừ khi có từ hai nhóm nghìn trở lên.
    if (/^\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Định dạng số như dashboard: 1.603 · (28.311) · 217,34
 * @param {number|null} n
 * @param {number} decimals
 */
export function formatVN(n, decimals = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const body = decPart ? `${grouped},${decPart}` : grouped;
  // Làm tròn về 0 thì không hiện dấu âm.
  return n < 0 && Number(fixed) !== 0 ? `(${body})` : body;
}

/** Phần trăm kiểu VN: 27,6% */
export function formatPct(ratio, decimals = 1) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(decimals).replace('.', ',')}%`;
}

/** Chia an toàn. */
function ratio(a, b) {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

/**
 * Điền các giá trị có thể suy ra từ dữ liệu khác (không ghi đè giá trị đã có).
 * Ví dụ: tổng tiền = tiền mặt + tiền gửi; luỹ kế năm = tổng bảng theo tháng.
 */
export function fillDerived(report) {
  const v = report.values;
  const has = (k) => v[k] !== null && v[k] !== undefined && Number.isFinite(v[k]);
  const setIf = (k, val) => {
    if (!has(k) && val !== null && Number.isFinite(val)) v[k] = val;
  };

  if (has('tien_mat') && has('tien_gui')) setIf('tong_tien', v.tien_mat + v.tien_gui);
  if (has('doanh_thu') && has('chi_phi')) setIf('loi_nhuan', v.doanh_thu - v.chi_phi);
  if (has('npt_qua_han') && has('npt_trong_han')) setIf('npt_tong', v.npt_qua_han + v.npt_trong_han);
  if (has('nptr_qua_han') && has('nptr_trong_han')) setIf('nptr_tong', v.nptr_qua_han + v.nptr_trong_han);

  const months = report.monthly || [];
  if (months.length) {
    const sum = (f) => months.reduce((s, m) => s + (Number.isFinite(m[f]) ? m[f] : 0), 0);
    setIf('dt_nam', sum('dt'));
    setIf('cp_nam', sum('cp'));
    setIf('ln_nam', sum('ln'));

    // Số của tháng báo cáo lấy từ bảng theo tháng nếu ô đơn lẻ còn trống.
    const m = report.period?.month;
    const row = m ? months.find((r) => r.month === m) : null;
    if (row) {
      setIf('doanh_thu', row.dt);
      setIf('chi_phi', row.cp);
      setIf('loi_nhuan', row.ln);
    }
  }

  if (report.inventory?.length) setIf('ton_kho', report.inventory.reduce((s, i) => s + (i.value || 0), 0));
  return report;
}

/**
 * Nhận xét tự động từ số liệu — mỗi phần tử là một dòng ngắn.
 * @returns {string[]}
 */
export function buildInsights(report) {
  const v = report.values;
  const out = [];

  const margin = ratio(v.loi_nhuan, v.doanh_thu);
  if (v.loi_nhuan !== null && v.loi_nhuan < 0) {
    out.push(`⚠️ Tháng này lỗ ${formatVN(-v.loi_nhuan)} tr.`);
  } else if (margin !== null) {
    out.push(`✅ Biên lợi nhuận tháng: ${formatPct(margin)}.`);
  }

  // So với tháng trước (nếu có bảng theo tháng và biết kỳ báo cáo).
  const m = report.period?.month;
  const months = report.monthly || [];
  const cur = m ? months.find((r) => r.month === m) : null;
  const prev = m ? months.find((r) => r.month === m - 1) : null;
  if (cur && prev && Number.isFinite(cur.ln) && Number.isFinite(prev.ln) && prev.ln > 0) {
    const change = (cur.ln - prev.ln) / prev.ln;
    const word = change >= 0 ? 'tăng' : 'giảm';
    out.push(`${change >= 0 ? '📈' : '📉'} Lợi nhuận ${word} ${formatPct(Math.abs(change))} so với tháng trước.`);
  }

  if (v.tong_tien !== null && v.tong_tien < 0) {
    out.push(`⚠️ Tổng tiền đang âm ${formatVN(v.tong_tien)} tr – cần cân đối dòng tiền.`);
  }

  const overdue = ratio(v.npt_qua_han, v.npt_tong);
  if (overdue !== null && overdue > 0.2) {
    out.push(`⚠️ Nợ phải thu quá hạn chiếm ${formatPct(overdue)} (${formatVN(v.npt_qua_han)} tr) – cần đôn đốc thu hồi.`);
  }

  if (v.nptr_qua_han !== null && v.nptr_qua_han > 0) {
    out.push(`⚠️ Có ${formatVN(v.nptr_qua_han)} tr nợ phải trả đã quá hạn.`);
  }

  return out;
}

/** "Tháng 11/2026" */
export function formatPeriod(period) {
  if (!period?.month || !period?.year) return '';
  return `tháng ${period.month}/${period.year}`;
}

/**
 * Biến cho template tin nhắn. Số tiền được định dạng sẵn kiểu VN.
 * @param {object} report
 * @param {{bossTitle?:string, guideUrl?:string, company?:string}} extra
 */
export function templateVars(report, extra = {}) {
  const v = report.values;
  const vars = {};
  for (const k of FIELD_KEYS) vars[k] = formatVN(v[k]);

  vars.bien_loi_nhuan = formatPct(ratio(v.loi_nhuan, v.doanh_thu));
  vars.ty_le_no_qua_han = formatPct(ratio(v.npt_qua_han, v.npt_tong));
  vars.ky_bao_cao = formatPeriod(report.period);
  vars.ten_cong_ty = extra.company || report.company || '';
  vars.xung_ho = extra.bossTitle || 'anh/chị';
  vars.link_huong_dan = extra.guideUrl || '';
  vars.ngay_gui = extra.today || '';
  vars.nhan_xet = buildInsights(report).join('\n');
  return vars;
}
