/**
 * Đăng ký service worker, xử lý nút "Cài đặt app" và thông báo có bản mới.
 *
 * Lưu ý: service worker chỉ chạy trong "secure context" — tức là HTTPS hoặc
 * localhost. Mở qua http://192.168.x.x (LAN) sẽ KHÔNG cài được app; dùng
 * bản trên GitHub Pages hoặc localhost để cài.
 */

import { el, toast } from './ui.js';

let deferredPrompt = null;
let reloadRequested = false;   // người dùng đã bấm "Tải lại ngay" chưa
let reloading = false;

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canInstall() {
  return !!deferredPrompt;
}

export function isSecureForInstall() {
  return window.isSecureContext;
}

/** Gọi một lần lúc khởi động. `onStateChange` chạy lại UI khi trạng thái đổi. */
export function initPWA(onStateChange = () => {}) {
  // Android/Chrome/Edge bắn sự kiện này khi app đủ điều kiện cài đặt.
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();          // chặn thanh gợi ý mặc định, ta tự hiện nút
    deferredPrompt = ev;
    onStateChange();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toast('Đã cài đặt! Từ giờ bạn mở app từ màn hình chính được rồi.');
    onStateChange();
  });

  registerServiceWorker();
}

/** Mở hộp thoại cài đặt của trình duyệt. Trả về true nếu người dùng đồng ý. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

    // Đã có bản mới đang chờ ngay lúc mở trang.
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // 'installed' + đã có controller = đây là bản cập nhật, không phải lần cài đầu.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBar(installing);
        }
      });
    });

    // Chỉ tải lại khi chính người dùng bấm "Tải lại ngay".
    // `controllerchange` cũng bắn ở lần cài đặt ĐẦU TIÊN (do clients.claim()),
    // nếu tải lại ở đó thì người mở app lần đầu bị giật trang một cách vô cớ.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadRequested || reloading) return;
      reloading = true;
      location.reload();
    });
  } catch (e) {
    console.warn('Không đăng ký được service worker:', e);
  }
}

function showUpdateBar(worker) {
  if (document.getElementById('update-bar')) return;
  const bar = el('div', { class: 'update-bar', id: 'update-bar' },
    el('span', {}, '✨ Đã có phiên bản mới của app.'),
    el('button', {
      class: 'btn small primary',
      onclick: () => {
        reloadRequested = true;
        worker.postMessage('skip-waiting');   // sw gọi skipWaiting → controllerchange → reload
        bar.remove();
      },
    }, 'Tải lại ngay'),
    el('button', { class: 'btn small ghost', onclick: () => bar.remove() }, 'Để sau'),
  );
  document.body.append(bar);
}

/**
 * Hướng dẫn cài đặt phù hợp với thiết bị đang dùng.
 * iOS không có beforeinstallprompt nên bắt buộc phải hướng dẫn thủ công.
 */
export function installHelpText() {
  if (isStandalone()) return null;
  if (isIOS()) {
    return 'Trên iPhone/iPad: bấm nút Chia sẻ ở thanh dưới Safari → cuộn xuống chọn '
         + '“Thêm vào MH chính” (Add to Home Screen).';
  }
  if (!window.isSecureContext) {
    return 'Muốn cài lên máy thì cần mở qua HTTPS (bản trên GitHub Pages) hoặc localhost. '
         + 'Mở bằng địa chỉ IP trong mạng LAN sẽ không cài được.';
  }
  if (deferredPrompt) return null;   // có nút cài rồi, không cần hướng dẫn
  return 'Trên Chrome/Edge máy tính: bấm biểu tượng cài đặt ở cuối thanh địa chỉ. '
       + 'Trên Android: menu ⋮ → “Cài đặt ứng dụng” / “Thêm vào Màn hình chính”.';
}
