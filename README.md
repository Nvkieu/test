# Học tiếng Anh mỗi ngày 📚

Web app luyện tiếng Anh hàng ngày trình độ **A2+** cho người Việt, gồm 3 bài cố định:
từ vựng, nghe hiểu, đọc & phát âm. Mỗi ngày app tự bốc một bộ bài mới, chấm điểm và
nhận xét ngắn bằng tiếng Việt.

Là **PWA**: cài được lên màn hình chính của điện thoại và máy tính, mở như app thật,
và **học được cả khi không có mạng**. Không cần store, không cần tài khoản.

---

## Chạy trên Windows

**Bấm đúp `run-windows.bat`.** Trình duyệt tự mở ra app. Không cần cài Python,
Node hay bất cứ thứ gì — script dùng PowerShell có sẵn trong mọi bản Windows 10/11.

Muốn biến thành app thật trên máy: khi trình duyệt đã mở, bấm biểu tượng cài đặt ở
cuối thanh địa chỉ (Chrome/Edge) → app có icon riêng trong Start Menu, mở toàn màn
hình. **Sau khi cài, không cần chạy lại file .bat nữa** — service worker giữ toàn bộ
app trong máy nên mở từ Start Menu là chạy, kể cả khi không có mạng.

Để dừng: bấm `Ctrl+C` trong cửa sổ đen, hoặc đóng cửa sổ.

<details>
<summary>Chi tiết kỹ thuật & xử lý sự cố</summary>

Script chỉ lắng nghe trên `localhost` (không mở ra mạng LAN) nên Windows Firewall
không hỏi gì. Cổng mặc định 8765; nếu bận thì tự nhảy sang cổng kế tiếp.

- **"Access is denied" khi mở cổng** → chuột phải `run-windows.bat` → *Run as
  administrator*. Hoặc nếu máy có sẵn Python: `python -m http.server 8765 --bind 127.0.0.1`
- **Cửa sổ hiện ra rồi tắt ngay** → mở Command Prompt, `cd` tới thư mục dự án rồi
  gõ `run-windows.bat` để đọc được thông báo lỗi.
- **Windows chặn file tải từ mạng** → chuột phải file `.bat` → Properties → tick
  *Unblock* → OK.
- Đổi cổng: `powershell -ExecutionPolicy Bypass -File scripts\serve.ps1 -Port 9000`

Vì sao phải có máy chủ mà không mở thẳng `index.html`: trình duyệt chặn `fetch` dữ
liệu bài học và không cho đăng ký service worker khi mở bằng `file://`.

</details>

---

## Cài lên thiết bị

Cần mở app qua **HTTPS** (bản trên GitHub Pages) hoặc **localhost** (bao gồm
`run-windows.bat` ở trên). Mở bằng địa chỉ IP trong mạng LAN (`http://192.168.…`)
sẽ không cài được — trình duyệt chỉ cho phép service worker chạy trong
"secure context".

| Thiết bị | Cách cài |
|---|---|
| **Android** (Chrome/Edge) | Mở app → hộp thoại ⚙️ Cài đặt → nút **⬇️ Cài đặt app**. Hoặc menu ⋮ → *Cài đặt ứng dụng*. |
| **iPhone / iPad** (Safari) | Bấm nút **Chia sẻ** ở thanh dưới → cuộn xuống → **Thêm vào MH chính**. iOS không hỗ trợ nút cài tự động. |
| **Windows / macOS / Linux** (Chrome/Edge) | Bấm biểu tượng cài đặt ở cuối thanh địa chỉ, hoặc dùng nút trong ⚙️ Cài đặt. |

Sau khi cài: app có icon riêng, mở toàn màn hình không có thanh địa chỉ, và giữ
nguyên tiến độ. Nhấn giữ icon còn có lối tắt mở thẳng Bài 1 / 2 / 3.

**Dùng trên nhiều thiết bị:** tiến độ (từ đã nhớ, điểm, streak) lưu riêng trên từng
máy, không tự đồng bộ vì app không có server. Muốn chuyển thì vào ⚙️ Cài đặt →
**Xuất tiến độ (JSON)** ở máy cũ, rồi **Nhập tiến độ** ở máy mới.

**Offline:** sau lần mở đầu tiên, toàn bộ app và ngân hàng bài học được lưu vào máy,
nên vào máy bay hay mất mạng vẫn học bình thường. Giọng đọc (TTS) hầu hết máy vẫn
chạy offline; riêng phần **thu âm chấm phát âm cần mạng** vì Chrome gửi giọng nói
lên máy chủ để nhận dạng.

Khi có bản mới, app hiện thanh **"Đã có phiên bản mới"** ở dưới màn hình — bấm
*Tải lại ngay* là xong.

---

## Chạy thử (macOS / Linux)

