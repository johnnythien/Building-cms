# 🏢 BUILDING MANAGEMENT SYSTEM
## Hệ thống Quản lý Tòa nhà - Tóm tắt Dự án

## 📖 TỔNG QUAN

Building Management System là hệ thống quản lý toàn diện cho tòa nhà/chung cư, tích hợp 4 module chính:

- **💰 Quản lý Tài chính** - Hóa đơn, giao dịch, báo cáo với **Tax Engine tự động**
- **🏗️ Quản lý Đấu thầu** - Gói thầu, nhà thầu, chấm điểm với **Sealed Bids**
- **📢 Truyền thông - Tư vấn** - Tin tức, thông báo, góp ý, biểu quyết
- **👨‍💼 Quản trị Hệ thống** - Dashboard, danh mục, thuế, giám sát


## 🏗️ KIẾN TRÚC HỆ THỐNG

┌─────────────────────────────────────┐
│   FRONTEND (React 19.1.0)          │
│   Port: 3000                        │
│   - React Router, Bootstrap 5        │
│   - Axios, jsPDF, Chart.js          │
└──────────────┬──────────────────────┘
               │ REST API (JSON)
┌──────────────▼──────────────────────┐
│   BACKEND (Express.js 4.21.2)       │
│   Port: 3002                        │
│   - JWT Auth, CORS                  │
│   - SQL Server Driver               │
└──────────────┬──────────────────────┘
               │ SQL Queries
