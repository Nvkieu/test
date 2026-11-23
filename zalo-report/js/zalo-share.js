/**
 * Gửi báo cáo qua Zalo cá nhân — bán tự động.
 *
 * Zalo cá nhân không có API gửi tin chính thức, nên công cụ không tự bấm "Gửi".
 * Thay vào đó:
 *  - Điện thoại: 2 lần chia sẻ — ① chỉ chữ (Zalo điền sẵn tin nhắn),
 *    ② chỉ file PDF. Mỗi lần: chọn Zalo → chọn sếp → Gửi.
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

/** Điện thoại có bảng chia sẻ của hệ điều hành (chọn được Zalo) không? */
export function canSharePhone() {
  return isMobile() && typeof navigator.share === 'function';
}

/**
 * Chia sẻ CHỈ chữ sang app khác. Zalo nhận chữ này làm nội dung tin nhắn,
 * nên tin được điền sẵn sau khi chọn người nhận.
 * @returns {Promise<'shared'|'cancelled'|'failed'>}
 */
export async function shareText(text) {
  try {
    await navigator.share({ text });
    return 'shared';
  } catch (err) {
    return err?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/**
 * Chia sẻ CHỈ file PDF. Không gửi kèm chữ vì một số bản Zalo bỏ mất chữ
 * khi nhận chung với file — chữ đã được gửi ở bước riêng.
 * @returns {Promise<'shared'|'cancelled'|'unsupported'|'failed'>}
 */
export async function shareFile(blob, filename) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (!canShareFile(file)) return 'unsupported';
  try {
    await navigator.share({ files: [file], title: filename });
    return 'shared';
  } catch (err) {
    return err?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/**
 * Máy tính: Zalo PC/Web không cho trang web điền sẵn tin, nên chép tin vào
 * clipboard, tải PDF về và mở khung chat của sếp.
 * @param {{ pdfBlob: Blob, filename: string, text: string, phone: string }} p
 */
export async function sendDesktop({ pdfBlob, filename, text, phone }) {
  const copied = await copyText(text);
  downloadBlob(pdfBlob, filename);
  window.open(zaloChatUrl(phone), '_blank', 'noopener');
  return copied;
}
