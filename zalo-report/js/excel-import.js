/**
 * Đọc số liệu từ bảng tính đã xuất ra (Excel/CSV).
 *
 * File này không gọi SheetJS trực tiếp: nó nhận các sheet dưới dạng mảng 2 chiều
 * (kết quả của XLSX.utils.sheet_to_json(ws, { header: 1 })) nên chạy được cả trên
 * Node để kiểm thử.
 *
 * Cách nhận diện:
 *  1. Chỉ số đơn lẻ: tìm ô có nhãn giống dashboard ("Tổng tiền", "Tiền mặt",
 *     "Nợ phải thu – Quá hạn"…) rồi lấy ô không rỗng đầu tiên bên phải.
 *     Nhãn "Quá hạn"/"Trong hạn"/"Tổng" đứng một mình được hiểu theo tiêu đề mục
 *     gần nhất phía trên ("Nợ phải thu theo hạn nợ" / "Nợ phải trả theo hạn nợ").
 *  2. Bảng theo tháng: dòng tiêu đề có "Doanh thu" và "Chi phí"; các dòng dưới
 *     bắt đầu bằng "Th 1", "Tháng 1", "T1" hoặc số 1…12.
 *  3. Bảng tồn kho: dòng tiêu đề có "Số lượng" và "Giá trị".
 */

import { FIELDS, emptyReport, normalizeLabel, parseVN, fillDerived } from './metrics.js';

/** Hệ số đổi về triệu đồng. */
export const UNITS = {
  trieu: { label: 'Triệu đồng', factor: 1 },
  nghin: { label: 'Nghìn đồng', factor: 1e-3 },
  dong: { label: 'Đồng', factor: 1e-6 },
};

const isBlank = (c) => c === null || c === undefined || String(c).trim() === '';

/**
 * Bảng tra nhãn → khoá chỉ số (gồm cả nhãn người dùng tự thêm).
 * @param {Record<string,string[]>} customAliases
 */
export function buildAliasIndex(customAliases = {}) {
  const index = new Map();
  for (const f of FIELDS) {
    const all = [...f.aliases, ...(customAliases[f.key] || [])];
    for (const a of all) {
      const n = normalizeLabel(a);
      if (n && !index.has(n)) index.set(n, f.key);
    }
  }
  return index;
}

/** "Tháng 11/2026", "11/2026", "T11-2026", "Tháng 11 năm 2026" → { month, year } */
export function parsePeriod(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { month: value.getMonth() + 1, year: value.getFullYear() };
  }
  const s = normalizeLabel(value);
  const m = s.match(/(\d{1,2})\D+(\d{4})/);
  if (!m) return null;
  const month = Number(m[1]);
  const year = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

