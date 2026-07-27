/**
 * Web Speech API: đọc (speechSynthesis) và thu âm (SpeechRecognition).
 *
 * TTS chạy trên hầu hết trình duyệt hiện đại.
 * STT chỉ có trên Chrome/Edge (desktop & Android) và một phần Safari — nơi nào
 * không hỗ trợ thì `sttSupported()` trả về false và UI tự ẩn nút thu âm.
 */

import { getSettings } from './storage.js';

const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

/* ---------- TTS ---------- */

let voices = [];

export function ttsSupported() { return !!synth; }

/** Danh sách giọng tiếng Anh khả dụng. Có thể rỗng ở lần gọi đầu (Chrome nạp async). */
export function getEnglishVoices() {
  return voices.filter((v) => /^en[-_]/i.test(v.lang));
}

export function loadVoices() {
  if (!synth) return Promise.resolve([]);
  return new Promise((resolve) => {
    const grab = () => {
      voices = synth.getVoices() || [];
      if (voices.length) resolve(getEnglishVoices());
    };
    grab();
    if (!voices.length) {
      synth.addEventListener('voiceschanged', grab, { once: true });
      // Một số trình duyệt không bao giờ bắn voiceschanged — đừng treo mãi.
      setTimeout(() => resolve(getEnglishVoices()), 1200);
    }
  });
}

function pickVoice(preferURI) {
  const en = getEnglishVoices();
  if (!en.length) return null;
  if (preferURI) {
    const found = en.find((v) => v.voiceURI === preferURI);
    if (found) return found;
  }
  // Ưu tiên en-US, rồi en-GB, rồi bất kỳ giọng tiếng Anh nào.
  return en.find((v) => /^en[-_]US/i.test(v.lang))
      || en.find((v) => /^en[-_]GB/i.test(v.lang))
      || en[0];
}

/** Giọng thứ hai cho speaker B trong hội thoại (nếu có). */
function pickAltVoice(primary) {
  const en = getEnglishVoices();
  const other = en.find((v) => v !== primary && v.lang === primary?.lang) || en.find((v) => v !== primary);
  return other || primary;
}

export function stopSpeaking() {
  if (synth) synth.cancel();
}

/**
 * Đọc một đoạn text. Trả về Promise resolve khi đọc xong (hoặc bị huỷ).
 * `opts.alt = true` dùng giọng phụ (speaker B).
 */
export function speak(text, opts = {}) {
  if (!synth || !text) return Promise.resolve();
  stopSpeaking();
  const settings = getSettings();
  const primary = pickVoice(settings.voiceURI);
  const voice = opts.alt ? pickAltVoice(primary) : primary;

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = opts.rate ?? settings.rate ?? 0.9;
    u.pitch = opts.alt ? 1.15 : 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    // Chrome đôi khi "quên" bắn onend với câu dài — chốt chặn theo độ dài text.
    setTimeout(resolve, 1500 + text.length * 90);
  });
}

/** Đọc lần lượt nhiều dòng hội thoại, đổi giọng theo speaker. */
export async function speakLines(lines, opts = {}) {
  for (const line of lines) {
    if (opts.signal?.aborted) return;
    await speak(line.text, { ...opts, alt: line.speaker === 'B' });
    await new Promise((r) => setTimeout(r, 220));
  }
}

/* ---------- STT ---------- */

export function sttSupported() {
  return !!SR;
}

let activeRecognition = null;

/**
 * Thu âm một lượt và trả transcript.
 * Resolve: { transcript, confidence }.
 * Reject: Error có `.code` ('not-supported' | 'no-speech' | 'not-allowed' | ...).
 */
export function listen({ lang = 'en-US', timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!SR) {
      const e = new Error('Trình duyệt này không hỗ trợ thu âm.');
      e.code = 'not-supported';
      return reject(e);
    }
    stopListening();

    const rec = new SR();
    activeRecognition = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      activeRecognition = null;
      fn(arg);
    };

    const timer = setTimeout(() => {
      try { rec.stop(); } catch { /* ignore */ }
      const e = new Error('Hết thời gian chờ — không nghe thấy giọng nói.');
      e.code = 'timeout';
      finish(reject, e);
    }, timeoutMs);

    rec.onresult = (ev) => {
      const res = ev.results[0]?.[0];
      finish(resolve, {
        transcript: (res?.transcript || '').trim(),
        confidence: res?.confidence ?? 0,
      });
    };
    rec.onerror = (ev) => {
      const e = new Error(errorMessage(ev.error));
      e.code = ev.error;
      finish(reject, e);
    };
    rec.onend = () => {
      const e = new Error('Không nhận được giọng nói. Bạn thử đọc to hơn nhé.');
      e.code = 'no-speech';
      finish(reject, e);
    };

    try {
      rec.start();
    } catch (err) {
      finish(reject, err);
    }
  });
}

export function stopListening() {
  if (activeRecognition) {
    try { activeRecognition.abort(); } catch { /* ignore */ }
    activeRecognition = null;
  }
}

function errorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Trình duyệt chưa được cấp quyền dùng micro. Hãy bật quyền micro cho trang này rồi thử lại.';
    case 'no-speech':
      return 'Không nghe thấy gì cả. Bạn thử đọc to và rõ hơn nhé.';
    case 'audio-capture':
      return 'Không tìm thấy micro. Kiểm tra lại thiết bị thu âm.';
    case 'network':
      return 'Lỗi mạng khi nhận dạng giọng nói. Kiểm tra kết nối Internet.';
    case 'aborted':
      return 'Đã dừng thu âm.';
    default:
      return `Lỗi thu âm: ${code}`;
  }
}
