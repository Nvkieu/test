/**
 * Gửi báo cáo qua Zalo cá nhân — bán tự động.
 *
 * Zalo cá nhân không có API gửi tin chính thức, nên công cụ không tự bấm "Gửi".
 * Thay vào đó:
 *  - Điện thoại: mở bảng chia sẻ của hệ điều hành với file PDF + nội dung tin
 *    → chọn Zalo → chọn sếp → Gửi.
 *  - Máy tính: tải PDF, chép tin nhắn vào clipboard, mở zalo.me/<SĐT sếp>
 *    (Zalo PC/Zalo Web mở đúng khung chat) → Ctrl+V, kéo file PDF vào → Gửi.
 */

export function zaloChatUrl(phone) {
  return phone ? `https://zalo.me/${phone}` : 'https://chat.zalo.me/';
}

export function isMobile() {
  try {
    if (navigator.userAgentData?.mobile) return true;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

/** Trình duyệt này có chia sẻ được file sang app khác (Zalo) không? */
export function canShareFile(file) {
  try {
    return isMobile() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Dự phòng cho trình duyệt cũ / trang không phải https.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {{ pdfBlob: Blob, filename: string, text: string, phone: string }} p
 * @returns {Promise<'shared'|'cancelled'|'desktop'>}
 */
export async function sendToZalo({ pdfBlob, filename, text, phone }) {
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  if (canShareFile(file)) {
    // Chép sẵn tin nhắn: một số app chỉ nhận file khi chia sẻ kèm file.
    await copyText(text);
    try {
      await navigator.share({ files: [file], text, title: filename });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Lỗi khác → rơi xuống cách làm trên máy tính.
    }
  }

  await copyText(text);
  downloadBlob(pdfBlob, filename);
  window.open(zaloChatUrl(phone), '_blank', 'noopener');
  return 'desktop';
}
