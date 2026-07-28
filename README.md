# Học tiếng Anh mỗi ngày 📚

Web app luyện tiếng Anh hàng ngày trình độ **A2+** cho người Việt, gồm 3 bài cố định:
từ vựng, nghe hiểu, đọc & phát âm. Mỗi ngày app tự bốc một bộ bài mới, chấm điểm và
nhận xét ngắn bằng tiếng Việt.

Không cần cài đặt, không cần server, không cần tài khoản.

---

## Chạy thử

Cần một web server nhỏ (mở thẳng bằng `file://` sẽ bị trình duyệt chặn `fetch` dữ liệu):

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

Hoặc dùng Node:

```bash
npx --yes serve .
```

**Nên dùng Chrome hoặc Edge** — hai trình duyệt này hỗ trợ đầy đủ cả đọc (TTS) và
thu âm chấm phát âm (STT). Safari/Firefox vẫn nghe và học bình thường, chỉ thiếu
phần chấm phát âm tự động (app sẽ tự chuyển sang cho bạn tự đánh giá).

Lần đầu bấm 🎤 trình duyệt sẽ hỏi quyền micro — chọn **Cho phép**.

---

## Ba bài mỗi ngày

### Bài 1 · Từ vựng
10 từ A2+ kèm IPA, nghĩa tiếng Việt và câu ví dụ (có bản dịch).
- 🔊 Nghe từ và nghe câu ví dụ
- 🎤 Đọc lại — app chấm đúng / gần đúng / sai
- ✅ **Đánh dấu "đã nhớ"** → từ đó không bao giờ hiện lại nữa
  (xem lại và bỏ đánh dấu trong Cài đặt)

### Bài 2 · Nghe hiểu
Một đoạn hội thoại hoặc đoạn văn ngắn, phát bằng giọng đọc của trình duyệt.
- Chỉnh tốc độ 0.75× / 0.9× / 1×, nghe lại bao nhiêu lần tuỳ ý
- **Transcript ẩn mặc định**, bấm 👁 để mở khi chưa nghe ra
  (mở transcript bị trừ 10% điểm — đây là bài *nghe*)
- 4 câu hỏi trắc nghiệm, chọn xong hiện ngay đúng/sai + giải thích tiếng Việt

### Bài 3 · Đọc & phát âm
10 câu kèm bản dịch tiếng Việt.
- 🔊 Nghe mẫu (có nút 🐢 đọc chậm)
- 🎤 Đọc lại → app tô màu **từng từ**:
  🟩 **xanh lá** = đúng · 🟦 **xanh dương** = gần đúng · 🟥 **đỏ** = sai / thiếu
- Hiển thị lại **đúng những gì máy nghe được** ngay dưới câu gốc để bạn so sánh
- Đọc lại bao nhiêu lần tuỳ thích, hệ thống lấy điểm cao nhất

Kết thúc mỗi bài có nút **Kết thúc & tính điểm** → điểm 0–100 + nhận xét 2–3 câu
(điểm tốt và điểm cần cố gắng). Tab **Tổng kết** gộp cả 3 bài, hiện streak và
biểu đồ 7 ngày gần nhất.

---

## Cách chấm phát âm

App dùng `SpeechRecognition` của trình duyệt để lấy transcript, rồi so với câu gốc:

1. **Chuẩn hoá** — bỏ dấu câu, chữ hoa; `can't` = `cannot`; số `3` = `three`.
2. **Căn chỉnh Needleman–Wunsch** — nhờ vậy khi bạn đọc thiếu hoặc thừa một từ,
   các từ còn lại vẫn được chấm đúng chỗ (không bị lệch dây chuyền).
3. **Chấm từng từ** — kết hợp so sánh chữ cái (Levenshtein) và **khoá ngữ âm** rút gọn
   gộp các âm người Việt hay nhầm (`s/z`, `f/v`, `th/s`, `l/r`, nguyên âm dài/ngắn).
   Nhờ vậy `sheep` vs `ship` ra **gần đúng** chứ không phải sai hoàn toàn.

Điểm câu = (số từ đúng × 1 + số từ gần đúng × 0.5) / tổng số từ, trừ nhẹ nếu đọc thừa.

> ⚠️ Đây là nhận dạng giọng nói của trình duyệt, không phải hệ thống chấm phát âm
> chuyên nghiệp. Kết quả rất hữu ích để tự luyện, nhưng đôi khi máy nghe nhầm —
> đừng quá lo nếu một từ bị chấm sai oan.

---

## Ngân hàng nội dung

| File | Nội dung | Đủ dùng |
|---|---|---|
| `data/words.json` | 300 từ A2+ | 30 ngày |
| `data/dialogues.json` | 30 bài nghe (hội thoại + đoạn văn), mỗi bài 4 câu hỏi | 30 ngày |
| `data/sentences.json` | 150 câu luyện phát âm | 15 ngày |

Bài mỗi ngày được chọn **tất định theo ngày** (cùng ngày mở lại vẫn ra bài đó),
ưu tiên nội dung lâu chưa gặp nhất. Dùng hết ngân hàng thì tự quay vòng đều đặn.
Có nút **🔀 Đổi bài khác** nếu muốn bốc lại trong cùng ngày.

