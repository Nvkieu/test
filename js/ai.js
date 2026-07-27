/**
 * Tuỳ chọn: gọi Claude API trực tiếp từ trình duyệt để sinh bài mới.
 *
 * ⚠️ App này là web tĩnh, không có backend, nên API key nằm trong localStorage
 * của chính trình duyệt bạn dùng và được gửi thẳng tới api.anthropic.com.
 * Chỉ dùng key cá nhân có giới hạn chi tiêu, không dùng trên máy chung.
 * Header `anthropic-dangerous-direct-browser-access` là bắt buộc để qua CORS.
 */

import { getSettings } from './storage.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5';
const CACHE_PREFIX = 'dela.ai.';

export function hasApiKey() {
  return !!(getSettings().apiKey || '').trim();
}

async function callClaude(body) {
  const key = (getSettings().apiKey || '').trim();
  if (!key) throw new Error('Chưa nhập API key trong Cài đặt.');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, ...body }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || '';
    } catch { /* body không phải JSON */ }
    if (res.status === 401) throw new Error('API key không hợp lệ. Kiểm tra lại trong Cài đặt.');
    if (res.status === 429) throw new Error('Đã chạm giới hạn tốc độ của API, thử lại sau ít phút.');
    throw new Error(`Lỗi API (${res.status})${detail ? ': ' + detail : ''}`);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    throw new Error('Yêu cầu bị từ chối vì lý do an toàn nội dung.');
  }
  const text = (data.content || []).find((b) => b.type === 'text')?.text || '';
  if (!text) throw new Error('API không trả về nội dung.');
  return text;
}

/* ---------- Cache theo ngày ---------- */

function cacheGet(kind, date) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + kind + '.' + date);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheSet(kind, date, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + kind + '.' + date, JSON.stringify(value));
  } catch { /* hết quota — bỏ qua, chỉ mất cache */ }
}

/* ---------- JSON Schema (trùng schema của data/*.json) ---------- */

const WORDS_SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          word: { type: 'string' },
          ipa: { type: 'string' },
          pos: { type: 'string', enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'preposition'] },
          vi: { type: 'string' },
          example: { type: 'string' },
          exampleVi: { type: 'string' },
        },
        required: ['id', 'word', 'ipa', 'pos', 'vi', 'example', 'exampleVi'],
        additionalProperties: false,
      },
    },
  },
  required: ['words'],
  additionalProperties: false,
};

const DIALOGUE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    titleVi: { type: 'string' },
    type: { type: 'string', enum: ['dialogue', 'passage'] },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['A', 'B', 'N'] },
          text: { type: 'string' },
        },
        required: ['speaker', 'text'],
        additionalProperties: false,
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'integer' },
          explainVi: { type: 'string' },
        },
        required: ['q', 'options', 'answer', 'explainVi'],
        additionalProperties: false,
      },
    },
  },
  required: ['id', 'title', 'titleVi', 'type', 'lines', 'questions'],
  additionalProperties: false,
};

const SENTENCES_SCHEMA = {
  type: 'object',
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          vi: { type: 'string' },
          focus: { type: 'string' },
        },
        required: ['id', 'text', 'vi', 'focus'],
        additionalProperties: false,
      },
    },
  },
  required: ['sentences'],
  additionalProperties: false,
};

const LEVEL_NOTE =
  'Trình độ A2+ theo khung CEFR: câu ngắn gọn, thì hiện tại/quá khứ đơn, ' +
  'từ vựng đời thường. Người học là người Việt Nam.';

async function generateJSON({ prompt, schema, maxTokens = 8000 }) {
  const text = await callClaude({
    max_tokens: maxTokens,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema },
    },
    messages: [{ role: 'user', content: prompt }],
  });
  return JSON.parse(text);
}

/* ---------- API công khai ---------- */