Cần một web server nhỏ (mở thẳng bằng `file://` sẽ bị trình duyệt chặn `fetch` dữ liệu):

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

Hoặc dùng Node:

```bash
npx --yes serve .
```

Trên Windows thì bấm đúp `run-windows.bat` (xem mục ở trên).

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

## Công cụ gửi báo cáo tài chính qua Zalo (`zalo-report/`)

Trang riêng, không liên quan tới app học tiếng Anh. Công cụ biến file Excel xuất từ phần
mềm kế toán thành **báo cáo PDF** và **tin nhắn tổng hợp theo template**, có kèm link
hướng dẫn, rồi mở khung chat Zalo của sếp.

- Mở: `…/zalo-report/` trên GitHub Pages, hoặc chạy `run-windows.bat` rồi vào
  `http://localhost:8765/zalo-report/`.
- Các bước: kéo file Excel vào → kiểm tra hoặc sửa số → điền SĐT Zalo của sếp → bấm **Gửi qua Zalo**.
  - **Máy tính:** công cụ chép sẵn tin nhắn và tải PDF về, rồi mở `zalo.me/<SĐT>`. Bạn nhấn Ctrl+V, kéo file PDF vào và bấm Gửi.
  - **Điện thoại:** bảng chia sẻ hiện ra → chọn Zalo → chọn sếp → Gửi.
- Zalo cá nhân không có API gửi tin chính thức, nên người dùng luôn tự bấm Gửi. Cách này
  không vi phạm điều khoản Zalo và không có rủi ro bị khoá tài khoản.
- Tự nhận diện nhãn giống dashboard (Tổng tiền, Tiền mặt, Doanh thu, Nợ phải thu – Quá hạn…),
  bảng theo tháng và bảng tồn kho. Nếu file dùng tên nhãn khác, khai báo ở mục *Ánh xạ nhãn*.
  Bấm *Tải file Excel mẫu* để xem bố cục gợi ý.
- Mọi xử lý chạy trong trình duyệt. Số liệu không gửi lên máy chủ nào, chỉ cài đặt
  (SĐT, template, nhãn) được lưu trong trình duyệt.
- Trang hướng dẫn gắn trong tin nhắn: `zalo-report/huong-dan.html`. Có thể đổi sang link khác trong ô *Link hướng dẫn*.
- Thư viện tải từ CDN jsDelivr (SheetJS, Chart.js, html2pdf.js), nên lần đầu mở cần có mạng.

## Kiểm tra

```bash
node scripts/check.mjs
```

Script này (chạy cả trong CI trước khi deploy) kiểm tra 102 điểm:
- 3 file JSON đúng schema, đủ số lượng, không trùng id, mọi câu hỏi có đáp án hợp lệ
- Logic chấm phát âm: đọc đúng → 100; thiếu từ → đúng từ đó bị đánh dấu, các từ khác
  vẫn xanh (chứng minh alignment hoạt động); `sheep`/`ship` → gần đúng; `cat`/`dog` → sai
- Logic chọn bài: cùng ngày → cùng bài; 30 ngày liên tiếp dùng hết 300 từ không lặp
- PWA: manifest hợp lệ, icon tồn tại và không rỗng, **mọi module JS và file dữ liệu
  đều nằm trong danh sách precache** (thiếu một file là offline trắng trang)

Muốn xem một ngày cụ thể: mở `?date=2026-08-01`.
Mở thẳng một bài: `?view=ex3`.

### Sinh lại icon

Các file PNG trong `icons/` được sinh từ `icons/icon.svg` và đã commit sẵn. Chỉ khi
đổi thiết kế mới cần chạy lại:

```bash
npm i -D playwright && node scripts/make-icons.mjs
```

### Khi sửa file tĩnh

Nhớ tăng `CACHE_VERSION` trong `sw.js` (`v1` → `v2`…). Không tăng thì máy đã cài
vẫn dùng bản cũ trong cache.

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
run-windows.bat         bấm đúp để chạy trên Windows (không cần cài gì)
manifest.webmanifest    khai báo PWA: tên, icon, màu, lối tắt
sw.js                   service worker: cache toàn bộ app để chạy offline
icons/                  icon.svg (nguồn) + các bản PNG đã sinh sẵn
css/style.css           giao diện, chế độ sáng/tối, màu chấm điểm
js/app.js               điều phối: tải dữ liệu, chọn bài, chuyển tab, tổng kết
js/pwa.js               đăng ký service worker, nút cài đặt, báo có bản mới
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
scripts/serve.ps1       máy chủ local cho Windows (không cần cài gì)
scripts/make-icons.mjs  sinh PNG từ icon.svg (chỉ dùng khi đổi thiết kế)
```

Không có build step, không có dependency — chỉ HTML/CSS/JS thuần với ES modules.
