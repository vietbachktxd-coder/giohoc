# Giờ học: điểm danh, theo dõi giờ học, tính học phí

Phần mềm theo dõi giờ học thêm của con (Tiếng Anh với cô Tú Hảo, Toán Lý Hóa nâng cao với thầy Gia Khiêm). Làm theo kiểu phần mềm Chấm công: có app Android tự cập nhật, bản web dùng trên máy tính hoặc iPhone, và dữ liệu dùng chung lưu trên Google Sheets.

## Chức năng
- **Điểm danh:** bấm ▶ Bắt đầu khi vào học, ■ Kết thúc khi học xong. Phần mềm lấy giờ máy chủ và tự tính số phút học.
  - Có thể kiểm tra vị trí GPS và phát hiện Fake GPS.
  - Ghi được các trạng thái vắng có phép, vắng không phép, GV nghỉ, học bù.
  - Ghi tay được những buổi quên bấm.
- **Nhắc giờ học (app Android):** nhắc trước giờ học. Khi hết giờ học mà chưa bấm Kết thúc, app nhắc bấm Kết thúc.
- **Nhật ký:** xem buổi học theo danh sách hoặc theo lịch tháng, lọc theo lớp và theo học sinh. Giáo viên xác nhận từng buổi.
- **Thống kê:** số buổi, tổng giờ, tỷ lệ chuyên cần, học phí tháng. Có biểu đồ giờ học theo lớp, tình hình điểm danh, học phí và số giờ học của 12 tháng.
- **Học phí:** tính tiền theo giờ (có làm tròn), theo buổi hoặc trọn gói tháng. Mỗi lớp tự chọn vắng có tính tiền hay không.
  - Ghi được khoản điều chỉnh (+/−) và các lần thanh toán.
  - Phiếu học phí in được hoặc lưu PDF, gửi được qua Zalo, xuất được Excel (CSV).
- **Tài khoản:** phụ huynh (toàn quyền), giáo viên (xem lớp mình, xác nhận buổi, xem học phí), học sinh (tự điểm danh, báo vắng). Phụ huynh nhận thông báo khi con điểm danh hoặc khi thầy cô xác nhận.

## Cài đặt lần đầu
1. **Máy chủ:** vào script.new, xóa mã mẫu, rồi dán toàn bộ `backend/Code.gs` và lưu.
   - Chọn hàm `setup`, bấm ▶ Chạy rồi cho phép quyền. Hàm này tự tạo file `GioHoc_Data` và tài khoản **admin / 123456**.
   - Vào Triển khai → Tùy chọn triển khai mới → Ứng dụng web. Chọn *Thực thi*: **Tôi**, *Người có quyền truy cập*: **Bất kỳ ai**.
   - Copy URL ứng dụng web (đuôi `/exec`).
2. **GitHub:** dán URL `/exec` vào `web/config.js`.
   - Tạo secret `KS_PASS` (mật khẩu khóa ký).
   - Vào Settings → Pages → Source, chọn **GitHub Actions**.
3. **Link cài app:** `https://<tài-khoản>.github.io/giohoc/download/`
4. Đăng nhập **admin / 123456** (app bắt đổi mật khẩu ngay). Sau đó vào **Khác → Lớp học**, nhập đơn giá và lịch học, rồi sửa tên học sinh và tạo tài khoản cho thầy cô và con.

## Cập nhật
- Sửa mã rồi đẩy lên nhánh `main`. GitHub tự build APK, phiên bản tăng 1.0.1, 1.0.2…
- App tự tải và cài bản mới. Thêm `[force]` vào nội dung commit để buộc mọi máy cập nhật ngay.
- Code.gs được ghép tự động từ `backend/core.js` và `backend/gas.js`, chạy `node tools/build-gas.js` để ghép lại. Sau khi dán Code.gs mới, vào Triển khai → Quản lý triển khai → Sửa → Phiên bản mới.

## Khóa ký ứng dụng
`android/app/release.keystore.enc` được mã hóa bằng `KS_PASS`. **Không được làm mất mật khẩu này.** Nếu mất, các bản mới sẽ không cài đè lên bản cũ được.