**Thêm nội dung của riêng bạn:** sửa thẳng các file JSON trên (giữ đúng schema),
rồi chạy `node scripts/check.mjs` để kiểm tra trước khi dùng.

---

## Tuỳ chọn: sinh bài mới bằng Claude API

Vào **⚙️ Cài đặt → Claude API** nhập API key, mỗi bài sẽ có thêm nút
**✨ Sinh bài mới bằng AI** — Claude soạn bài hoàn toàn mới theo đúng schema
(dùng structured outputs nên kết quả đổ thẳng vào cùng giao diện).

Kết quả được cache theo ngày để không gọi lại API khi mở lại.

> ⚠️ **Cảnh báo bảo mật.** App này là web tĩnh không có backend, nên API key được
> lưu trong `localStorage` của chính trình duyệt bạn dùng và gửi thẳng tới
> `api.anthropic.com` (qua header `anthropic-dangerous-direct-browser-access`).
> Chỉ dùng key cá nhân có **giới hạn chi tiêu**, và **không nhập trên máy dùng chung**.
> Không nhập key thì app vẫn hoạt động đầy đủ bằng ngân hàng bài có sẵn.

---

## Tiến độ học

Lưu trong `localStorage` của trình duyệt: từ đã nhớ, điểm từng bài, streak, lịch sử ngày.

- **Không đồng bộ giữa các máy.** Dùng **Cài đặt → Xuất/Nhập tiến độ (JSON)** để chuyển.
- Xoá dữ liệu trình duyệt sẽ mất tiến độ — nhớ xuất file backup định kỳ.

---

## Kiểm tra

```bash
node scripts/check.mjs
```

Script này (chạy cả trong CI trước khi deploy) kiểm tra:
- 3 file JSON đúng schema, đủ số lượng, không trùng id, mọi câu hỏi có đáp án hợp lệ
- Logic chấm phát âm: đọc đúng → 100; thiếu từ → đúng từ đó bị đánh dấu, các từ khác
  vẫn xanh (chứng minh alignment hoạt động); `sheep`/`ship` → gần đúng; `cat`/`dog` → sai
- Logic chọn bài: cùng ngày → cùng bài; 30 ngày liên tiếp dùng hết 300 từ không lặp

Muốn xem một ngày cụ thể: mở `?date=2026-08-01`.

---

## Deploy lên GitHub Pages

Đã có sẵn workflow `.github/workflows/pages.yml` (chạy `check.mjs` trước, đạt mới deploy).

### ⚠️ Cần bật Pages bằng tay một lần

Vào repo → **Settings → Pages → Build and deployment → Source = GitHub Actions**.

Bước này **bắt buộc phải làm thủ công**, không tự động hoá được: token mặc định của
GitHub Actions (`GITHUB_TOKEN`) không có quyền *tạo* Pages site lần đầu, kể cả khi
workflow đã khai báo `permissions: pages: write`. Workflow có đặt `enablement: true`
để tự bật nếu token đủ quyền, nhưng với token mặc định nó sẽ báo:

```
Create Pages site failed. Error: Resource not accessible by integration
```

Đó chính là dấu hiệu bạn chưa bật Pages. Bật xong thì push lại (hoặc bấm **Re-run
jobs** ở lần chạy hỏng) là deploy chạy được ngay — `enablement: true` khi đó chỉ
tìm thấy site có sẵn và đi tiếp.

Cách khác nếu muốn hoàn toàn tự động: tạo Personal Access Token có quyền
`administration: write`, lưu thành repository secret rồi truyền vào
`actions/configure-pages` qua tham số `token`. Với repo cá nhân thì bật tay một
lần đơn giản hơn nhiều.

App sẽ chạy tại `https://<user>.github.io/<repo>/`.

> Chưa bật Pages thì job `Deploy` sẽ đỏ ở mỗi lần push, nhưng job kiểm thử
> (`check`) vẫn chạy và vẫn xanh — app dùng local không ảnh hưởng gì.

---

## Cấu trúc mã nguồn

```
index.html              khung app + hộp thoại cài đặt
css/style.css           giao diện, chế độ sáng/tối, màu chấm điểm
js/app.js               điều phối: tải dữ liệu, chọn bài, chuyển tab, tổng kết
js/storage.js           localStorage: từ đã nhớ, điểm, streak, export/import
js/daily.js             RNG tất định theo ngày + thuật toán chọn bài không lặp
js/speech.js            TTS + STT, phát hiện trình duyệt hỗ trợ
js/scoring.js           chuẩn hoá, khoá ngữ âm, Needleman–Wunsch, chấm 3 mức
js/feedback.js          nhận xét theo mẫu (+ AI nếu có key)
js/ai.js                gọi Claude API (structured outputs)
js/ui.js                tiện ích DOM dùng chung
js/ex1-vocab.js         Bài 1
js/ex2-listening.js     Bài 2
js/ex3-pronounce.js     Bài 3
scripts/check.mjs       validate dữ liệu + unit test
```

Không có build step, không có dependency — chỉ HTML/CSS/JS thuần với ES modules.
