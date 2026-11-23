/**
 * Dữ liệu mẫu (lấy theo dashboard demo) — dùng cho nút "Dùng dữ liệu mẫu",
 * để sinh file Excel mẫu, và để kiểm thử. Đơn vị: triệu đồng.
 *
 * Bố cục file mẫu cũng là bố cục gợi ý nếu file xuất từ phần mềm kế toán
 * không tự nhận diện được: 3 sheet, nhãn ở cột A, số ở cột B.
 */

export const SAMPLE_SHEETS = [
  {
    name: 'TongQuan',
    rows: [
      ['BÁO CÁO TÌNH HÌNH TÀI CHÍNH', null],
      ['Công ty', 'Công ty TNHH Vật liệu xây dựng'],
      ['Kỳ báo cáo', 'Tháng 11/2026'],
      ['Đơn vị tính', 'Triệu đồng'],
      [],
      ['Tình hình tài chính', null],
      ['Tổng tiền', '(28.311)'],
      ['Tiền mặt', 1603],
      ['Tiền gửi', -29914],
      ['Phải thu', 269927],
      ['Phải trả', 12958],
      ['Doanh thu (tháng này)', 14814],
      ['Chi phí (tháng này)', 6270],
      ['Lợi nhuận (tháng này)', 8544],
      ['Hàng tồn kho', 131581],
      [],
      ['Luỹ kế năm', null],
      ['Doanh thu năm nay', 71764],
      ['Chi phí năm nay', 44897],
      ['Lợi nhuận năm nay', 26867],
      [],
      ['Nợ phải thu theo hạn nợ', null],
      ['Tổng', 10417],
      ['Quá hạn', 2875],
      ['Trong hạn', 7542],
      [],
      ['Nợ phải trả theo hạn nợ', null],
      ['Tổng', 542],
      ['Quá hạn', 0],
      ['Trong hạn', 542],
    ],
  },
  {
    name: 'TheoThang',
    rows: [
      ['Tháng', 'Doanh thu', 'Chi phí', 'Lợi nhuận'],
      ['Th 1', 1200, 1573, -373],
      ['Th 2', 1850, 1770, 80],
      ['Th 3', 900, 1609, -709],
      ['Th 4', 1100, 1659, -559],
      ['Th 5', 1050, 1622, -572],
      ['Th 6', 1300, 1715, -415],
      ['Th 7', 1400, 1728, -328],
      ['Th 8', 1500, 1713, -213],
      ['Th 9', 15900, 7554, 8346],
      ['Th 10', 12300, 7196, 5104],
      ['Th 11', 14814, 6270, 8544],
      ['Th 12', 18450, 10486, 7964],
    ],
  },
  {
    name: 'TonKho',
    rows: [
      ['Tên', 'Số lượng', 'Giá trị'],
      ['Ống gen', 271652, 217.34],
      ['Tấm cemboard', 204332, 3677.98],
      ['Ống PPR', 101713, 7119.91],
      ['Ống thép', 101617, 12194.04],
      ['Gỗ xây dựng', 101499, 1218.11],
    ],
  },
];
