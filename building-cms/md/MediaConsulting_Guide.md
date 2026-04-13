# 📘 HƯỚNG DẪN MODULE MEDIA CONSULTING

## 📅 Phiên bản: 1.0 | Ngày cập nhật: 2025-01-XX

---

## 📋 MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Kiến trúc Hệ thống](#2-kiến-trúc-hệ-thống)
3. [Phân quyền](#3-phân-quyền)
4. [Workflow Tổng quan](#4-workflow-tổng-quan)
5. [Hướng dẫn Chức năng & Thao tác](#5-hướng-dẫn-chức-năng--thao-tác)
6. [Tích hợp & Tự động hóa](#6-tích-hợp--tự-động-hóa)
7. [Troubleshooting](#7-troubleshooting)
8. [FAQ](#8-faq)

---

## 1. GIỚI THIỆU

Module Media Consulting là trung tâm truyền thông nội bộ của tòa nhà, giúp đội truyền thông hoặc bộ phận tư vấn:

- ✅ Theo dõi toàn cảnh tin tức, góp ý, biểu quyết
- ✅ Soạn và xuất bản **Tin tức**
- ✅ Nhận, duyệt và xử lý **Bài viết** do cư dân gửi
- ✅ Gửi **Thông báo** đa kênh (kèm hình ảnh, lịch gửi)
- ✅ Quản lý **Góp ý** và phản hồi cho cư dân
- ✅ Tạo và tổng hợp **Biểu quyết (Votes)**, xuất Excel kết quả

---

## 2. KIẾN TRÚC HỆ THỐNG

### **2.1. Cấu trúc Dữ liệu**

```
MediaConsulting
 ├── News (Tin tức)
 │     └── Images (Ảnh nhúng Base64, tối đa 10 ảnh)
 ├── Posts (Bài viết cư dân gửi)
 │     └── Attachments (ảnh/banner tùy chọn)
 ├── Notifications (Thông báo)
 │     ├── Images (tối đa 5 ảnh)
 │     └── Versions (editedToId, giữ lịch sử sửa)
 ├── Comments (Góp ý)
 │     └── Feedbacks (Phản hồi của BQL)
 ├── Votes (Biểu quyết)
 │     └── VoteResults (phiếu bầu, người tham gia)
 └── Dashboard
       ├── Thống kê News/Comments/Votes
       └── Charts (Pie, Bar)
```

### **2.2. Liên kết chính**

- Tin tức – Thông báo – Bài viết đều chia sẻ giao diện tìm kiếm/lọc thống nhất (`MediaConsulting.css`).
- Góp ý sau khi phản hồi sẽ cập nhật trạng thái `resolved` và hiển thị lịch sử phản hồi.
- Biểu quyết liên kết với `vote-results` để hiển thị số phiếu, người tham gia, xuất Excel.
- Thông báo loại `SECURITY_ALERT` được các module khác (như Tender) tạo tự động và sẽ hiển thị real-time ở mọi trang.

---

## 3. PHÂN QUYỀN

| Hành động | Media Consulting Manager | Admin |
|-----------|-------------------------|-------|
| Xem Dashboard Media | ✅ | ✅ |
| Quản lý Tin tức | ✅ CRUD | ✅ CRUD |
| Quản lý Bài viết cư dân | ✅ CRUD + duyệt | ✅ CRUD + duyệt |
| Gửi Thông báo | ✅ Tạo/Sửa/Xóa | ✅ Tạo/Sửa/Xóa |
| Quản lý Góp ý | ✅ Xem/Phản hồi/Xóa | ✅ Xem/Phản hồi/Xóa |
| Quản lý Biểu quyết | ✅ CRUD + xuất Excel | ✅ CRUD + xuất Excel |
| Quản lý danh mục/tài khoản | ❌ | ✅ (qua module Admin) |

> **Lưu ý:** Admin có thể truy cập mọi module; Media Consulting Manager chỉ thấy menu liên quan Media.

---

## 4. WORKFLOW TỔNG QUAN

### **Quy trình truyền thông điển hình**

1. **Thu nhận thông tin**
   - Cư dân gửi **Bài viết** (Posts) hoặc **Góp ý** (Comments).
   - BQL theo dõi thống kê nhanh tại Dashboard.

2. **Duyệt & phản hồi**
   - Duyệt bài viết (chuyển `pending → approved`).
   - Phản hồi góp ý, đánh dấu `resolved`.

3. **Xuất bản nội dung**
   - Tạo Tin tức với hình ảnh, phân loại, chọn trạng thái `draft/published`.
   - Lên lịch Thông báo kèm hình ảnh.

4. **Tương tác cộng đồng**
   - Tạo Biểu quyết với ngày bắt đầu/kết thúc.
   - Theo dõi kết quả, xuất Excel chia sẻ.

5. **Giám sát**
   - Dashboard cập nhật real-time số lượng tin, góp ý đang chờ, biểu quyết đang diễn ra.
   - Lịch sử phiên bản thông báo giúp kiểm soát nội dung đã gửi.

---

## 5. HƯỚNG DẪN CHỨC NĂNG & THAO TÁC

### 5.1. Dashboard (`/media-consulting/dashboard`)

- **Thống kê nhanh:** tổng số tin tức, góp ý, biểu quyết đang diễn ra/đã kết thúc.
- **Biểu đồ góp ý:** Pie chart `Chưa xử lý vs Đã phản hồi`.
- **Biểu đồ biểu quyết:** Bar chart số lượng biểu quyết theo tháng.
- **Danh sách mới nhất:** 5 tin, 5 góp ý, 5 biểu quyết gần nhất (kèm nút xem chi tiết).
- **Mẹo:** Sử dụng các thẻ thống kê để xác định khu vực cần xử lý (ví dụ góp ý chưa phản hồi).

---

### 5.2. Quản lý Tin tức (`/media-consulting/news`)

#### Tạo tin tức
1. Click **“Tạo mới”**.
2. Điền:
   - **Tiêu đề**, **Nội dung** (bắt buộc).
   - **Loại tin** (`Tin tức`, `Thông báo`, ...).
   - **Trạng thái**: `draft` (nháp) hoặc `published`.
   - **Ngày gửi** (ISO datetime) & **Ngày xuất bản** (tùy chọn).
3. **Hình ảnh**: tải tối đa 10 ảnh JPEG/PNG (≤5MB/ảnh, tổng ≤50MB). Có thể xóa từng ảnh.
4. Click **“Lưu”**: hệ thống tự ghi nhận `author` theo tài khoản đăng nhập.

#### Chỉnh sửa / Xóa / Xem chi tiết
- Sử dụng các nút **Edit/View/Delete** trên thẻ tin.
- Có thể **xóa hàng loạt** (chọn checkbox → “Xóa N tin”).

#### Bộ lọc và tìm kiếm
- Tìm theo tiêu đề, lọc theo **Loại**, **Trạng thái**, **Ngày gửi**.
- Giao diện bảng/thẻ tự động cập nhật theo bộ lọc.

---

### 5.3. Quản lý Bài viết cư dân (`/media-consulting/posts`)

#### Mục đích
Bài viết do cư dân gửi qua app cư dân, ban quản lý có thể duyệt, chỉnh sửa hoặc tạo bài chủ động.

#### Thao tác chính
1. **Tạo bài viết nội bộ**: “Tạo mới” → điền tiêu đề, chủ đề, nội dung, ảnh (tùy component) → Lưu.
2. **Duyệt bài cư dân**:
   - Trạng thái `pending` hiển thị badge vàng.
   - Click **“Duyệt”** (hoặc **Edit** → đổi `status` thành `approved`).
3. **Tìm kiếm/Lọc**:
   - Tìm theo tiêu đề hoặc người gửi.
   - Lọc theo **Chủ đề** (topic) và **Trạng thái** (`pending/approved`).
4. **Sắp xếp**: ưu tiên bài chờ duyệt (`pending-first`) hoặc theo thời gian tạo.
5. **Xem chi tiết**: click **View** để xem nội dung đầy đủ, hình ảnh, thông tin người gửi.

---

### 5.4. Quản lý Thông báo (`/media-consulting/notifications`)

#### Tạo thông báo
1. Click **“Tạo mới”**.
2. Nhập:
   - **Tiêu đề** (≤100 ký tự).
   - **Nội dung** (≤1000 chữ). Công cụ đếm tự động.
   - **Loại thông báo** (Chung, Khẩn cấp, …).
   - **Ngày gửi** (≥ ngày hiện tại).
   - **Hình ảnh**: tối đa 5 ảnh JPEG/PNG (≤5MB/ảnh, tổng ≤20MB).
3. Nội dung được gắn `sender` theo user hiện tại.
4. Submit → thông báo được lưu và hiển thị trên danh sách. Nếu là loại `SECURITY_ALERT`, hook real-time sẽ phát toast trên toàn hệ thống.

#### Quản lý phiên bản & chỉnh sửa
- Mỗi lần cập nhật dùng `NotificationUpdateForm`, hệ thống giữ `editedToId` để không mất lịch sử.
- Danh sách mặc định **lọc bỏ phiên bản cũ** & thông báo bị vô hiệu (`isActive = false`).

#### Xóa
- Xóa đơn hoặc nhiều thông báo (checkbox + “Xóa đã chọn”).

#### Lọc & tìm kiếm
- Tìm theo tiêu đề/loại.
- Lọc theo **Loại**, **Ngày gửi**, **Trạng thái** (`Đã gửi` vs `Chưa gửi`).
- Sắp xếp theo ngày mới nhất/cũ nhất hoặc A→Z.

---

### 5.5. Quản lý Góp ý (`/media-consulting/comments`)

#### Màn hình danh sách
- Bộ lọc đa tiêu chí: Loại góp ý, Ngày tạo, Trạng thái (`pending/resolved`), số lần phản hồi (0, 1-5, 6-10, 10+), sắp xếp A→Z hoặc theo thời gian.
- Có thể chọn nhiều góp ý để xóa (đặt `isDeletedByAdmin = true`).

#### Xem chi tiết & phản hồi
1. Click **View** để xem nội dung, người tạo, lịch sử phản hồi.
2. Click **“Phản hồi”** (FeedbackForm):
   - Nhập nội dung phản hồi.
   - Hệ thống lưu `author`, `createdAt`, cập nhật `status = resolved`.
   - Danh sách feedback hiển thị theo thời gian.

#### Quy trình xử lý
- **Mới**: trạng thái `pending`.
- **Sau khi phản hồi**: `resolved` + thêm feedback.
- Có thể tiếp tục phản hồi nhiều lần, feedback sẽ được đánh số.

---

### 5.6. Quản lý Biểu quyết (`/media-consulting/votes`)

#### Tạo / Cập nhật biểu quyết
1. Click **“Tạo mới”**.
2. Nhập:
   - **Tiêu đề** (bắt buộc).
   - **Ngày bắt đầu** & **Ngày kết thúc** (bắt buộc, Start ≤ End).
   - **Người tạo** (tự điền theo user, có thể sửa).
3. Lưu → điều hướng về danh sách.

#### Danh sách Biểu quyết
- Tìm kiếm theo tiêu đề, lọc trạng thái (`Đang diễn ra`, `Đã kết thúc`, `Sắp diễn ra`), lọc theo người tạo.
- Sắp xếp theo StartDate/EndDate (asc/desc).
- Chọn nhiều biểu quyết để xóa hàng loạt.
- Nút **“Xuất Excel”**: xuất danh sách biểu quyết + số người tham gia.

#### Xem kết quả (`/media-consulting/votes/:id/results`)
- Thẻ thống kê: tổng số phiếu, số người tham gia, số lựa chọn.
- Biểu đồ tròn + cột (Chart.js) cho từng lựa chọn.
- Bảng chi tiết người tham gia, lựa chọn, thời gian.
- Nút **“Xuất Excel”**: chi tiết phiếu bầu (UserId, ResidentId, lựa chọn, timestamp).

---

## 6. TÍCH HỢP & TỰ ĐỘNG HÓA

1. **Thông báo bảo mật (SECURITY_ALERT)**  
   - Khi Admin ở module Tender xem giá thầu bị niêm phong, hệ thống tạo thông báo `SECURITY_ALERT`.
   - Hook `useSecurityAlertNotification` chạy ở App root → poll `/notifications` và phát toast chạy ngang ở mọi tab (Admin + Manager + Media).
   - Các tab đồng bộ qua `localStorage` (`newSecurityAlertTrigger`).

2. **Phiên bản thông báo**  
   - `editedToId` đảm bảo mỗi lần chỉnh sửa tạo bản mới, danh sách chỉ hiển thị bản đang hoạt động.

3. **Xuất dữ liệu**  
   - Votes & VoteResults hỗ trợ xuất Excel bằng `xlsx`.

4. **Kiểm soát upload**  
   - Tin tức / Thông báo áp dụng giới hạn file (số lượng, định dạng, dung lượng) để đảm bảo hiệu năng.

---

## 7. TROUBLESHOOTING

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| **Không tạo được tin tức/notification** | Thiếu trường bắt buộc, upload vượt giới hạn | Kiểm tra thông báo lỗi, giảm số/size ảnh, đảm bảo đã chọn ngày gửi hợp lệ |
| **Không duyệt được bài viết** | Status không thay đổi, API trả lỗi 400 | Kiểm tra kết nối, thử lại sau. Nếu do quyền, xác nhận role `media_consulting_manager` |
| **Góp ý không chuyển `resolved`** | Chưa lưu phản hồi | Mở FeedbackForm, nhập nội dung & gửi để cập nhật trạng thái |
| **Biểu quyết không xuất Excel** | Trình duyệt chặn tải file | Cho phép pop-up/download hoặc thử trình duyệt khác |
| **Toast cảnh báo không hiển thị** | Tab không có quyền hoặc hook chưa chạy | Đảm bảo đăng nhập bằng Admin/Manager và mở console xem log `[Security Alert]` |

---

## 8. FAQ

**Q1: Có thể đặt lịch gửi thông báo trong tương lai không?**  
✅ Có. Chọn `Ngày gửi` lớn hơn hoặc bằng ngày hiện tại. Hook cron/poll sẽ hiển thị đúng lịch.

**Q2: Có thể lưu nháp tin tức?**  
✅ Chọn trạng thái `draft`. Tin chưa công bố vẫn chỉnh sửa/xóa bình thường.

**Q3: Làm sao biết góp ý nào chưa phản hồi?**  
→ Vào trang Góp ý, lọc trạng thái `Chưa xử lý` hoặc xem biểu đồ Pie trên Dashboard.

**Q4: Biểu quyết có thể chỉnh sửa sau khi tạo không?**  
✅ Có. Click **Edit**, cập nhật ngày/tiêu đề. Lưu ý nếu đã kết thúc, việc chỉnh sửa chỉ áp dụng cho metadata, không thay đổi phiếu đã ghi.

**Q5: Bài viết cư dân đã duyệt có thể quay lại trạng thái chờ?**  
✅ Có. Edit bài viết và đổi `status` về `pending` để tạm ẩn.

**Q6: Có thể gửi thông báo kèm nhiều ảnh không?**  
✅ Tối đa 5 ảnh (JPEG/PNG), mỗi ảnh ≤5MB, tổng ≤20MB.

---

## 📝 KẾT LUẬN

Module Media Consulting giúp đội truyền thông:

- **Kiểm soát luồng thông tin**: từ góp ý, bài viết cho đến tin tức & thông báo.
- **Tăng tương tác cư dân**: biểu quyết, thống kê trực quan.
- **Đảm bảo an toàn**: thông báo bảo mật chạy ngang ở mọi tab.
- **Quản trị hiệu quả**: lọc, tìm kiếm, xuất báo cáo nhanh chóng.

Nếu cần hỗ trợ thêm, vui lòng xem các phần Troubleshooting/FAQ hoặc liên hệ Admin hệ thống.