/** 10 từ vựng mới. `avoid` = danh sách từ đã có để tránh trùng. */
export async function generateWords(date, avoid = []) {
  const cached = cacheGet('words', date);
  if (cached) return cached;

  const data = await generateJSON({
    prompt:
      `Tạo 10 từ vựng tiếng Anh trình độ A2+ để người Việt học hôm nay.\n${LEVEL_NOTE}\n\n` +
      `Với mỗi từ: id dạng "ai-${date}-1" đến "ai-${date}-10", phiên âm IPA có dấu /.../, ` +
      `loại từ, nghĩa tiếng Việt ngắn gọn, một câu ví dụ tiếng Anh dùng đúng từ đó ` +
      `(tối đa 12 từ) và bản dịch tiếng Việt của câu ví dụ.\n\n` +
      `Chọn từ thông dụng trong sinh hoạt, công việc, du lịch. ` +
      `KHÔNG dùng lại các từ sau: ${avoid.slice(0, 120).join(', ')}.`,
    schema: WORDS_SCHEMA,
  });

  const words = data.words || [];
  cacheSet('words', date, words);
  return words;
}

/** 1 đoạn hội thoại/đoạn văn + câu hỏi. */
export async function generateDialogue(date, avoidTitles = []) {
  const cached = cacheGet('dialogue', date);
  if (cached) return cached;

  const data = await generateJSON({
    prompt:
      `Tạo một bài luyện nghe tiếng Anh trình độ A2+ cho người Việt.\n${LEVEL_NOTE}\n\n` +
      `id = "ai-${date}". Chọn ngẫu nhiên dạng "dialogue" (hội thoại 2 người A và B, ` +
      `8–12 lượt) hoặc "passage" (đoạn văn kể chuyện, speaker luôn là "N", 3–5 câu mỗi dòng, ` +
      `tổng 90–130 từ). title bằng tiếng Anh, titleVi là bản dịch tiếng Việt.\n\n` +
      `Kèm đúng 4 câu hỏi trắc nghiệm, mỗi câu 4 lựa chọn, "answer" là chỉ số ` +
      `(0–3) của đáp án đúng, "explainVi" giải thích ngắn bằng tiếng Việt vì sao đáp án đó đúng. ` +
      `Câu hỏi phải trả lời được chỉ dựa vào nội dung đoạn.\n\n` +
      `Tránh các chủ đề đã có: ${avoidTitles.slice(0, 40).join(', ')}.`,
    schema: DIALOGUE_SCHEMA,
  });

  cacheSet('dialogue', date, data);
  return data;
}

/** 10 câu luyện phát âm. */
export async function generateSentences(date, avoid = []) {
  const cached = cacheGet('sentences', date);
  if (cached) return cached;

  const data = await generateJSON({
    prompt:
      `Tạo 10 câu tiếng Anh trình độ A2+ để người Việt luyện đọc to.\n${LEVEL_NOTE}\n\n` +
      `id dạng "ai-${date}-s1" đến "ai-${date}-s10". Mỗi câu 6–12 từ, dễ đọc thành tiếng, ` +
      `có bản dịch tiếng Việt ("vi") và trường "focus" ghi MỘT từ trong câu chứa âm mà ` +
      `người Việt hay phát âm sai (âm cuối /s/, /z/, /t/, /d/, các âm /θ/, /ð/, /ʃ/, /r/, ` +
      `hoặc phân biệt nguyên âm dài/ngắn).\n\n` +
      `Tránh lặp lại các câu: ${avoid.slice(0, 40).join(' | ')}.`,
    schema: SENTENCES_SCHEMA,
  });

  const sentences = data.sentences || [];
  cacheSet('sentences', date, sentences);
  return sentences;
}

/** Nhận xét 2–3 câu tiếng Việt cho một bài (văn xuôi, không schema). */
export async function generateFeedback({ ex, score, detail, prior }) {
  const label = { ex1: 'từ vựng', ex2: 'nghe hiểu', ex3: 'đọc và phát âm' }[ex] || ex;
  return callClaude({
    max_tokens: 1000,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      'Bạn là giáo viên tiếng Anh bản ngữ đang dạy một học viên người Việt trình độ A2+. ' +
      'Viết nhận xét NGẮN bằng tiếng Việt: đúng 2–3 câu, thân thiện, cụ thể. ' +
      'Câu đầu khen điểm làm tốt, câu sau chỉ ra điểm cần cố gắng kèm gợi ý luyện tập. ' +
      'Không dùng markdown, không xuống dòng, không mở đầu bằng lời chào.',
    messages: [{
      role: 'user',
      content:
        `Bài: ${label}. Điểm: ${score}/100.` +
        (prior !== null && prior !== undefined ? ` Trung bình 7 ngày trước: ${prior}/100.` : '') +
        `\nChi tiết: ${JSON.stringify(detail)}`,
    }],
  });
}
