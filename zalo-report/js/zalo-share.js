/**
 * Gửi báo cáo qua Zalo cá nhân — bán tự động.
 *
 * Zalo cá nhân không có API gửi tin chính thức, nên công cụ không tự bấm "Gửi".
 * Thay vào đó:
 *  - Điện thoại: một lần chia sẻ gồm file PDF + tin nhắn
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

/** Điện thoại có bảng chia sẻ của hệ điều hành (chọn được Zalo) không? */
export function canSharePhone() {
  return isMobile() && typeof navigator.share === 'function';
}

/**
 * Điện thoại: một lần chia sẻ gồm cả file PDF và tin nhắn
 * → chọn Zalo → chọn sếp → Gửi.
 * Máy không chia sẻ được file thì chia sẻ riêng tin nhắn và tải PDF về.
 * @returns {Promise<'shared'|'cancelled'|'text-only'|'failed'>}
 */
export async function shareReport({ pdfBlob, filename, text }) {
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });
  const withFile = canShareFile(file);
  try {
    await navigator.share(withFile ? { files: [file], text, title: filename } : { text });
    if (!withFile) downloadBlob(pdfBlob, filename);
    return withFile ? 'shared' : 'text-only';
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
