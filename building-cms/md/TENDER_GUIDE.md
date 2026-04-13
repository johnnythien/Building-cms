# 📘 HƯỚNG DẪN MODULE ĐẤU THẦU (TENDER)

## 📅 Phiên bản: 2.0 | Ngày cập nhật: 2025-01-XX

---

## 📋 MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Kiến trúc Hệ thống](#2-kiến-trúc-hệ-thống)
3. [Phân quyền](#3-phân-quyền)
4. [Workflow Tổng quan](#4-workflow-tổng-quan)
5. [Hướng dẫn Chức năng & Thao tác](#5-hướng-dẫn-chức-năng--thao-tác)
6. [Lập Tiêu chí Chấm thầu](#6-lập-tiêu-chí-chấm-thầu)
7. [Troubleshooting](#7-troubleshooting)
8. [FAQ](#8-faq)

---

## 1. GIỚI THIỆU

Module Đấu thầu (Tender) là hệ thống quản lý toàn bộ quy trình đấu thầu trong tòa nhà/chung cư, từ tạo gói thầu, nhận hồ sơ, chấm điểm tự động, đến trao thầu.

### **Tính năng chính:**
- ✅ Quản lý Gói thầu, Nhà thầu, Hồ sơ dự thầu
- ✅ Thiết lập Tiêu chí chấm thầu (Kỹ thuật & Tài chính)
- ✅ Chấm điểm tự động và thủ công
- ✅ Bảo mật Đấu thầu kín (Sealed Bids)
- ✅ Quản lý trạng thái chặt chẽ (State Machine)
- ✅ Dashboard tổng quan

---

## 2. KIẾN TRÚC HỆ THỐNG

### **2.1. Cấu trúc Dữ liệu**

```
Tenders (Gói thầu)
  ├── TenderCriteria (Tiêu chí chấm thầu)
  │     ├── TECHNICAL (Kỹ thuật)
  │     └── FINANCIAL (Tài chính)
  └── Bids (Hồ sơ dự thầu)
        ├── BidCriteriaScores (Điểm chi tiết)
        └── Contractors (Nhà thầu)
```

### **2.2. Trạng thái Gói thầu (State Machine)**

```
DRAFT → OPEN → CLOSED → GRADING → AWARDED
  ↓       ↓        ↓         ↓
CANCELLED (có thể hủy từ bất kỳ trạng thái nào, trừ AWARDED)
```

**Mô tả:**
- **DRAFT**: Nháp, chưa mở thầu
- **OPEN**: Đang mở thầu, nhận hồ sơ (giá bị ẩn)
- **CLOSED**: Đã đóng, không nhận hồ sơ mới (giá hiển thị)
- **GRADING**: Đang chấm điểm
- **AWARDED**: Đã trao thầu
- **CANCELLED**: Đã hủy

### **2.3. Luồng Xử lý Điểm**

```
1. Chấm điểm Kỹ thuật (thủ công)
   ↓
2. Tính điểm Tài chính (tự động)
   ↓
3. Tính Tổng điểm = (Kỹ thuật × Weight) + (Tài chính × Weight)
   ↓
4. Xếp hạng (ranking) theo tổng điểm giảm dần
```

---

## 3. PHÂN QUYỀN

| Hành động | Admin | Tender Manager |
|-----------|-------|----------------|
| **Tạo/Sửa/Xóa gói thầu** | ✅ Tất cả trạng thái | ✅ Chỉ khi DRAFT |
| **Quản lý nhà thầu** | ✅ CRUD đầy đủ | ✅ CRUD đầy đủ |
| **Xem hồ sơ dự thầu** | ✅ Luôn thấy (có override) | ✅ Chỉ khi đã đóng |
| **Chuyển trạng thái** | ✅ Tất cả transitions | ✅ OPEN→CLOSED→GRADING |
| **Trao thầu (AWARDED)** | ✅ Chỉ Admin | ❌ Không được |
| **Hủy gói thầu (CANCELLED)** | ✅ Chỉ Admin | ❌ Không được |
| **Xem giá khi đang mở** | ✅ Với audit log | ❌ Sealed Bids |
| **Chấm điểm** | ✅ Có thể | ✅ Có thể |

---

## 4. WORKFLOW TỔNG QUAN

### **Quy trình 8 bước:**

1. **Tạo gói thầu** (DRAFT)
   - Admin/Tender Manager tạo gói thầu mới
   - Điền thông tin: mã, tên, mô tả, ngân sách, ngày bắt đầu/kết thúc

2. **Lập tiêu chí chấm thầu**
   - Thêm tiêu chí Kỹ thuật (ít nhất 1, tổng Weight = 100%)
   - Thêm tiêu chí Tài chính (ít nhất 1, tổng Weight = 100%)
   - nếu có 3 tiêu chí kỹ thuật thì tổng 3 tiêu chí phải = 100% ( 30% 40% 30%)

3. **Mở thầu** (DRAFT → OPEN)
   - Kiểm tra điều kiện: có đủ tiêu chí, Weight = 100%
   - Chuyển trạng thái → OPEN
   - Nhà thầu có thể nộp hồ sơ (giá bị ẩn)

4. **Nhận hồ sơ dự thầu**
   - Nhà thầu nộp hồ sơ qua hệ thống
   - Hệ thống kiểm tra: gói thầu đang OPEN, chưa quá hạn

5. **Đóng thầu** (OPEN → CLOSED)
   - Không nhận hồ sơ mới
   - Giá dự thầu được hiển thị

6. **Bắt đầu chấm điểm** (CLOSED → GRADING)
   - Yêu cầu: có ít nhất 1 hồ sơ hợp lệ

7. **Chấm điểm**
   - **Tài chính**: Tự động tính (giá thấp nhất = điểm cao nhất)
   - **Kỹ thuật**: Chấm thủ công từng tiêu chí
   - **Tổng điểm**: Tự động tính và xếp hạng

8. **Trao thầu** (GRADING → AWARDED) - **Chỉ Admin**
   - Yêu cầu: tất cả hồ sơ đã có điểm, có người thắng (ranking = 1)

---

## 5. HƯỚNG DẪN CHỨC NĂNG & THAO TÁC

### **5.1. Quản lý Gói thầu**

#### **Tạo gói thầu mới**

**Cả Admin và Tender Manager:**

1. Vào menu **"Gói thầu"** (`/tender/tenders`)
2. Click **"Thêm gói thầu"** (+)
3. Điền thông tin:
   - **Mã gói thầu**: VD: `TENDER-2025-001`
   - **Tên gói thầu**: VD: `Sửa chữa hệ thống điện`
   - **Mô tả**: Mô tả chi tiết
   - **Ngân sách dự kiến**: VD: `500000000`
   - **Ngày bắt đầu**: VD: `2025-01-01`
   - **Ngày kết thúc**: VD: `2025-01-31`
   - **Trạng thái**: Mặc định `DRAFT`
4. Click **"Lưu"**

#### **Sửa gói thầu**

- **Admin**: Có thể sửa ở mọi trạng thái (trừ status)
- **Tender Manager**: Chỉ sửa được khi `status = DRAFT`

#### **Xóa gói thầu**

- **Cả hai**: Có thể xóa (trừ khi đã trao thầu)

---

### **5.2. Quản lý Nhà thầu**

**Cả Admin và Tender Manager:**

1. Vào menu **"Nhà thầu"** (`/tender/contractors`)
2. Click **"Thêm nhà thầu"**
3. Điền thông tin:
   - Tên công ty, Mã số thuế
   - Email, Số điện thoại, Địa chỉ
   - Người đại diện, Chức vụ
   - Trạng thái: `active` hoặc `inactive`
4. Click **"Lưu"**

**Sửa/Xóa**: Click nút **"Sửa"** hoặc **"Xóa"** trên từng nhà thầu

---

### **5.3. Mở Thầu (DRAFT → OPEN)**

**Cả Admin và Tender Manager:**

1. Chọn gói thầu ở trạng thái `DRAFT`
2. Click tab **"Chuyển trạng thái"**
3. Kiểm tra điều kiện (hệ thống tự động kiểm tra):
   - ✅ Có ít nhất 1 tiêu chí kỹ thuật
   - ✅ Có ít nhất 1 tiêu chí tài chính
   - ✅ Tổng Weight kỹ thuật = 100%
   - ✅ Tổng Weight tài chính = 100%
4. Click nút **"→ Đang mở thầu"**

✅ **Kết quả:** Gói thầu chuyển sang `OPEN`, nhà thầu có thể nộp hồ sơ

---

### **5.4. Xem Hồ sơ Dự thầu**

**Khi gói thầu đang `OPEN`:**
- ❌ **KHÔNG thấy** giá dự thầu (Sealed Bids)
- ✅ Thấy: Tên nhà thầu, ngày nộp, trạng thái
- ✅ **Admin**: Có nút **"Xem giá (Admin Override)"** (có audit log)
- ❌ **Tender Manager**: Không có nút override

**Khi gói thầu đã `CLOSED` hoặc `GRADING`:**
- ✅ **Thấy** giá dự thầu
- ✅ Thấy điểm kỹ thuật, tài chính, tổng điểm
- ✅ Thấy xếp hạng (ranking)

**Cách xem:**
1. Chọn gói thầu
2. Click tab **"Hồ sơ dự thầu"**
3. Xem danh sách hồ sơ

---

### **5.5. Đóng Thầu (OPEN → CLOSED)**

**Cả Admin và Tender Manager:**

1. Chọn gói thầu ở trạng thái `OPEN`
2. Click tab **"Chuyển trạng thái"**
3. Click nút **"→ Đã đóng thầu"**

✅ **Kết quả:** 
- Gói thầu chuyển sang `CLOSED`
- Không nhận hồ sơ mới
- Giá dự thầu được hiển thị

---

### **5.6. Bắt đầu Chấm điểm (CLOSED → GRADING)**

**Cả Admin và Tender Manager:**

1. Chọn gói thầu ở trạng thái `CLOSED`
2. Kiểm tra: Có ít nhất 1 hồ sơ dự thầu hợp lệ
3. Click tab **"Chuyển trạng thái"**
4. Click nút **"→ Đang chấm điểm"**

✅ **Kết quả:** Gói thầu chuyển sang `GRADING`

---

### **5.7. Chấm Điểm Chi tiết (Kỹ thuật)**

**Cả Admin và Tender Manager:**

1. Chọn gói thầu
2. Click tab **"Hồ sơ dự thầu"**
3. Chọn hồ sơ cần chấm điểm
4. Click nút **"Chấm điểm"**
5. Nhập điểm cho từng tiêu chí kỹ thuật:
   - Điểm không được vượt quá **Điểm tối đa** (MaxScore)
   - Có thể nhập số thập phân (VD: 85.5)
6. Click **"Lưu điểm"**

✅ **Kết quả:** 
- Điểm được lưu
- Điểm kỹ thuật tự động tính lại
- Tổng điểm và xếp hạng tự động cập nhật

---

### **5.8. Tính Điểm Tự động**

**Cả Admin và Tender Manager:**

1. Chọn gói thầu ở trạng thái `CLOSED` hoặc `GRADING`
2. Click tab **"Tính điểm"**
3. Click nút **"Tính điểm tự động"**

**Hệ thống sẽ tự động:**
1. **Tính điểm Tài chính:**
   - Công thức: `(Giá thấp nhất / Giá nhà thầu) × MaxScore`
   - Nhà thầu có giá thấp nhất = MaxScore điểm
   - Các nhà thầu khác = điểm tương ứng

2. **Tính điểm Kỹ thuật:**
   - Từ điểm chi tiết các tiêu chí đã chấm
   - Công thức: `Σ(Điểm tiêu chí × Weight) / Σ(MaxScore × Weight) × 100`

3. **Tính Tổng điểm:**
   - Công thức: `(Điểm kỹ thuật × Weight) + (Điểm tài chính × Weight)`
   - Weight được normalize về tổng 100%

4. **Xếp hạng:**
   - Sắp xếp theo tổng điểm giảm dần
   - Ranking = 1 là người thắng

✅ **Kết quả:** Tất cả hồ sơ được cập nhật điểm và xếp hạng

---

### **5.9. Trao Thầu (GRADING → AWARDED)**

**⚠️ CHỈ ADMIN:**

1. Chọn gói thầu ở trạng thái `GRADING`
2. Kiểm tra điều kiện:
   - ✅ Tất cả hồ sơ đã có điểm đầy đủ
   - ✅ Có người thắng (ranking = 1)
3. Click tab **"Chuyển trạng thái"**
4. Click nút **"→ Đã trao thầu"**

✅ **Kết quả:** 
- Gói thầu chuyển sang `AWARDED`
- Hồ sơ thắng cuộc được đánh dấu `isWinner = 1`
- Ghi lại thời gian và người trao thầu

**Tender Manager:** Không thể trao thầu, cần yêu cầu Admin

---

### **5.10. Hủy Gói thầu**

**⚠️ CHỈ ADMIN:**

1. Chọn gói thầu (bất kỳ trạng thái nào, trừ `AWARDED`)
2. Click tab **"Chuyển trạng thái"**
3. Click nút **"→ Đã hủy"**
4. Nhập **Lý do hủy** (bắt buộc)
5. Click **"Xác nhận hủy"**

✅ **Kết quả:** Gói thầu chuyển sang `CANCELLED`

---

## 6. LẬP TIÊU CHÍ CHẤM THẦU

### **6.1. Khái niệm**

Tiêu chí chấm thầu được chia thành 2 loại:

- **TECHNICAL (Kỹ thuật)**: Chấm thủ công, dựa trên năng lực, kinh nghiệm, phương án...
- **FINANCIAL (Tài chính)**: Tính tự động, dựa trên giá dự thầu

### **6.2. Quy tắc Bắt buộc**

⚠️ **QUAN TRỌNG:**

1. **Phải có ít nhất 1 tiêu chí Kỹ thuật** và **ít nhất 1 tiêu chí Tài chính**
2. **Tổng Weight của tất cả tiêu chí Kỹ thuật = 100%**
3. **Tổng Weight của tất cả tiêu chí Tài chính = 100%**
4. **Chỉ có thể sửa/xóa tiêu chí khi gói thầu ở trạng thái `DRAFT`**

### **6.3. Tạo Tiêu chí Kỹ thuật**

**Bước 1:** Chọn gói thầu ở trạng thái `DRAFT`

**Bước 2:** Click tab **"Tiêu chí chấm thầu"**

**Bước 3:** Click **"Thêm tiêu chí"**

**Bước 4:** Điền thông tin:
- **Tên tiêu chí**: VD: `Kinh nghiệm triển khai` (bắt buộc)
- **Mô tả**: VD: `Số năm kinh nghiệm trong lĩnh vực` (tùy chọn)
- **Điểm tối đa (MaxScore)**: VD: `100` (phải > 0)
- **Trọng số (Weight)**: VD: `30` (%) (0-100%)
- **Loại**: Chọn `TECHNICAL`
- **Thứ tự (Order)**: VD: `1` (tùy chọn, dùng để sắp xếp)

**Bước 5:** Click **"Lưu"**

**Ví dụ tạo nhiều tiêu chí Kỹ thuật:**

| Tên tiêu chí | MaxScore | Weight | Tổng Weight |
|--------------|----------|--------|-------------|
| Kinh nghiệm triển khai | 100 | 30% | 30% |
| Năng lực tài chính | 100 | 40% | 70% |
| Phương án kỹ thuật | 100 | 30% | **100%** ✅ |

### **6.4. Tạo Tiêu chí Tài chính**

**Bước 1-3:** Giống như tiêu chí Kỹ thuật

**Bước 4:** Điền thông tin:
- **Tên tiêu chí**: VD: `Giá dự thầu` (bắt buộc)
- **Mô tả**: VD: `Giá thầu thấp nhất sẽ được điểm cao nhất` (tùy chọn)
- **Điểm tối đa (MaxScore)**: VD: `100` (phải > 0)
- **Trọng số (Weight)**: VD: `100` (%) (phải = 100% nếu chỉ có 1 tiêu chí)
- **Loại**: Chọn `FINANCIAL`
- **Thứ tự (Order)**: VD: `1`

**Bước 5:** Click **"Lưu"**

**Lưu ý:** Thông thường chỉ có **1 tiêu chí Tài chính** với Weight = 100%

### **6.5. Công thức Tính Điểm**

#### **Điểm Tài chính (Tự động):**

```
Điểm Tài chính = (Giá thấp nhất / Giá nhà thầu) × MaxScore
```

**Ví dụ:**
- Giá thấp nhất: 100,000,000 VNĐ
- MaxScore: 100
- Nhà thầu A: 100,000,000 VNĐ → Điểm = (100M/100M) × 100 = **100**
- Nhà thầu B: 120,000,000 VNĐ → Điểm = (100M/120M) × 100 = **83.33**

#### **Điểm Kỹ thuật (Từ điểm chi tiết):**

```
Điểm Kỹ thuật = [Σ(Điểm tiêu chí × Weight) / Σ(MaxScore × Weight)] × 100
```

**Ví dụ:**
- Tiêu chí 1: Điểm 80, MaxScore 100, Weight 30%
  - Weighted Score = 80 × 0.3 = 24
  - Max Weighted Score = 100 × 0.3 = 30
- Tiêu chí 2: Điểm 90, MaxScore 100, Weight 70%
  - Weighted Score = 90 × 0.7 = 63
  - Max Weighted Score = 100 × 0.7 = 70
- **Điểm Kỹ thuật** = [(24 + 63) / (30 + 70)] × 100 = **87**

#### **Tổng điểm:**

```
Tổng điểm = (Điểm Kỹ thuật × Weight Kỹ thuật) + (Điểm Tài chính × Weight Tài chính)
```

**Ví dụ:**
- Điểm Kỹ thuật: 87
- Weight Kỹ thuật: 30% (tổng weight của tất cả tiêu chí TECHNICAL)
- Điểm Tài chính: 100
- Weight Tài chính: 70% (tổng weight của tất cả tiêu chí FINANCIAL)
- **Tổng điểm** = (87 × 0.3) + (100 × 0.7) = 26.1 + 70 = **96.1**

### **6.6. Sửa/Xóa Tiêu chí**

**⚠️ CHỈ KHI `status = DRAFT`:**

- **Sửa**: Click nút **"Sửa"** (biểu tượng bút chì) → Chỉnh sửa → **"Lưu"**
- **Xóa**: Click nút **"Xóa"** (biểu tượng thùng rác) → Xác nhận

**Lưu ý:** Sau khi sửa/xóa, phải đảm bảo tổng Weight vẫn = 100% cho mỗi loại

### **6.7. Sao chép Tiêu chí từ Gói thầu khác**

**Cả Admin và Tender Manager:**

1. Chọn gói thầu ở trạng thái `DRAFT`
2. Click tab **"Tiêu chí chấm thầu"`
3. Click **"Sao chép từ gói thầu cũ"**
4. Chọn gói thầu nguồn từ dropdown
5. Xem preview thông tin tiêu chí
6. Click **"Xác nhận sao chép"**

✅ **Kết quả:** Tất cả tiêu chí từ gói thầu nguồn được sao chép sang gói thầu hiện tại

---

## 7. TROUBLESHOOTING

### **❌ Lỗi: "Không thể mở thầu"**

**Nguyên nhân:**
- Thiếu tiêu chí kỹ thuật hoặc tài chính
- Tổng Weight không bằng 100%

**Giải pháp:**
1. Kiểm tra tab **"Tiêu chí chấm thầu"**
2. Đảm bảo có ít nhất 1 tiêu chí Kỹ thuật và 1 tiêu chí Tài chính
3. Kiểm tra tổng Weight = 100% cho mỗi loại

---

### **❌ Lỗi: "Không thể chuyển sang chấm điểm"**

**Nguyên nhân:**
- Không có hồ sơ dự thầu hợp lệ

**Giải pháp:**
1. Kiểm tra tab **"Hồ sơ dự thầu"**
2. Đảm bảo có ít nhất 1 hồ sơ với `bidAmount > 0`

---

### **❌ Lỗi: "Không thể trao thầu"**

**Nguyên nhân:**
- Chưa chấm điểm đầy đủ cho tất cả hồ sơ
- Chưa có người thắng (ranking = 1)

**Giải pháp:**
1. Chấm điểm chi tiết cho tất cả hồ sơ
2. Click **"Tính điểm tự động"** để cập nhật xếp hạng
3. Đảm bảo có hồ sơ với `ranking = 1`

---

### **❌ Lỗi: "Không thấy giá dự thầu"**

**Nguyên nhân:**
- Gói thầu đang ở trạng thái `OPEN` (Sealed Bids)

**Giải pháp:**
- **Tender Manager:** Đợi đến khi gói thầu đóng (`CLOSED`)
- **Admin:** Click nút **"Xem giá (Admin Override)"** để override

---

### **❌ Lỗi: "Điểm không cập nhật"**

**Nguyên nhân:**
- Chưa click **"Tính điểm tự động"**
- Chưa lưu điểm chi tiết

**Giải pháp:**
1. Lưu điểm chi tiết cho từng tiêu chí
2. Click **"Tính điểm tự động"**
3. Refresh trang nếu cần

---

## 8. FAQ

### **Q1: Tại sao không thể mở thầu?**

**A:** Có thể do:
- Thiếu tiêu chí kỹ thuật hoặc tài chính
- Tổng Weight không bằng 100%
- Kiểm tra tab "Chuyển trạng thái" để xem chi tiết

---

### **Q2: Làm sao để tính điểm tự động?**

**A:** 
1. Chọn gói thầu
2. Tab "Tính điểm"
3. Click "Tính điểm tự động"
4. Hệ thống sẽ tự động tính Financial, Technical, Total và Ranking

---

### **Q3: Tại sao không thấy giá dự thầu?**

**A:** 
- Nếu gói thầu đang `OPEN`: Giá bị ẩn (Sealed Bids)
- **Tender Manager:** Đợi đến khi gói thầu đóng
- **Admin:** Click nút "Xem giá (Admin)" để override

---

### **Q4: Làm sao để trao thầu?**

**A:**
1. Chấm điểm đầy đủ cho tất cả hồ sơ
2. Tính điểm tự động
3. Đảm bảo có người thắng (ranking = 1)
4. **Chỉ Admin:** Click "→ Đã trao thầu"

---

### **Q5: Có thể sửa gói thầu sau khi mở không?**

**A:**
- ❌ **KHÔNG thể** sửa khi đã mở (`OPEN` trở đi)
- ✅ Chỉ có thể sửa khi `status = DRAFT`
- ✅ Có thể chuyển trạng thái hoặc hủy (nếu cần)

---

### **Q6: Điểm được tính như thế nào?**

**A:**
- **Điểm Tài chính:** `(Giá thấp nhất / Giá nhà thầu) × MaxScore`
- **Điểm Kỹ thuật:** `[Σ(Điểm tiêu chí × Weight) / Σ(MaxScore × Weight)] × 100`
- **Tổng điểm:** `(Điểm Kỹ thuật × Weight) + (Điểm Tài chính × Weight)`
- **Xếp hạng:** Sắp xếp theo tổng điểm giảm dần

---

### **Q7: Có thể hủy gói thầu đã trao không?**

**A:**
- ❌ **KHÔNG thể** hủy gói thầu đã trao (`AWARDED`)
- ✅ Có thể hủy từ các trạng thái khác (DRAFT, OPEN, CLOSED, GRADING)
- ✅ **Chỉ Admin** mới được hủy

---

### **Q8: Tender Manager có thể trao thầu không?**

**A:**
- ❌ **KHÔNG**, chỉ Admin mới được trao thầu
- Tender Manager cần yêu cầu Admin trao thầu sau khi chấm điểm xong

---

## 📝 KẾT LUẬN

Module Đấu thầu cung cấp hệ thống quản lý đấu thầu hoàn chỉnh với:

✅ **Tính năng đầy đủ:** Quản lý gói thầu, nhà thầu, hồ sơ, tiêu chí, chấm điểm tự động

✅ **Phân quyền rõ ràng:** Admin toàn quyền, Tender Manager quản lý và chấm điểm

✅ **Bảo mật:** Sealed Bids, Audit logging, Validation chặt chẽ

✅ **Dễ sử dụng:** UI/UX chuyên nghiệp, thông báo rõ ràng