/** "Th 1", "Tháng 01", "T1", 1 → 1; không phải tháng → null */
export function parseMonthCell(cell) {
  if (typeof cell === 'number') return Number.isInteger(cell) && cell >= 1 && cell <= 12 ? cell : null;
  const s = normalizeLabel(cell);
  const m = s.match(/^(?:th|thang|t)?\s*(\d{1,2})(?:\s+\d{4})?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

/** Ô không rỗng đầu tiên bên phải cột c. */
function firstRight(row, c) {
  for (let j = c + 1; j < row.length; j++) {
    if (!isBlank(row[j])) return row[j];
  }
  return undefined;
}

const PERIOD_LABELS = new Set(['ky bao cao', 'ky', 'thang bao cao', 'bao cao thang']);
const COMPANY_LABELS = new Set(['cong ty', 'ten cong ty', 'chi nhanh', 'don vi', 'ten don vi', 'doanh nghiep']);

function findMonthlyTable(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const norm = row.map(normalizeLabel);
    const dt = norm.findIndex((n) => n === 'doanh thu');
    const cp = norm.findIndex((n) => n === 'chi phi');
    if (dt < 0 || cp < 0) continue;
    const ln = norm.findIndex((n) => n === 'loi nhuan');
    const monthCol = Math.max(0, norm.findIndex((n) => /^(thang|ky|thoi gian)$/.test(n)));

    const out = [];
    for (let i = r + 1; i < rows.length; i++) {
      const data = rows[i] || [];
      const month = parseMonthCell(data[monthCol]);
      if (!month) {
        if (out.length) break; // hết bảng ("Tổng cộng" hoặc dòng trống)
        continue;
      }
      const d = parseVN(data[dt]);
      const c = parseVN(data[cp]);
      let l = ln >= 0 ? parseVN(data[ln]) : null;
      if (l === null && d !== null && c !== null) l = d - c;
      out.push({ month, dt: d, cp: c, ln: l });
    }
    if (out.length) return out;
  }
  return [];
}

function findInventoryTable(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const norm = row.map(normalizeLabel);
    const qty = norm.findIndex((n) => n === 'so luong');
    const val = norm.findIndex((n) => n === 'gia tri' || n === 'gia tri ton' || n === 'thanh tien');
    if (qty < 0 || val < 0) continue;
    let name = norm.findIndex((n) => /^(ten|ten hang|mat hang|hang hoa|ten hang hoa|ten vat tu hang hoa|vat tu)$/.test(n));
    if (name < 0) name = Math.max(0, Math.min(qty, val) - 1);

    const out = [];
    for (let i = r + 1; i < rows.length; i++) {
      const data = rows[i] || [];
      if (isBlank(data[name])) break;
      const label = normalizeLabel(data[name]);
      if (label.startsWith('tong')) break;
      out.push({ name: String(data[name]).trim(), qty: parseVN(data[qty]), value: parseVN(data[val]) });
    }
    if (out.length) return out;
  }
  return [];
}

/**
 * @param {{name:string, rows:any[][]}[]} sheets
 * @param {{ customAliases?: Record<string,string[]>, unit?: keyof UNITS }} options
 * @returns {{ report: object, found: string[], derived: string[] }}
 */
export function extractReport(sheets, options = {}) {
  const report = emptyReport();
  const index = buildAliasIndex(options.customAliases);
  const factor = UNITS[options.unit || 'trieu']?.factor ?? 1;
  const found = new Set();

  for (const sheet of sheets) {
    const rows = sheet.rows || [];
    let section = null; // 'npt' | 'nptr'

    for (const row of rows) {
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (typeof cell !== 'string' || !cell.trim()) continue;
        const norm = normalizeLabel(cell);
        const right = firstRight(row, c);
        const num = parseVN(right);

        if (PERIOD_LABELS.has(norm) && right !== undefined && !report.period) {
          report.period = parsePeriod(right);
          continue;
        }
        if (COMPANY_LABELS.has(norm) && typeof right === 'string' && !report.company) {
          report.company = right.trim();
          continue;
        }

        // Tiêu đề mục công nợ — đặt ngữ cảnh cho "Quá hạn"/"Trong hạn" bên dưới.
        if (norm.startsWith('no phai thu') && num === null) section = 'npt';
        else if (norm.startsWith('no phai tra') && num === null) section = 'nptr';

        let key = index.get(norm);
        if (!key && section) {
          if (norm === 'qua han') key = `${section}_qua_han`;
          else if (norm === 'trong han') key = `${section}_trong_han`;
          else if (norm === 'tong' || norm === 'tong cong') key = `${section}_tong`;
        }
        if (!key || num === null || found.has(key)) continue;

        report.values[key] = num * factor;
        found.add(key);
      }
    }

    if (!report.monthly.length) {
      const m = findMonthlyTable(rows);
      if (m.length) {
        report.monthly = m.map((r) => ({
          month: r.month,
          dt: r.dt === null ? null : r.dt * factor,
          cp: r.cp === null ? null : r.cp * factor,
          ln: r.ln === null ? null : r.ln * factor,
        }));
      }
    }
    if (!report.inventory.length) {
      const inv = findInventoryTable(rows);
      if (inv.length) report.inventory = inv.map((i) => ({ ...i, value: i.value === null ? null : i.value * factor }));
    }
  }

  const before = new Set(Object.keys(report.values).filter((k) => report.values[k] !== null));
  fillDerived(report);
  const derived = Object.keys(report.values).filter((k) => report.values[k] !== null && !before.has(k));

  return { report, found: [...found], derived };
}
