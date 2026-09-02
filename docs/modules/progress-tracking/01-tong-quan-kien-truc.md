# 01 — Tổng quan

## Mục tiêu sản phẩm

- **Timeline:** điểm (band) theo thời gian — lọc theo khoảng (`7d` / `30d` / `90d` / `all`), có thể xem từng kỹ năng hoặc **overall**.
- **Dạng câu (R/L):** tỷ lệ đúng theo loại câu, nhãn mạnh/yếu/trung tính (có cổng số lượng mẫu).
- **Rubric Writing:** trung bình + xu hướng theo từng tiêu chí; gợi ý ngắn (rule) tùy chọn.

## Phạm vi


| Trong phạm vi                          |     
| -------------------------------------- | 
| API cho học viên (`me`)                |     
| Insight từ dữ liệu đã chấm             |     
| Reading + Listening + Writing timeline |     


## Hiện có vs cần làm


|                   | Hiện có                        | Cần thêm                                                    |
| ----------------- | ------------------------------ | ----------------------------------------------------------- |
| Reading/Listening | `score`, `details` trong Mongo | Endpoint progress + (nếu cần) join đề để có `question.type` |
| Writing/Speaking  | `score`, `status`, `feedback`  | `rubric_scores` trên Writing + worker ghi đúng format       |
| `apps/server`     | Chỉ enqueue chấm               | Không đổi; progress đọc kết quả từ `assignments`            |


## Luồng tóm tắt

Nộp bài → queue → worker chấm → **ghi/ cập nhật** document trong `apps/assignments` → API `/progress/...` **đọc** và trả JSON cho UI.

Bước sau (tùy): job định kỳ ghi bản tổng hợp để biểu đồ load nhanh.