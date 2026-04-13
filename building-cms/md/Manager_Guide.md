# 📘 HƯỚNG DẪN MODULE QUẢN LÝ TÒA NHÀ (MANAGER)

## 📅 Phiên bản: 1.0 | Ngày cập nhật: 2025-01-XX

---

## 📋 MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Kiến trúc Hệ thống](#2-kiến-trúc-hệ-thống)
3. [Phân quyền](#3-phân-quyền)
4. [Workflow Tổng quan](#4-workflow-tổng-quan)
5. [Hướng dẫn Chức năng & Thao tác](#5-hướng-dẫn-chức-năng--thao-tác)
6. [Tính năng Tự động](#6-tính-năng-tự-động)
7. [Troubleshooting](#7-troubleshooting)
8. [FAQ](#8-faq)

---

## 1. GIỚI THIỆU

Module Quản lý Tòa nhà (Manager) là hệ thống quản lý toàn bộ hoạt động tài chính và cư dân của tòa nhà/chung cư, bao gồm quản lý cư dân, căn hộ, hóa đơn, giao dịch và báo cáo tài chính.

### **Tính năng chính:**
- ✅ Dashboard tổng quan tài chính
- ✅ Quản lý Cư dân (Residents/Customers)
- ✅ Quản lý Căn hộ (Apartments)
- ✅ Quản lý Hóa đơn (Invoices) - nhiều items, xuất PDF
- ✅ Quản lý Giao dịch (Transactions) - tự động tính thuế
- ✅ Báo cáo Tài chính (Financial Reports) - theo tháng/năm

---

## 2. KIẾN TRÚC HỆ THỐNG

### **2.1. Cấu trúc Dữ liệu**

```
Buildings (Tòa nhà)
  └── Apartments (Căn hộ)
        └── Customers (Cư dân)
              ├── Invoices (Hóa đơn)
              │     └── InvoiceItems (Mục hóa đơn - 1:N)
              │           └── Transactions (Giao dịch - tự động tạo)
              │                 └── TransactionTaxes (Thuế - tự động tính)
              └── Transactions (Giao dịch thủ công)
                    └── TransactionTaxes (Thuế - tự động tính)
```

### **2.2. Luồng Xử lý Hóa đơn**

```
1. Tạo Hóa đơn (pending)
   ↓
2. Thêm các mục (InvoiceItems) - có thể nhiều mục
   ↓
3. Thanh toán hóa đơn (paid/partial)
   ↓
4. Tự động tạo Giao dịch cho mỗi mục
   ↓
5. Tự động tính Thuế cho mỗi giao dịch
```

### **2.3. Luồng Xử lý Giao dịch**

```
1. Tạo Giao dịch (thủ công hoặc từ hóa đơn)
   ↓
2. Chọn Danh mục (Category) - có type: income/expense
   ↓
3. Tự động tính Thuế (nếu có categoryId)
   ↓
4. Cập nhật Báo cáo Tài chính
```

---

## 3. PHÂN QUYỀN

| Hành động | Manager | Admin |
|-----------|---------|-------|
| **Xem Dashboard** | ✅ | ✅ |
| **Quản lý Cư dân** | ✅ CRUD đầy đủ | ✅ CRUD đầy đủ |
| **Quản lý Căn hộ** | ✅ CRUD đầy đủ | ✅ CRUD đầy đủ |
| **Quản lý Hóa đơn** | ✅ CRUD đầy đủ | ✅ CRUD đầy đủ |
| **Quản lý Giao dịch** | ✅ CRUD đầy đủ | ✅ CRUD đầy đủ |
| **Xem Báo cáo** | ✅ | ✅ |
| **Xuất PDF** | ✅ | ✅ |
| **Quản lý Danh mục** | ❌ Chỉ Admin | ✅ |

---

## 4. WORKFLOW TỔNG QUAN

### **Quy trình Quản lý Tài chính:**

1. **Quản lý Cư dân**
   - Tạo thông tin cư dân mới
   - Gán căn hộ cho cư dân
   - Cập nhật thông tin cư dân

2. **Quản lý Căn hộ**
   - Tạo căn hộ mới
   - Gán cư dân cho căn hộ
   - Cập nhật thông tin căn hộ

3. **Tạo Hóa đơn**
   - Chọn cư dân và căn hộ
   - Thêm các mục hóa đơn (có thể nhiều mục)
   - Thiết lập ngày phát hành và hạn thanh toán

4. **Thanh toán Hóa đơn**
   - Cập nhật trạng thái: `paid` hoặc `partial`
   - Hệ thống tự động tạo giao dịch cho mỗi mục
   - Hệ thống tự động tính thuế cho mỗi giao dịch

5. **Quản lý Giao dịch**
   - Tạo giao dịch thủ công (thu/chi)
   - Chọn danh mục (tự động xác định loại thu/chi)
   - Hệ thống tự động tính thuế

6. **Xem Báo cáo**
   - Báo cáo thu chi theo tháng/năm
   - Xuất PDF báo cáo

---

## 5. HƯỚNG DẪN CHỨC NĂNG & THAO TÁC

### **5.1. Dashboard Tổng quan**

**Truy cập:** `/manager/dashboard`

**Chức năng:**
- Xem tổng quan tài chính theo tháng/năm
- Tổng thu, Tổng chi, Số dư
- Biểu đồ so sánh tháng
- Danh sách giao dịch gần đây

**Cách sử dụng:**
1. Chọn **Năm** từ dropdown
2. Chọn **Tháng** từ dropdown (hoặc "Tất cả")
3. Click **"Lọc"** để xem dữ liệu
4. Click **"Làm mới"** để tải lại dữ liệu

---

### **5.2. Quản lý Cư dân**

**Truy cập:** `/manager/residents`

#### **Tạo cư dân mới**

1. Click nút **"Thêm cư dân mới"**
2. Điền thông tin:
   - **Tên**: VD: `Nguyễn Văn A` (bắt buộc)
   - **Email**: VD: `nguyenvana@example.com` (bắt buộc)
   - **Số điện thoại**: VD: `0901234567` (bắt buộc)
   - **Địa chỉ**: VD: `123 Đường ABC` (tùy chọn)
3. Click **"Lưu"**

✅ **Kết quả:** Cư dân mới được tạo

#### **Xem chi tiết cư dân**

1. Tìm cư dân trong danh sách (có thể dùng tìm kiếm)
2. Click nút **"Xem"** (biểu tượng mắt) trên cư dân
3. Xem thông tin:
   - Thông tin cơ bản
   - Danh sách căn hộ đã được gán

#### **Sửa thông tin cư dân**

1. Tìm cư dân trong danh sách
2. Click nút **"Sửa"** (biểu tượng bút chì)
3. Chỉnh sửa thông tin
4. Click **"Lưu"**

#### **Xóa cư dân**

1. Tìm cư dân trong danh sách
2. Click nút **"Xóa"** (biểu tượng thùng rác)
3. Xác nhận xóa

⚠️ **Lưu ý:** Không thể xóa cư dân đã có hóa đơn hoặc giao dịch

#### **Tìm kiếm và Phân trang**

- **Tìm kiếm**: Nhập từ khóa vào ô tìm kiếm (tìm theo tên, email, số điện thoại)
- **Phân trang**: Sử dụng nút phân trang ở cuối danh sách (8 mục/trang)

---

### **5.3. Quản lý Căn hộ**

**Truy cập:** `/manager/apartments`

#### **Tạo căn hộ mới**

1. Click nút **"Thêm căn hộ mới"**
2. Điền thông tin:
   - **Tên căn hộ**: VD: `A101` (bắt buộc)
   - **Tòa nhà**: Chọn từ dropdown (bắt buộc)
   - **Tầng**: VD: `1` (bắt buộc)
   - **Diện tích**: VD: `50` (m²) (bắt buộc)
   - **Số phòng**: VD: `2` (bắt buộc)
   - **Cư dân**: Chọn từ dropdown (tùy chọn - có thể gán sau)
3. Click **"Lưu"**

✅ **Kết quả:** Căn hộ mới được tạo

#### **Gán cư dân cho căn hộ**

1. Tìm căn hộ trong danh sách
2. Click nút **"Gán cư dân"** (nếu căn hộ chưa có cư dân)
3. Chọn cư dân từ dropdown
4. Click **"Lưu"**

✅ **Kết quả:** Căn hộ được gán cho cư dân

#### **Xem chi tiết căn hộ**

1. Tìm căn hộ trong danh sách
2. Click nút **"Xem"** (biểu tượng mắt)
3. Xem thông tin:
   - Thông tin căn hộ
   - Thông tin cư dân (nếu có)

#### **Sửa thông tin căn hộ**

1. Tìm căn hộ trong danh sách
2. Click nút **"Sửa"** (biểu tượng bút chì)
3. Chỉnh sửa thông tin
4. Click **"Lưu"**

#### **Xóa căn hộ**

1. Tìm căn hộ trong danh sách
2. Click nút **"Xóa"** (biểu tượng thùng rác)
3. Xác nhận xóa

⚠️ **Lưu ý:** Không thể xóa căn hộ đã có hóa đơn

#### **Tìm kiếm và Lọc**

- **Tìm kiếm**: Nhập từ khóa (tìm theo tên, tầng, diện tích, cư dân, tòa nhà)
- **Lọc theo Tòa nhà**: Chọn tòa nhà từ dropdown
- **Phân trang**: 8 mục/trang

---

### **5.4. Quản lý Hóa đơn**

**Truy cập:** `/manager/invoices`

#### **Tạo hóa đơn mới**

**Bước 1:** Click nút **"Thêm hóa đơn mới"**

**Bước 2:** Điền thông tin cơ bản:
- **Cư dân**: Chọn từ dropdown (bắt buộc)
- **Căn hộ**: Tự động hiển thị các căn hộ của cư dân đã chọn (bắt buộc)
- **Ngày phát hành**: VD: `2025-01-15` (bắt buộc)
- **Hạn thanh toán**: VD: `2025-01-30` (bắt buộc)
- **Ghi chú**: Tùy chọn

**Bước 3:** Thêm các mục hóa đơn:
1. Click **"Thêm mục"** để thêm mục mới
2. Điền thông tin cho mỗi mục:
   - **Mô tả**: VD: `Tiền dịch vụ tháng 1/2025` (bắt buộc)
   - **Số tiền**: VD: `500000` (bắt buộc)
   - **Danh mục**: Chọn từ dropdown (bắt buộc - chỉ hiển thị danh mục loại "income")
3. Lặp lại để thêm nhiều mục (có thể thêm nhiều mục)
4. Click **"Xóa"** để xóa mục không cần

**Bước 4:** Click **"Lưu"**

✅ **Kết quả:** 
- Hóa đơn được tạo với trạng thái `pending`
- Tổng tiền = tổng của tất cả các mục

#### **Xem chi tiết hóa đơn**

1. Tìm hóa đơn trong danh sách
2. Click nút **"Xem"** (biểu tượng mắt)
3. Xem thông tin:
   - Thông tin hóa đơn
   - Danh sách các mục
   - Trạng thái thanh toán
   - Giao dịch liên quan (nếu đã thanh toán)

#### **Sửa hóa đơn**

1. Tìm hóa đơn trong danh sách
2. Click nút **"Sửa"** (biểu tượng bút chì)
3. Chỉnh sửa thông tin hoặc các mục
4. Click **"Lưu"**

⚠️ **Lưu ý:** 
- Có thể sửa hóa đơn ở trạng thái `pending`
- Khi sửa hóa đơn đã thanh toán, hệ thống sẽ tự động đồng bộ lại giao dịch

#### **Thanh toán hóa đơn**

1. Tìm hóa đơn trong danh sách (trạng thái `pending` hoặc `partial`)
2. Click nút **"Thanh toán"** hoặc **"Sửa"**
3. Điền thông tin thanh toán:
   - **Số tiền đã thanh toán**: VD: `500000`
   - **Ngày thanh toán**: VD: `2025-01-20`
   - **Trạng thái**: 
     - `paid` - nếu thanh toán đủ
     - `partial` - nếu thanh toán một phần
4. Click **"Lưu"**

✅ **Kết quả:** 
- Trạng thái hóa đơn được cập nhật
- **Hệ thống tự động tạo giao dịch** cho mỗi mục hóa đơn
- **Hệ thống tự động tính thuế** cho mỗi giao dịch

#### **Xuất PDF hóa đơn**

1. Tìm hóa đơn trong danh sách
2. Click nút **"Xuất PDF"** (biểu tượng PDF)
3. File PDF sẽ được tải xuống

#### **Lọc và Tìm kiếm**

- **Lọc theo trạng thái**: Chọn từ dropdown (Tất cả, Chờ thanh toán, Đã thanh toán, Quá hạn)
- **Lọc theo ngày**: Chọn ngày bắt đầu và ngày kết thúc
- **Tìm kiếm**: Nhập từ khóa (tìm theo tên cư dân, mã hóa đơn)

---

### **5.5. Quản lý Giao dịch**

**Truy cập:** `/manager/transactions`

#### **Tạo giao dịch mới (Thu)**

**Bước 1:** Click nút **"Thêm giao dịch mới"**

**Bước 2:** Điền thông tin:
- **Loại**: Chọn `income` (Thu)
- **Ngày**: VD: `2025-01-15` (bắt buộc)
- **Số tiền**: VD: `1000000` (bắt buộc)
- **Danh mục**: Chọn từ dropdown (bắt buộc - chỉ hiển thị danh mục loại "income")
- **Mô tả**: VD: `Thu tiền dịch vụ` (bắt buộc)
- **Hóa đơn**: Chọn từ dropdown (tùy chọn - nếu giao dịch liên quan đến hóa đơn)

**Bước 3:** Click **"Lưu"**

✅ **Kết quả:** 
- Giao dịch được tạo
- **Hệ thống tự động tính thuế** (nếu có categoryId)

#### **Tạo giao dịch mới (Chi)**

**Bước 1:** Click nút **"Thêm giao dịch mới"**

**Bước 2:** Điền thông tin:
- **Loại**: Chọn `expense` (Chi)
- **Ngày**: VD: `2025-01-15` (bắt buộc)
- **Số tiền**: VD: `500000` (bắt buộc)
- **Danh mục**: Chọn từ dropdown (bắt buộc - chỉ hiển thị danh mục loại "expense")
- **Mô tả**: VD: `Chi phí bảo trì` (bắt buộc)

**Bước 3:** Click **"Lưu"**

✅ **Kết quả:** 
- Giao dịch được tạo
- **Hệ thống tự động tính thuế** (nếu có categoryId)

#### **Sửa giao dịch**

1. Tìm giao dịch trong danh sách
2. Click nút **"Sửa"** (biểu tượng bút chì)
3. Chỉnh sửa thông tin
4. Click **"Lưu"**

✅ **Kết quả:** 
- Giao dịch được cập nhật
- **Hệ thống tự động tính lại thuế** (nếu có categoryId)

#### **Xóa giao dịch**

1. Tìm giao dịch trong danh sách
2. Click nút **"Xóa"** (biểu tượng thùng rác)
3. Xác nhận xóa

✅ **Kết quả:** 
- Giao dịch bị xóa
- **Thuế liên quan tự động bị xóa** (CASCADE)

#### **Xem chi tiết Thuế**

1. Tìm giao dịch trong danh sách
2. Click vào số lượng thuế (VD: `2 loại thuế`)
3. Xem chi tiết:
   - Loại thuế
   - Số tiền gốc
   - Tỷ lệ thuế
   - Số tiền thuế

#### **Lọc và Tìm kiếm**

- **Lọc theo loại**: Chọn từ dropdown (Tất cả, Thu, Chi)
- **Lọc theo danh mục**: Chọn từ dropdown
- **Lọc theo ngày**: Chọn ngày bắt đầu và ngày kết thúc
- **Tìm kiếm**: Nhập từ khóa (tìm theo mô tả)

---

### **5.6. Báo cáo Tài chính**

**Truy cập:** `/manager/reports`

#### **Xem báo cáo theo tháng**

1. Chọn **Năm** từ dropdown
2. Chọn **Tháng** từ dropdown (hoặc "Tất cả")
3. Click **"Xem báo cáo"**
4. Xem thông tin:
   - Tổng thu
   - Tổng chi
   - Số dư
   - Chi tiết theo danh mục

#### **Xuất PDF báo cáo**

1. Chọn năm và tháng
2. Click **"Xem báo cáo"**
3. Click nút **"Xuất PDF"**
4. File PDF sẽ được tải xuống

#### **Xem chi tiết báo cáo**

1. Click vào một báo cáo trong danh sách
2. Xem chi tiết:
   - Danh sách giao dịch thu
   - Danh sách giao dịch chi
   - Tổng hợp theo danh mục

---

## 6. TÍNH NĂNG TỰ ĐỘNG

### **6.1. Tự động tạo Giao dịch từ Hóa đơn**

**Khi nào:**
- Khi hóa đơn được thanh toán (trạng thái = `paid` hoặc `partial`)

**Cách hoạt động:**
1. Hệ thống tự động tạo **1 giao dịch cho mỗi mục hóa đơn**
2. Giao dịch có:
   - `type` = `income`
   - `amount` = số tiền của mục
   - `categoryId` = danh mục của mục
   - `invoiceId` = ID của hóa đơn
   - `customerId` = ID của cư dân
   - `apartmentId` = ID của căn hộ
   - `date` = ngày thanh toán
   - `status` = `paid`

**Ví dụ:**
- Hóa đơn có 3 mục:
  - Mục 1: Tiền dịch vụ - 500,000 VNĐ
  - Mục 2: Tiền điện - 300,000 VNĐ
  - Mục 3: Tiền nước - 200,000 VNĐ
- Khi thanh toán → Tự động tạo 3 giao dịch tương ứng

### **6.2. Tự động tính Thuế**

**Khi nào:**
- Khi tạo giao dịch mới (có `categoryId`)
- Khi sửa giao dịch (có `categoryId`)
- Khi hóa đơn được thanh toán (tạo giao dịch tự động)

**Cách hoạt động:**
1. Hệ thống kiểm tra danh mục của giao dịch
2. Tìm các quy tắc thuế áp dụng cho danh mục đó
3. Tính thuế cho từng loại thuế (VAT, Thuế Thu Hộ, ...)
4. Lưu vào bảng `TransactionTaxes`

**Ví dụ:**
- Giao dịch: 1,000,000 VNĐ, danh mục "Dịch vụ"
- Quy tắc thuế: VAT 10%
- Kết quả: Tự động tính và lưu thuế VAT = 100,000 VNĐ

### **6.3. Đồng bộ Hóa đơn và Giao dịch**

**Khi sửa hóa đơn đã thanh toán:**
1. Hệ thống tự động xóa các giao dịch cũ liên quan
2. Tạo lại giao dịch mới theo các mục mới
3. Tự động tính lại thuế

**Khi xóa hóa đơn:**
- Các giao dịch liên quan tự động bị xóa (CASCADE)

---

## 7. TROUBLESHOOTING

### **❌ Lỗi: "Không thể tạo hóa đơn"**

**Nguyên nhân:**
- Chưa chọn cư dân hoặc căn hộ
- Chưa thêm mục hóa đơn
- Thiếu thông tin bắt buộc

**Giải pháp:**
1. Kiểm tra đã chọn cư dân và căn hộ chưa
2. Đảm bảo có ít nhất 1 mục hóa đơn
3. Kiểm tra tất cả trường bắt buộc đã điền đầy đủ

---

### **❌ Lỗi: "Không thể gán căn hộ cho cư dân"**

**Nguyên nhân:**
- Căn hộ đã được gán cho cư dân khác

**Giải pháp:**
1. Kiểm tra căn hộ đã có cư dân chưa
2. Nếu có, cần gỡ gán trước khi gán cho cư dân mới

---

### **❌ Lỗi: "Giao dịch không tự động tính thuế"**

**Nguyên nhân:**
- Chưa chọn danh mục (categoryId)
- Danh mục không có quy tắc thuế

**Giải pháp:**
1. Đảm bảo đã chọn danh mục khi tạo giao dịch
2. Kiểm tra danh mục có quy tắc thuế chưa (liên hệ Admin)

---

### **❌ Lỗi: "Hóa đơn thanh toán không tạo giao dịch"**

**Nguyên nhân:**
- Trạng thái hóa đơn chưa được cập nhật thành `paid` hoặc `partial`
- Các mục hóa đơn chưa có danh mục

**Giải pháp:**
1. Kiểm tra trạng thái hóa đơn đã được cập nhật chưa
2. Đảm bảo tất cả mục hóa đơn đều có danh mục

---

### **❌ Lỗi: "Không thể xóa cư dân/căn hộ"**

**Nguyên nhân:**
- Cư dân/căn hộ đã có hóa đơn hoặc giao dịch liên quan

**Giải pháp:**
- Không thể xóa nếu đã có dữ liệu liên quan
- Có thể vô hiệu hóa bằng cách xóa thông tin gán (căn hộ) hoặc cập nhật thông tin (cư dân)

---

## 8. FAQ

### **Q1: Làm sao để tạo hóa đơn có nhiều mục?**

**A:**
1. Tạo hóa đơn mới
2. Click **"Thêm mục"** để thêm mục đầu tiên
3. Điền thông tin mục
4. Click **"Thêm mục"** lần nữa để thêm mục thứ 2, 3, ...
5. Có thể thêm bao nhiêu mục tùy ý
6. Click **"Lưu"**

---

### **Q2: Khi nào hóa đơn tự động tạo giao dịch?**

**A:**
- Khi hóa đơn được thanh toán (trạng thái = `paid` hoặc `partial`)
- Hệ thống tự động tạo 1 giao dịch cho mỗi mục hóa đơn

---

### **Q3: Làm sao để xem thuế của giao dịch?**

**A:**
1. Vào trang **"Giao dịch"**
2. Tìm giao dịch cần xem
3. Click vào số lượng thuế (VD: `2 loại thuế`)
4. Xem chi tiết các loại thuế và số tiền

---

### **Q4: Có thể sửa hóa đơn đã thanh toán không?**

**A:**
- ✅ **Có thể**, nhưng hệ thống sẽ tự động:
  - Xóa các giao dịch cũ
  - Tạo lại giao dịch mới theo các mục mới
  - Tính lại thuế

---

### **Q5: Làm sao để xuất PDF hóa đơn?**

**A:**
1. Tìm hóa đơn trong danh sách
2. Click nút **"Xuất PDF"** (biểu tượng PDF)
3. File PDF sẽ được tải xuống

---

### **Q6: Giao dịch tự động tính thuế như thế nào?**

**A:**
- Khi tạo/sửa giao dịch có `categoryId`
- Hệ thống tự động:
  1. Tìm quy tắc thuế cho danh mục đó
  2. Tính thuế cho từng loại (VAT, Thuế Thu Hộ, ...)
  3. Lưu vào bảng `TransactionTaxes`

---

### **Q7: Có thể tạo giao dịch không có danh mục không?**

**A:**
- ✅ **Có thể**, nhưng:
  - Giao dịch sẽ **không tự động tính thuế**
  - Nên chọn danh mục để hệ thống tự động tính thuế

---

### **Q8: Làm sao để xem báo cáo tài chính?**

**A:**
1. Vào menu **"Báo cáo"** (`/manager/reports`)
2. Chọn **Năm** và **Tháng**
3. Click **"Xem báo cáo"**
4. Xem tổng hợp thu chi và chi tiết theo danh mục
5. Có thể xuất PDF

---

## 📝 KẾT LUẬN

Module Quản lý Tòa nhà cung cấp hệ thống quản lý tài chính và cư dân hoàn chỉnh với:

✅ **Tính năng đầy đủ:** Quản lý cư dân, căn hộ, hóa đơn, giao dịch, báo cáo

✅ **Tự động hóa:** Tự động tạo giao dịch từ hóa đơn, tự động tính thuế

✅ **Dễ sử dụng:** UI/UX chuyên nghiệp, thông báo rõ ràng, xuất PDF

✅ **Báo cáo chi tiết:** Báo cáo thu chi theo tháng/năm, xuất PDF

---

**📞 Hỗ trợ:** Nếu gặp vấn đề, vui lòng kiểm tra phần Troubleshooting hoặc FAQ ở trên.