┌──────────────▼──────────────────────┐
│   DATABASE (SQL Server)              │
│   Database: QUANLYTHUCHI             │
│   - Stored Procedures                │
│   - Windows/SQL Authentication       │
└─────────────────────────────────────┘
```

---

## 🎯 CÁC MODULE CHÍNH

### 1. 💰 Module Quản lý Tài chính (Manager)

**Tính năng cốt lõi:**
- Quản lý Cư dân, Căn hộ với phân trang và tìm kiếm
- Quản lý Hóa đơn: Nhiều items, tự động tạo giao dịch khi thanh toán, xuất PDF
- Quản lý Giao dịch: Tự động tính thuế theo TaxRules
- Báo cáo Tài chính: Thu chi theo tháng/năm, xuất PDF

**Điểm nổi bật:**
- Hóa đơn → Giao dịch → Thuế được đồng bộ tự động
- Mỗi hóa đơn có thể có nhiều items (1:N)
- Tự động tính thuế VAT, Thuế Thu Hộ khi tạo giao dịch

---

### 2. 🏗️ Module Đấu thầu (Tender)

**Tính năng cốt lõi:**
- Quản lý Gói thầu với State Machine: `DRAFT → OPEN → CLOSED → GRADING → AWARDED`
- Quản lý Nhà thầu: CRUD đầy đủ, trạng thái active/inactive
- Quản lý Hồ sơ dự thầu: Liên kết gói thầu và nhà thầu
- Thiết lập Tiêu chí chấm thầu: Kỹ thuật (thủ công) + Tài chính (tự động)
- Chấm điểm và xếp hạng tự động

**Điểm nổi bật:**
- **Sealed Bids**: Giá bị ẩn khi gói thầu ở trạng thái OPEN
- **Bảo mật**: Admin xem giá khi đang mở → Tạo Security Alert (real-time notification)
- **Chấm điểm tự động**: Điểm Tài chính = (Giá thấp nhất / Giá hiện tại) × MaxScore
- **Sao chép tiêu chí**: Clone tiêu chí từ gói thầu cũ sang gói thầu mới
- **Niêm phong tiêu chí**: Trigger ngăn sửa tiêu chí khi gói thầu không ở DRAFT

**Phân quyền:**
- Admin: Toàn quyền, có thể xem giá khi đang mở (với audit log)
- Tender Manager: Chỉ quản lý khi DRAFT, không thể trao thầu/hủy

---

### 3. 📢 Module Truyền thông - Tư vấn (Media Consulting)

**Tính năng cốt lõi:**
- **Tin tức (News)**: CRUD, nhiều hình ảnh (tối đa 10), phân loại, trạng thái draft/published
- **Bài viết (Posts)**: Nhận bài từ cư dân, duyệt (pending/approved), hỗ trợ hình ảnh base64
- **Thông báo (Notifications)**: CRUD, nhiều hình ảnh (tối đa 5), lịch gửi, versioning (editedToId)
- **Góp ý (Comments)**: Xem góp ý từ cư dân, phản hồi (feedbacks), phân loại theo type
- **Biểu quyết (Votes)**: Tạo biểu quyết, theo dõi kết quả, xuất Excel

**Điểm nổi bật:**
- Dashboard với biểu đồ thống kê (Chart.js)
- Real-time Security Alert khi admin xem sealed bids (hiển thị trên tất cả tabs)
- Versioning cho thông báo (giữ lịch sử chỉnh sửa)
- Xuất Excel kết quả biểu quyết

---

### 4. 👨‍💼 Module Quản trị (Admin)

**Tính năng cốt lõi:**
- Dashboard tổng quan: Thống kê tài chính, giao dịch, hóa đơn
- Quản lý Danh mục: CRUD categories (income/expense)
- **Tax Dashboard** với 4 tabs:
  - Tính thuế Hóa đơn (re-calculate)
  - Báo cáo VAT (Input/Output/Net)
  - Xem Quy tắc Thuế
  - Báo cáo Thuế Phải Nộp
- Quản lý Media Consulting (toàn quyền)
- Quản lý Đấu thầu (toàn quyền)
- Tính lương nhân viên

**Điểm nổi bật:**
- Tax Engine tự động tính thuế theo quy định Việt Nam
- Hỗ trợ VAT (Đầu ra/Đầu vào), Thuế Thu Hộ (VAT_RENTAL, PIT_RENTAL)
- Tax-Inclusive và Tax-Exclusive
- Báo cáo VAT có thể bù trừ (Output - Input)

---

## 💡 HỆ THỐNG THUẾ TỰ ĐỘNG (TAX ENGINE)

### Cơ chế hoạt động:

1. **Khi tạo/sửa giao dịch** có `categoryId`:
   - Tự động tìm TaxRules áp dụng
   - Tính thuế theo TaxType (VAT_OUTPUT, VAT_INPUT, VAT_RENTAL, PIT_RENTAL)
   - Lưu vào `TransactionTaxes`

2. **Khi thanh toán hóa đơn** (status = 'paid' hoặc 'partial'):
   - Tự động tạo giao dịch từ mỗi invoice item
   - Tự động tính thuế cho từng giao dịch
   - Tóm tắt vào `InvoiceTaxes`

3. **Báo cáo VAT**:
   - VAT Đầu Ra (OUTPUT): Từ doanh thu
   - VAT Đầu Vào (INPUT): Từ chi phí (được khấu trừ)
   - VAT Phải Nộp = OUTPUT - INPUT (có thể bù trừ)

4. **Thuế Thu Hộ**:
   - VAT_RENTAL, PIT_RENTAL: Không được bù trừ với VAT_INPUT
   - Phải nộp 100%

### Cấu trúc dữ liệu:

```
TaxTypes (Loại thuế)
  └── TaxRules (Quy tắc thuế theo Category)
        └── TransactionTaxes (Thuế chi tiết)
              └── InvoiceTaxes (Thuế tóm tắt)
