/**
 * Sinh nhận xét ngắn (2–3 câu) tiếng Việt sau mỗi bài.
 * Mặc định dùng mẫu theo dải điểm; nếu có API key thì nhờ Claude viết lại
 * cho tự nhiên hơn — nhưng không bao giờ chặn luồng học.
 */

import { getPriorAverage } from './storage.js';
import { generateFeedback as aiFeedback, hasApiKey } from './ai.js';

const BANDS = [
  { min: 90, praise: [
      'Xuất sắc! Bạn gần như không mắc lỗi nào ở bài này.',
      'Tuyệt vời — bài này bạn làm rất chắc tay.',
      'Rất tốt! Bạn đã nắm vững phần này rồi.',
    ] },
  { min: 70, praise: [
      'Khá tốt! Bạn nắm được phần lớn nội dung bài này.',
      'Bài này bạn làm ổn, nền tảng đã vững.',
      'Tốt lắm — bạn chỉ còn vướng ở một vài chỗ nhỏ.',
    ] },
  { min: 50, praise: [
      'Bạn đã đi được nửa chặng đường, cố thêm chút nữa nhé.',
      'Kết quả ở mức trung bình — có nền rồi, cần luyện thêm.',
      'Bạn làm được kha khá, nhưng vẫn còn chỗ để cải thiện.',
    ] },
  { min: 0, praise: [
      'Bài này còn hơi khó với bạn, nhưng đừng nản nhé.',
      'Kết quả chưa như ý — chuyện bình thường khi mới bắt đầu.',
      'Bài này cần luyện thêm, cứ từ từ rồi sẽ quen.',
    ] },
];

function bandFor(score) {
  return BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function trendSentence(score, prior) {
  if (prior === null) return '';
  const diff = score - prior;
  if (diff >= 10) return ` Bạn tiến bộ rõ so với trung bình mấy hôm trước (${prior}/100).`;
  if (diff <= -10) return ` Hôm nay thấp hơn trung bình mấy hôm trước (${prior}/100) một chút, có thể do bài khó hơn.`;
  return ` Kết quả này khá đều so với mấy hôm trước (${prior}/100).`;
}

function listUp(items, max = 3) {
  const uniq = [...new Set(items)].slice(0, max);
  return uniq.map((w) => `“${w}”`).join(', ');
}

/**
 * Nhận xét theo mẫu — luôn có sẵn, không cần mạng.
 * @param {'ex1'|'ex2'|'ex3'} ex
 * @param {number} score 0–100
 * @param {object} detail thông tin riêng của từng bài
 * @param {string} today YYYY-MM-DD
 */
export function templateFeedback(ex, score, detail = {}, today) {
  const band = bandFor(score);
  const prior = today ? getPriorAverage(today) : null;
  const seed = Math.round(score) + (detail.weakWords?.length || 0);
  const parts = [pick(band.praise, seed)];

  if (ex === 'ex1') {
    const { known = 0, total = 10, wrongWords = [] } = detail;
    if (known >= total * 0.7) {
      parts.push(`Bạn đánh dấu đã nhớ ${known}/${total} từ — những từ này sẽ không hiện lại nữa.`);
    } else if (known > 0) {
      parts.push(`Bạn nhớ được ${known}/${total} từ; số còn lại sẽ quay lại trong các ngày tới để bạn ôn.`);
    } else {
      parts.push('Bạn chưa đánh dấu từ nào là đã nhớ — hãy đánh dấu khi thật sự thuộc để hệ thống ưu tiên từ mới.');
    }
    if (wrongWords.length) {
      parts.push(`Cần luyện phát âm thêm: ${listUp(wrongWords)}.`);
    } else {
      parts.push('Ngày mai thử đọc to từng từ theo giọng mẫu để nhớ lâu hơn nhé.');
    }
  }

  if (ex === 'ex2') {
    const { correct = 0, total = 4, usedTranscript = false, replays = 0 } = detail;
    parts.push(`Bạn trả lời đúng ${correct}/${total} câu hỏi.`);
    if (usedTranscript && score >= 70) {
      parts.push('Lần sau thử nghe 2–3 lượt rồi mới mở transcript — kỹ năng nghe sẽ lên nhanh hơn.');
    } else if (usedTranscript) {
      parts.push('Bạn đã dùng transcript, tốt cho việc hiểu bài; hãy nghe lại một lượt nữa khi đã hiểu nội dung.');
    } else if (replays >= 3) {
      parts.push('Bạn nghe lại khá nhiều lượt — thử giảm tốc độ xuống 0.75× để bắt từ dễ hơn.');
    } else {
      parts.push('Bạn nghe hiểu mà không cần transcript, đó là dấu hiệu rất tốt.');
    }
  }

  if (ex === 'ex3') {
    const { weakWords = [], attempted = 0, total = 10, avgNear = 0 } = detail;
    if (attempted < total) {
      parts.push(`Bạn đã đọc ${attempted}/${total} câu — làm hết cả 10 câu sẽ cho kết quả chính xác hơn.`);
    }
    if (weakWords.length) {
      parts.push(`Các từ cần luyện lại: ${listUp(weakWords)}.`);
    } else if (avgNear > 0) {
      parts.push('Một số từ mới ở mức gần đúng — chú ý âm cuối và trọng âm là sẽ đúng hẳn.');
    } else {
      parts.push('Phát âm của bạn rất rõ ràng, giữ nhịp độ này nhé.');
    }
  }

  return (parts.join(' ') + trendSentence(score, prior)).trim();
}

/**
 * Nhận xét cuối cùng: thử Claude trước (nếu có key), lỗi thì rơi về mẫu.
 * Luôn resolve, không bao giờ throw.
 */
export async function buildFeedback(ex, score, detail, today) {
  const fallback = templateFeedback(ex, score, detail, today);
  if (!hasApiKey()) return fallback;
  try {
    const ai = await aiFeedback({ ex, score, detail, prior: getPriorAverage(today) });
    return ai?.trim() || fallback;
  } catch (e) {
    console.warn('Không sinh được nhận xét bằng AI, dùng mẫu:', e.message);
    return fallback;
  }
}
