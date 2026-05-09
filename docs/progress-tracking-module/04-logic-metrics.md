# 04 — Cách tính

## 1. Ai được đưa vào số liệu?


| Nguồn                         | Điều kiện                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Reading / Listening           | Có `score` hợp lệ (0–9), có `created_at`. Timeline không cần `status`.               |
| Writing / Speaking (timeline) | `status === graded` và có `score`. **Loại** `pending`, `failed` khỏi đường xu hướng. |
| Rubric Writing                | Như Writing graded **và** có số trong `rubric_scores.<tiêu_chí>`.                    |


**Map user:** `submitted_by` (R/L) và `user_id` (W/S) → một `student_id` nội bộ khi gộp overall.

## 2. Timeline

- Mỗi bài đủ điều kiện → một điểm `(created_at, score)`.
- **Cửa sổ `window`:** chỉ lấy bài có `created_at` trong khoảng (trừ `all`).
- **Trung bình trượt (rolling):** trung bình **5** bài **gần nhất** của đúng `skill` đó (có thể đưa vào config).
- **Delta / hướng:** so **trung bình điểm** cửa sổ hiện tại với cửa sổ **ngay trước** (cùng độ dài). Ít hơn **2** điểm hợp lệ trong một cửa sổ → `direction = unknown`.
- **Overall:** mặc định đề xuất: **trung bình có trọng số theo số bài** từng kỹ năng trong `window` (tránh bias kỹ năng ít làm). Product có thể đổi sang trung bình đơn giản các kỹ năng có dữ liệu.

## 3. Dạng câu (Reading / Listening)

- **Đơn vị đếm:** ưu tiên mức **nhỏ nhất** có trong `details` (part; không có thì câu).
- **Loại câu (`questionType`):** lấy từ submission nếu có; nếu không → join `assignment_id` + id câu sang **đề** để đọc `type`.
- **accuracy** = số đúng / tổng số ý (0–1).

**Phân loại (chỉ khi không bị “insufficient” ở bảng dưới):**

- **strong:** accuracy ≥ **80%**
- **weak:** accuracy **< 60%**
- **neutral:** còn lại

**Cổng số mẫu (theo tổng số ý đã làm):**


| Tổng ý | `confidence`      | Xếp strong/weak?                                 |
| ------ | ----------------- | ------------------------------------------------ |
| ≥ 20   | high              | Có                                               |
| 8–19   | medium            | Có                                               |
| < 8    | insufficient_data | **Không** → `classification = insufficient_data` |


**Xu hướng (`trendDirection`):** so accuracy hai kỳ liền nhau (cùng độ dài `window`). Chênh lệch **> 5 điểm phần trăm** (0.05) → `improving` hoặc `declining`; trong khoảng đó → `stable`; thiếu dữ liệu một kỳ → `unknown`.

## 4. Rubric Writing

- Với mỗi tiêu chí: **trung bình** điểm trên các bài graded **có đủ** giá trị tiêu chí đó trong `window`.
- **Trend rubric (`trend`):** dựa trên `deltaVsPreviousWindow`:
  - `up` nếu delta > 0.25
  - `down` nếu delta < -0.25
  - `flat` nếu trong khoảng [-0.25, 0.25]
  - `unknown` nếu thiếu dữ liệu cửa sổ trước
- Ít hơn **3** bài có đủ tiêu chí trong kỳ → `averageBand = null`, `deltaVsPreviousWindow = null`, `trend = unknown`.
- **Recommendation hardcode theo mức điểm** `averageBand` **(không dùng AI):**
  - `>= 7.0`: thông điệp duy trì / nâng cao
  - `6.0 - 6.5`: thông điệp cải thiện nhẹ
  - `< 6.0`: thông điệp ưu tiên luyện tập
  - `null`: thông điệp chưa đủ dữ liệu

## 5. Edge case

- Không có bài trong `window`: `points: []`, trend `unknown`.
- `score` null nhưng `graded`: bỏ qua metric, nên log/monitor (dữ liệu lệch).
- Trùng `submission_id`: chỉ tính **một** lần.