```

---

## 🔐 PHÂN QUYỀN

| Module | Admin | Manager | Tender Manager | Media Consulting |
|--------|-------|---------|---------------|------------------|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ |
| **Quản lý Tài chính** | ✅ | ✅ | ❌ | ❌ |
| **Quản lý Đấu thầu** | ✅ | ❌ | ✅ | ❌ |
| **Truyền thông** | ✅ | ❌ | ❌ | ✅ |
| **Quản lý Thuế** | ✅ | ❌ | ❌ | ❌ |
| **Quản lý Danh mục** | ✅ | ❌ | ❌ | ❌ |

**Lưu ý đặc biệt:**
- Admin có thể xem giá sealed bids (với Security Alert)
- Tender Manager chỉ quản lý gói thầu khi ở DRAFT
- Media Consulting Manager chỉ quản lý nội dung truyền thông

---

## 🛠️ CÔNG NGHỆ

### Frontend:
- React 19.1.0, React Router DOM 7.6.0
- Bootstrap 5.3.2 + React Bootstrap
- Axios, jsPDF, html2canvas, Chart.js
- FontAwesome, React Icons

### Backend:
- Node.js, Express 4.21.2
- mssql 10.0.4 (SQL Server driver)
- JWT (jsonwebtoken), bcryptjs
- CORS, Body Parser

### Database:
- Microsoft SQL Server
- Database: `QUANLYTHUCHI`
- Stored Procedures cho Tax Engine
- Hỗ trợ Windows/SQL Authentication

---

## 📁 CẤU TRÚC DỰ ÁN

```
building-cms/
├── src/
│   ├── screens/
│   │   ├── admin/          # Admin screens
│   │   ├── manager/        # Manager screens
│   │   ├── tender/         # Tender screens
│   │   ├── media_consulting/ # Media screens
│   │   └── tax/            # Tax screens
│   ├── components/         # Reusable components
│   ├── routers/            # Route definitions
│   └── hooks/              # Custom hooks
├── sql-server.js           # Backend Express server
├── QUANLYTHUCHI.sql        # Database schema
└── md/                     # Documentation
    ├── TENDER_GUIDE.md
    ├── Manager_Guide.md
    ├── MediaConsulting_Guide.md
    └── ADMIN_GUIDE.md
```

---

## 🚀 HƯỚNG DẪN CHẠY

### Yêu cầu:
- Node.js 20+
- Microsoft SQL Server
- SQL Server Management Studio (tùy chọn)

### Cài đặt:

```bash
cd building-cms/building-cms
npm install
```

### Setup Database:
1. Mở SQL Server Management Studio
2. Chạy script `QUANLYTHUCHI.sql` để tạo database và schema
3. Cấu hình kết nối trong `db-config.js` (hoặc dùng biến môi trường)

### Chạy ứng dụng:

**Cách 1: Chạy cả Frontend + Backend (Khuyến nghị)**
```bash
npm run dev-sql
```

**Cách 2: Chạy riêng lẻ**
```bash
# Terminal 1: Backend
npm run sql-server

# Terminal 2: Frontend
npm start
```

**Kiểm tra:**
- Backend: http://localhost:3002/health/db
- Frontend: http://localhost:3000

---

## 📊 API ENDPOINTS CHÍNH

### Authentication:
- `POST /auth/login` - Đăng nhập
- `POST /auth/register` - Đăng ký
- `GET /auth/me` - Thông tin user

### Core Entities:
- `GET/POST/PUT/DELETE /customers` - Cư dân
- `GET/POST/PUT/DELETE /apartments` - Căn hộ
- `GET/POST/PUT/DELETE /invoices` - Hóa đơn
- `GET/POST/PUT/DELETE /transactions` - Giao dịch
- `GET/POST/PUT/DELETE /categories` - Danh mục

### Tender:
- `GET/POST/PUT/DELETE /tenders` - Gói thầu
- `GET/POST/PUT/DELETE /contractors` - Nhà thầu
- `GET/POST/PUT/DELETE /bids` - Hồ sơ dự thầu
- `POST /tenders/:id/transition` - Chuyển trạng thái
- `POST /tenders/:id/clone-criteria` - Sao chép tiêu chí
- `POST /bids/:id/criteria-scores` - Chấm điểm

### Media Consulting:
- `GET/POST/PUT/DELETE /news` - Tin tức
- `GET/POST/PUT/DELETE /posts` - Bài viết
- `GET/POST/PUT/DELETE /notifications` - Thông báo
- `GET/POST/PUT/DELETE /comments` - Góp ý
- `GET/POST/PUT/DELETE /votes` - Biểu quyết
- `GET /vote-results` - Kết quả biểu quyết

### Tax Engine:
- `GET /taxes/rules` - Quy tắc thuế
- `POST /taxes/calculate/transaction` - Tính thuế giao dịch
- `POST /taxes/calculate/invoice/:id` - Tính thuế hóa đơn
- `GET /taxes/report/vat?month=X&year=Y` - Báo cáo VAT
- `GET /taxes/report/comprehensive` - Báo cáo tổng hợp

---

## 🎨 TÍNH NĂNG ĐẶC BIỆT

### 1. Tự động hóa:
- ✅ Tự động tính thuế khi tạo/sửa giao dịch
- ✅ Tự động tạo giao dịch khi thanh toán hóa đơn
- ✅ Tự động tính điểm Tài chính trong đấu thầu
- ✅ Tự động xếp hạng hồ sơ dự thầu

### 2. Bảo mật:
- ✅ Sealed Bids: Ẩn giá khi gói thầu đang mở
- ✅ Security Alert: Cảnh báo real-time khi admin xem sealed bids
- ✅ JWT Authentication với bcrypt
- ✅ Route Guards theo vai trò

### 3. Real-time:
- ✅ Security Alert notification (cross-tab synchronization)
- ✅ Dashboard tự động refresh

### 4. Export & Reports:
- ✅ Xuất hóa đơn PDF
- ✅ Xuất báo cáo tài chính PDF
- ✅ Xuất kết quả biểu quyết Excel
- ✅ Báo cáo VAT theo tháng/năm

---

## 📚 TÀI LIỆU HƯỚNG DẪN

Hệ thống có 4 file hướng dẫn chi tiết:

1. **TENDER_GUIDE.md** - Hướng dẫn Module Đấu thầu
   - Quy trình 8 bước, State Machine, Sealed Bids
   - Lập tiêu chí chấm thầu, chấm điểm

2. **Manager_Guide.md** - Hướng dẫn Module Quản lý Tòa nhà
   - Quản lý cư dân, căn hộ, hóa đơn, giao dịch
   - Báo cáo tài chính

3. **MediaConsulting_Guide.md** - Hướng dẫn Module Truyền thông
   - Quản lý tin tức, bài viết, thông báo, góp ý, biểu quyết
   - Dashboard và thống kê

4. **ADMIN_GUIDE.md** - Hướng dẫn Module Quản trị
   - Hệ thống Thuế Tự Động (chi tiết nghiệp vụ)
   - Tax Dashboard, báo cáo VAT

---

## ⚙️ CẤU HÌNH

### Ports mặc định:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3002`
- Database: `localhost:1433`

