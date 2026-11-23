/**
 * Template tin nhắn Zalo: thay {{bien}} bằng số liệu.
 */

export const DEFAULT_TEMPLATE = `Dạ em gửi {{xung_ho}} báo cáo tài chính {{ky_bao_cao}} – {{ten_cong_ty}} (ĐVT: triệu đồng):

💰 Doanh thu: {{doanh_thu}} | Chi phí: {{chi_phi}} | Lợi nhuận: {{loi_nhuan}}
📊 Luỹ kế năm: DT {{dt_nam}} | CP {{cp_nam}} | LN {{ln_nam}}
🏦 Tổng tiền: {{tong_tien}} (Tiền mặt {{tien_mat}} / Tiền gửi {{tien_gui}})
📥 Nợ phải thu: {{npt_tong}}, quá hạn {{npt_qua_han}}
📤 Nợ phải trả: {{nptr_tong}}, quá hạn {{nptr_qua_han}}
📦 Tồn kho: {{ton_kho}}

Nhận xét nhanh:
{{nhan_xet}}

Chi tiết trong file PDF đính kèm.
Hướng dẫn đọc báo cáo: {{link_huong_dan}}
📱 Xem số liệu trực tiếp trên điện thoại (AMIS): {{link_xem_mobile}}`;

/** Danh sách biến có thể dùng, để hiện gợi ý trên giao diện. */
export const VARIABLE_HELP = [
  ['xung_ho', 'Cách gọi sếp (cài đặt)'],
  ['ten_cong_ty', 'Tên công ty'],
  ['ky_bao_cao', 'Kỳ báo cáo, vd "tháng 11/2026"'],
  ['ngay_gui', 'Ngày gửi'],
  ['doanh_thu', 'Doanh thu tháng'],
  ['chi_phi', 'Chi phí tháng'],
  ['loi_nhuan', 'Lợi nhuận tháng'],
  ['bien_loi_nhuan', 'Biên lợi nhuận %'],
  ['dt_nam', 'Doanh thu luỹ kế năm'],
  ['cp_nam', 'Chi phí luỹ kế năm'],
  ['ln_nam', 'Lợi nhuận luỹ kế năm'],
  ['tong_tien', 'Tổng tiền'],
  ['tien_mat', 'Tiền mặt'],
  ['tien_gui', 'Tiền gửi'],
  ['phai_thu', 'Phải thu'],
  ['phai_tra', 'Phải trả'],
  ['npt_tong', 'Nợ phải thu – tổng'],
  ['npt_qua_han', 'Nợ phải thu – quá hạn'],
  ['npt_trong_han', 'Nợ phải thu – trong hạn'],
  ['ty_le_no_qua_han', '% nợ phải thu quá hạn'],
  ['nptr_tong', 'Nợ phải trả – tổng'],
  ['nptr_qua_han', 'Nợ phải trả – quá hạn'],
  ['nptr_trong_han', 'Nợ phải trả – trong hạn'],
  ['ton_kho', 'Hàng tồn kho'],
  ['nhan_xet', 'Nhận xét tự động (nhiều dòng)'],
  ['link_huong_dan', 'Link hướng dẫn'],
  ['link_xem_mobile', 'Link hướng dẫn xem số liệu trên điện thoại (AMIS)'],
];

/**
 * Điền template.
 * @param {string} template
 * @param {Record<string,string>} vars
 * @returns {{ text: string, unknown: string[], empty: string[] }}
 *   unknown: biến không tồn tại (giữ nguyên trong tin); empty: biến chưa có số.
 */
export function renderTemplate(template, vars) {
  const unknown = new Set();
  const empty = new Set();
  let text = String(template).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, name) => {
    const key = name.toLowerCase();
    if (!(key in vars)) {
      unknown.add(name);
      return whole;
    }
    const val = vars[key];
    if (val === '' || val === '—' || val === null || val === undefined) empty.add(key);
    return val ?? '';
  });
  // Dòng trống liên tiếp (do biến rỗng) gộp lại cho gọn.
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return { text, unknown: [...unknown], empty: [...empty] };
}
