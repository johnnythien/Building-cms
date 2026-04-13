# 📘 HƯỚNG DẪN MODULE QUẢN TRỊ (ADMIN)

## 📅 Phiên bản: 1.0 | Ngày cập nhật: 2025-01-XX

---

## 📋 MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Kiến trúc Hệ thống](#2-kiến-trúc-hệ-thống)
3. [Phân quyền](#3-phân-quyền)
4. [Hệ thống Thuế Tự Động](#4-hệ-thống-thuế-tự-động)
5. [Hướng dẫn Chức năng & Thao tác](#5-hướng-dẫn-chức-năng--thao-tác)
6. [Troubleshooting](#6-troubleshooting)
7. [FAQ](#7-faq)

---

## 1. GIỚI THIỆU

Module Quản trị (Admin) là trung tâm điều khiển toàn bộ hệ thống quản lý tòa nhà/chung cư, bao gồm quản lý danh mục, hệ thống thuế tự động, dashboard tổng quan, và giám sát các module khác.

### **Tính năng chính:**
- ✅ Dashboard tổng quan tài chính
- ✅ Quản lý Danh mục Thu/Chi (Categories)
- ✅ **Hệ thống Thuế Tự Động** (Tax Engine) - Tính thuế VAT, Thuế Thu Hộ
- ✅ Báo cáo Thuế GTGT (VAT Report)
- ✅ Quản lý Media Consulting (Tin tức, Bài viết, Thông báo, Góp ý, Biểu quyết)
- ✅ Quản lý Đấu thầu (Tender Management)
- ✅ Tính lương nhân viên

---

## 2. KIẾN TRÚC HỆ THỐNG

### **2.1. Cấu trúc Dữ liệu**

```
Admin Module
  ├── Categories (Danh mục Thu/Chi)
  │     └── TaxRules (Quy tắc Thuế)
  │           └── TaxTypes (Loại Thuế)
  ├── Transactions (Giao dịch)
  │     └── TransactionTaxes (Thuế chi tiết)
  ├── Invoices (Hóa đơn)
  │     └── InvoiceTaxes (Thuế tóm tắt)
  └── Tax Dashboard
        ├── InvoiceTaxCalculator (Tính thuế Hóa đơn)
        ├── VATReport (Báo cáo VAT)
        ├── TaxRulesViewer (Xem quy tắc)
        └── TaxPayableReport (Báo cáo phải nộp)
```

### **2.2. Luồng Tính Thuế Tự Động**

```
1. Tạo Giao dịch (Transaction) hoặc Thanh toán Hóa đơn
   ↓
2. Hệ thống tự động xác định Category
   ↓
3. Tìm TaxRules áp dụng cho Category (theo ngày hiệu lực)
   ↓
4. Tính thuế theo TaxType (VAT_OUTPUT, VAT_INPUT, VAT_RENTAL, PIT_RENTAL)
   ↓
5. Lưu vào TransactionTaxes (chi tiết) và InvoiceTaxes (tóm tắt)
   ↓
6. Cập nhật Báo cáo Thuế
```

---

## 3. PHÂN QUYỀN

| Hành động | Admin | Manager | Tender Manager | Media Consulting |
|-----------|-------|---------|----------------|------------------|
| **Dashboard Tổng quan** | ✅ | ✅ | ✅ | ✅ |
| **Quản lý Danh mục** | ✅ | ❌ | ❌ | ❌ |
| **Quản lý Thuế** | ✅ | ❌ | ❌ | ❌ |
| **Báo cáo Thuế** | ✅ | ❌ | ❌ | ❌ |
| **Quản lý Media** | ✅ | ❌ | ❌ | ✅ (Manager) |
| **Quản lý Đấu thầu** | ✅ | ❌ | ✅ | ❌ |
| **Tính lương** | ✅ | ❌ | ❌ | ❌ |

---

## 4. HỆ THỐNG THUẾ TỰ ĐỘNG

### **4.1. Tổng quan về Thuế trong Thực tế**

Hệ thống quản lý thuế theo quy định của Việt Nam, hỗ trợ các loại thuế chính:

#### **A. Thuế Giá trị Gia tăng (VAT - Value Added Tax)**

**Trong thực tế:**
- **VAT Đầu Ra (OUTPUT)**: Thuế phát sinh khi bán hàng, cung cấp dịch vụ
  - Ví dụ: Thu phí quản lý căn hộ 1,000,000 VNĐ → VAT 10% = 100,000 VNĐ
  - **Hướng**: `OUTPUT` (phải thu từ khách hàng)
  
- **VAT Đầu Vào (INPUT)**: Thuế được khấu trừ khi mua hàng, dịch vụ
  - Ví dụ: Chi tiền điện 10,000,000 VNĐ → VAT 10% = 1,000,000 VNĐ (được khấu trừ)
  - **Hướng**: `INPUT` (được khấu trừ)

- **Cơ chế Bù trừ (Offset)**:
  ```
  VAT Phải Nộp = VAT Đầu Ra - VAT Đầu Vào
  ```
  - Nếu > 0: Phải nộp cho nhà nước
  - Nếu < 0: Được hoàn/khấu trừ (chuyển sang kỳ sau)

#### **B. Thuế Thu Hộ (Withholding Tax)**

**Trong thực tế:**
- **VAT_RENTAL**: Thuế GTGT thu hộ khi cho thuê mặt bằng
  - Ví dụ: Cho thuê mặt bằng 5,000,000 VNĐ → VAT 5% = 250,000 VNĐ
  - **Đặc điểm**: Không được khấu trừ với VAT_INPUT, phải nộp 100%

- **PIT_RENTAL**: Thuế Thu nhập Cá nhân thu hộ khi cho thuê
  - Ví dụ: Cho thuê mặt bằng 5,000,000 VNĐ → PIT 5% = 250,000 VNĐ
  - **Đặc điểm**: Không được khấu trừ, phải nộp 100%

**Lưu ý**: Thuế Thu Hộ **KHÔNG** được bù trừ với VAT_INPUT, phải nộp riêng.

### **4.2. Cấu trúc Hệ thống Thuế**

#### **A. TaxTypes (Loại Thuế)**

Bảng `TaxTypes` định nghĩa các loại thuế trong hệ thống:

| Code | Name | DefaultRate | DefaultDirection | Mô tả |
|------|------|-------------|------------------|-------|
| `VAT_OUTPUT` | Thuế GTGT Đầu ra | 10% | OUTPUT | Thuế phát sinh khi bán hàng/dịch vụ |
| `VAT_INPUT` | Thuế GTGT Đầu vào | 10% | INPUT | Thuế được khấu trừ khi mua hàng/dịch vụ |
| `VAT_RENTAL` | Thuế GTGT (Cho thuê) | 5% | OUTPUT | Thuế thu hộ khi cho thuê mặt bằng |
| `PIT_RENTAL` | Thuế TNCN (Cho thuê) | 5% | OUTPUT | Thuế TNCN thu hộ khi cho thuê |

#### **B. TaxRules (Quy tắc Thuế)**

Bảng `TaxRules` liên kết **Category** với **TaxType**, quy định:
- **CategoryID**: Danh mục nào sẽ tính thuế
- **TaxTypeID**: Loại thuế nào được áp dụng
- **IsExempt**: Có được miễn thuế không (0 = tính thuế, 1 = miễn thuế)
- **RateOverride**: Thuế suất ghi đè (nếu NULL thì dùng DefaultRate)
- **IsTaxInclusive**: Số tiền đã bao gồm thuế chưa
  - `1` = **Tax-Inclusive** (đã bao gồm thuế) → Hệ thống sẽ **bóc tách** thuế
  - `0` = **Tax-Exclusive** (chưa bao gồm thuế) → Hệ thống sẽ **cộng thêm** thuế
- **StartDate/EndDate**: Thời gian hiệu lực
- **Priority**: Độ ưu tiên (nếu có nhiều quy tắc)

#### **C. Cơ chế Tính Thuế**

**1. Tax-Exclusive (Chưa bao gồm thuế):**

```
Ví dụ: Chi tiền điện 10,000,000 VNĐ (chưa VAT)
- BaseAmount = 10,000,000 VNĐ
- VAT 10% = 10,000,000 × 10% = 1,000,000 VNĐ
- Tổng = 11,000,000 VNĐ
```

**Công thức:**
```
BaseAmount = TransactionAmount
TaxAmount = BaseAmount × TaxRate / 100
TotalAmount = BaseAmount + TaxAmount
```

**2. Tax-Inclusive (Đã bao gồm thuế):**

```
Ví dụ: Thu phí quản lý 1,100,000 VNĐ (đã bao gồm VAT 10%)
- TotalAmount = 1,100,000 VNĐ
- BaseAmount = 1,100,000 / (1 + 10%) = 1,000,000 VNĐ
- VAT = 1,100,000 - 1,000,000 = 100,000 VNĐ
```

**Công thức:**
```
BaseAmount = TotalAmount / (1 + TaxRate / 100)
TaxAmount = TotalAmount - BaseAmount
```

### **4.3. Luồng Tính Thuế Chi tiết**

#### **Bước 1: Tạo Giao dịch hoặc Thanh toán Hóa đơn**

Khi Manager tạo giao dịch hoặc thanh toán hóa đơn:
- Hệ thống tự động gọi `sp_CalculateTaxesForTransaction`
- Hoặc gọi `sp_CalculateTaxesForInvoice` (tính cho tất cả giao dịch trong hóa đơn)

#### **Bước 2: Xác định Category và TaxRules**

```sql
-- Tìm TaxRules áp dụng cho Category
SELECT * FROM TaxRules
WHERE CategoryID = @CategoryID
  AND IsExempt = 0
  AND @TransactionDate BETWEEN StartDate AND EndDate
ORDER BY Priority
```

#### **Bước 3: Tính Thuế**

Hệ thống tính thuế cho từng TaxRule:

```sql
-- Nếu IsTaxInclusive = 1 (đã bao gồm thuế)
BaseAmount = TransactionAmount / (1 + TaxRate / 100)
TaxAmount = TransactionAmount - BaseAmount

-- Nếu IsTaxInclusive = 0 (chưa bao gồm thuế)
BaseAmount = TransactionAmount
TaxAmount = TransactionAmount × TaxRate / 100
```

#### **Bước 4: Lưu Kết quả**

- **TransactionTaxes**: Lưu chi tiết thuế cho từng giao dịch
- **InvoiceTaxes**: Tóm tắt thuế theo loại cho từng hóa đơn

### **4.4. Báo cáo Thuế**

#### **A. Báo cáo VAT (VAT Report)**

Báo cáo VAT theo tháng, tính toán:

```
VAT Đầu Ra (OUTPUT) = Tổng VAT_OUTPUT trong tháng
VAT Đầu Vào (INPUT) = Tổng VAT_INPUT trong tháng
VAT Phải Nộp (NET) = VAT Đầu Ra - VAT Đầu Vào
```

**Ví dụ thực tế:**
- Tháng 1/2025:
  - VAT Đầu Ra: 2,000,000 VNĐ
  - VAT Đầu Vào: 1,500,000 VNĐ
  - **VAT Phải Nộp: 500,000 VNĐ** (phải nộp cho nhà nước)

#### **B. Báo cáo Thuế Phải Nộp (Tax Payable Report)**

Tổng hợp tất cả các loại thuế phải nộp:

```
1. VAT Net = VAT_OUTPUT - VAT_INPUT (có thể bù trừ)
2. Thuế Thu Hộ = VAT_RENTAL + PIT_RENTAL (không bù trừ)
3. Tổng Phải Nộp = VAT Net (nếu > 0) + Thuế Thu Hộ
```

**Ví dụ thực tế:**
- VAT Net: 500,000 VNĐ
- VAT_RENTAL: 250,000 VNĐ
- PIT_RENTAL: 250,000 VNĐ
- **Tổng Phải Nộp: 1,000,000 VNĐ**

---

## 5. HƯỚNG DẪN CHỨC NĂNG & THAO TÁC

### **5.1. Dashboard Tổng quan**

**Mục đích**: Xem tổng quan tài chính, giao dịch, hóa đơn chờ thanh toán.

**Thao tác:**
1. Vào **"Tổng quan"** từ menu Admin
2. Chọn **Năm** và **Tháng** cần xem
3. Xem các thẻ thống kê:
   - Tổng giao dịch
   - Thu nhập tháng
   - Chi phí tháng
   - Số dư
   - Hóa đơn chờ thanh toán
4. Xem biểu đồ:
   - Giao dịch theo danh mục
   - So sánh tháng trước

---

### **5.2. Quản lý Danh mục (Categories)**

**Mục đích**: Quản lý danh mục thu/chi, làm cơ sở cho tính thuế.

**Thao tác Tạo Danh mục:**
1. Vào **"Danh mục"** từ menu Admin
2. Điền form:
   - **Tên danh mục**: Ví dụ "Phí quản lý căn hộ"
   - **Loại**: Chọn "Thu" hoặc "Chi"
   - **Mô tả**: Mô tả chi tiết (tùy chọn)
3. Click **"Thêm mới"**

**Thao tác Sửa/Xóa:**
1. Click **"Sửa"** trên danh mục cần sửa
2. Sửa thông tin và click **"Cập nhật"**
3. Click **"Xóa"** để xóa (lưu ý: Danh mục đã có giao dịch không thể xóa)

**Lưu ý:**
- Danh mục là cơ sở để hệ thống tự động tính thuế
- Mỗi danh mục có thể có nhiều TaxRules (theo thời gian)

---

### **5.3. Dashboard Thuế (Tax Dashboard)**

**Mục đích**: Quản lý và báo cáo thuế tự động.

**Các Tab chức năng:**

#### **Tab 1: Tính thuế Hóa đơn (Invoice Tax Calculator)**

**Mục đích**: Tính lại thuế cho hóa đơn (dùng khi thay đổi TaxRules hoặc sửa hóa đơn).

**Thao tác:**
1. Vào **"Dashboard Thuế"** từ menu Admin
2. Chọn Tab **"Tính thuế Hóa đơn"**
3. Chọn **Hóa đơn** từ dropdown (hoặc tìm kiếm)
4. Click **"Tính Thuế"**
5. Xem kết quả:
   - **Tóm tắt**: Tổng thuế theo loại (VAT_OUTPUT, VAT_INPUT, ...)
   - **Chi tiết**: Thuế cho từng giao dịch trong hóa đơn
6. Có thể **Xuất PDF** hoặc **In**

**Lưu ý:**
- Hệ thống tự động tính thuế khi thanh toán hóa đơn
- Tab này dùng để **tính lại** (re-calculate) khi cần

#### **Tab 2: Báo cáo VAT (VAT Report)**

**Mục đích**: Xem báo cáo VAT theo tháng (Đầu Ra, Đầu Vào, Phải Nộp).

**Thao tác:**
1. Chọn Tab **"Báo cáo VAT"**
2. Chọn **Tháng** và **Năm**
3. Click **"Xem Báo Cáo"**
4. Xem kết quả:
   - **VAT Đầu Ra (OUTPUT)**: Tổng thuế phát sinh từ doanh thu
   - **VAT Đầu Vào (INPUT)**: Tổng thuế được khấu trừ từ chi phí
   - **VAT Phải Nộp (NET)**: Số tiền phải nộp (hoặc được hoàn)

**Ví dụ thực tế:**
- Tháng 1/2025:
  - VAT Đầu Ra: 2,000,000 VNĐ
  - VAT Đầu Vào: 1,500,000 VNĐ
  - **VAT Phải Nộp: 500,000 VNĐ**

**Lưu ý:**
- Báo cáo đọc từ bảng `TransactionTaxes`
- Phải chạy **"Tính thuế Hóa đơn"** trước để có dữ liệu

#### **Tab 3: Xem Quy tắc Thuế (Tax Rules Viewer)**

**Mục đích**: Xem tất cả quy tắc thuế đang áp dụng.

**Thao tác:**
1. Chọn Tab **"Xem Quy tắc Thuế"**
2. Xem bảng quy tắc:
   - **Ưu tiên**: Độ ưu tiên (Priority)
   - **Danh mục**: Category áp dụng
   - **Loại Thuế**: TaxType (VAT_OUTPUT, VAT_INPUT, ...)
   - **Trạng thái**: Tính thuế / Miễn thuế
   - **Thuế suất**: RateOverride hoặc DefaultRate
   - **Hiệu lực**: StartDate - EndDate

**Lưu ý:**
- Quy tắc được sắp xếp theo Priority
- Chỉ hiển thị quy tắc đang hiệu lực (theo ngày hiện tại)

#### **Tab 4: Báo cáo Thuế Phải Nộp (Tax Payable Report)**

**Mục đích**: Xem tổng hợp tất cả thuế phải nộp (VAT + Thuế Thu Hộ).

**Thao tác:**
1. Chọn Tab **"Báo cáo Thuế Phải Nộp"**
2. Chọn **Tháng** và **Năm**
3. Click **"Xem Báo Cáo"**
4. Xem kết quả:
   - **VAT Net**: VAT_OUTPUT - VAT_INPUT (có thể bù trừ)
   - **Thuế Thu Hộ**: VAT_RENTAL + PIT_RENTAL (không bù trừ)
   - **Tổng Phải Nộp**: VAT Net (nếu > 0) + Thuế Thu Hộ

**Ví dụ thực tế:**
- VAT Net: 500,000 VNĐ
- VAT_RENTAL: 250,000 VNĐ
- PIT_RENTAL: 250,000 VNĐ
- **Tổng Phải Nộp: 1,000,000 VNĐ**

---

### **5.4. Quản lý Media Consulting**

Admin có quyền quản lý toàn bộ module Media Consulting:
- Quản lý Tin tức (News)
- Quản lý Bài viết (Posts)
- Quản lý Thông báo (Notifications)
- Quản lý Góp ý (Comments)
- Quản lý Biểu quyết (Votes)

**Xem chi tiết**: `MediaConsulting_Guide.md`

---

### **5.5. Quản lý Đấu thầu**

Admin có quyền quản lý toàn bộ module Đấu thầu:
- Quản lý Gói thầu (Tenders)
- Quản lý Nhà thầu (Contractors)
- Quản lý Hồ sơ dự thầu (Bids)
- Chuyển trạng thái, Trao thầu, Hủy gói thầu

**Xem chi tiết**: `TENDER_GUIDE.md`

---

### **5.6. Tính lương Nhân viên**

**Mục đích**: Tính lương cho nhân viên (staff) và quản lý (manager).

**Thao tác:**
1. Vào **"Tính lương"** từ menu Admin
2. Chọn **Tháng** và **Năm**
3. Xem danh sách nhân viên và lương
4. Cập nhật lương nếu cần
5. Xuất báo cáo lương

---

## 6. TROUBLESHOOTING

### **6.1. Thuế không được tính tự động**

**Nguyên nhân:**
- Category chưa có TaxRule
- TaxRule đã hết hiệu lực (EndDate < ngày hiện tại)
- TaxRule bị đánh dấu IsExempt = 1

**Giải pháp:**
1. Kiểm tra TaxRules trong Tab "Xem Quy tắc Thuế"
2. Tạo TaxRule mới nếu chưa có
3. Cập nhật EndDate nếu quy tắc đã hết hiệu lực
4. Kiểm tra IsExempt = 0

### **6.2. Báo cáo VAT không có dữ liệu**

**Nguyên nhân:**
- Chưa chạy "Tính thuế Hóa đơn" cho các hóa đơn trong tháng
- Giao dịch chưa có Category

**Giải pháp:**
1. Vào Tab "Tính thuế Hóa đơn"
2. Chọn từng hóa đơn trong tháng và click "Tính Thuế"
3. Hoặc đảm bảo giao dịch có Category trước khi tạo

### **6.3. Thuế tính sai**

**Nguyên nhân:**
- IsTaxInclusive không đúng (nên là 1 nhưng đặt 0, hoặc ngược lại)
- RateOverride sai
- TaxRule không đúng Category

**Giải pháp:**
1. Kiểm tra TaxRule trong Tab "Xem Quy tắc Thuế"
2. Sửa IsTaxInclusive nếu cần
3. Kiểm tra RateOverride
4. Xóa và tạo lại TaxRule nếu cần

### **6.4. VAT Net âm (được hoàn)**

**Đây là trường hợp bình thường:**
- Khi VAT Đầu Vào > VAT Đầu Ra
- Hệ thống sẽ hiển thị "VAT Được Khấu Trừ" (màu vàng)
- Số tiền này có thể được hoàn hoặc chuyển sang kỳ sau

---

## 7. FAQ

### **Q1: Thuế có được tính tự động không?**

**A:** Có. Hệ thống tự động tính thuế khi:
- Tạo giao dịch (Transaction) có Category
- Thanh toán hóa đơn (Invoice) → Tự động tạo giao dịch và tính thuế

### **Q2: Tax-Inclusive và Tax-Exclusive khác nhau như thế nào?**

**A:**
- **Tax-Inclusive**: Số tiền đã bao gồm thuế → Hệ thống bóc tách thuế
  - Ví dụ: 1,100,000 VNĐ (đã VAT 10%) → BaseAmount = 1,000,000, VAT = 100,000
- **Tax-Exclusive**: Số tiền chưa bao gồm thuế → Hệ thống cộng thêm thuế
  - Ví dụ: 1,000,000 VNĐ (chưa VAT) → BaseAmount = 1,000,000, VAT = 100,000

### **Q3: Thuế Thu Hộ có được khấu trừ với VAT_INPUT không?**

**A:** Không. Thuế Thu Hộ (VAT_RENTAL, PIT_RENTAL) phải nộp 100%, không được bù trừ với VAT_INPUT.

### **Q4: Làm sao để tính lại thuế cho hóa đơn cũ?**

**A:**
1. Vào Tab "Tính thuế Hóa đơn"
2. Chọn hóa đơn cần tính lại
3. Click "Tính Thuế"
4. Hệ thống sẽ xóa thuế cũ và tính lại theo TaxRules hiện tại

### **Q5: Có thể có nhiều TaxRule cho cùng một Category không?**

**A:** Có, nhưng phải khác thời gian hiệu lực (StartDate/EndDate) hoặc khác Priority. Hệ thống sẽ chọn quy tắc có Priority cao nhất và còn hiệu lực.

### **Q6: Làm sao để miễn thuế cho một Category?**

**A:** Tạo TaxRule với `IsExempt = 1`. Hệ thống sẽ không tính thuế cho Category đó.

### **Q7: Báo cáo VAT tính theo tháng hay theo năm?**

**A:** Theo tháng. Bạn chọn tháng và năm cần xem báo cáo.

### **Q8: VAT Net âm có nghĩa là gì?**

**A:** VAT Net âm nghĩa là VAT Đầu Vào > VAT Đầu Ra. Trong trường hợp này:
- Bạn được khấu trừ VAT
- Số tiền này có thể được hoàn hoặc chuyển sang kỳ sau (theo quy định thuế)

---

## 📝 KẾT LUẬN

Module Quản trị cung cấp hệ thống quản lý toàn diện với:

✅ **Hệ thống Thuế Tự Động**: Tính thuế VAT, Thuế Thu Hộ theo quy định Việt Nam

✅ **Báo cáo Thuế**: Báo cáo VAT, Thuế Phải Nộp theo tháng

✅ **Quản lý Danh mục**: Quản lý danh mục thu/chi làm cơ sở tính thuế

✅ **Dashboard Tổng quan**: Xem tổng quan tài chính, giao dịch, hóa đơn

✅ **Quản lý Module**: Quản lý Media Consulting, Đấu thầu, Tính lương

---

**📞 Hỗ trợ:** Nếu gặp vấn đề, vui lòng kiểm tra phần Troubleshooting hoặc FAQ ở trên.