### Database Config (`db-config.js`):
```javascript
SQL_SERVER: 'localhost'
SQL_DATABASE: 'QUANLYTHUCHI'
SQL_PORT: 1433
SQL_USER: 'sa'
SQL_PASSWORD: '@Aa123456'
USE_MSNODESQLV8: false  // true = Windows Auth
```

---

## 🎯 KẾT QUẢ MONG ĐỢI

### Sản phẩm:
- ✅ Hệ thống quản lý tòa nhà hoàn chỉnh
- ✅ Giao diện responsive, hiện đại
- ✅ Tự động hóa quy trình quản lý
- ✅ Tax Engine chính xác theo quy định Việt Nam
- ✅ Báo cáo minh bạch, dễ kiểm tra

### Lợi ích:
- Giảm chi phí vận hành
- Tăng sự hài lòng của cư dân
- Cải thiện hiệu quả quản lý
- Tự động hóa tính thuế giảm sai sót
- Tạo nền tảng mở rộng quy mô

---

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Database**: Đảm bảo SQL Server đang chạy trước khi start backend
2. **Tax Engine**: Cần Stored Procedures đã được tạo trong database
3. **Sealed Bids**: Admin xem giá khi đang mở sẽ tạo Security Alert
4. **Ports**: Kiểm tra port 3000 và 3002 không bị chiếm dụng
5. **Backup**: Backup database thường xuyên, đặc biệt trong production

---

## 📝 GHI CHÚ PHÁT TRIỂN

### Đã hoàn thành:
- ✅ 4 module chính (Manager, Tender, Media Consulting, Admin)
- ✅ Tax Engine tự động với Stored Procedures
- ✅ Sealed Bids và Security Alert
- ✅ Real-time notifications
- ✅ Export PDF/Excel
- ✅ Phân trang và tìm kiếm
- ✅ Documentation đầy đủ

### Có thể mở rộng:
- Unit tests và Integration tests
- Tối ưu hóa database (indexes, query optimization)
- Bảo mật nâng cao (encryption, rate limiting)
- Mobile app (React Native)
- Real-time chat giữa BQL và cư dân


