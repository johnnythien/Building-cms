# 📊 PHÂN TÍCH CƠ SỞ DỮ LIỆU — Building Management System (BMS)
**Database: QUANLYTHUCHI.sql**

---

## **1. 🏗️ TỔNG QUAN KIẾN TRÚC (High-Level Overview)**

### **📌 Phạm vi quản lý**

Database `QUANLYTHUCHI` quản lý **5 mảng nghiệp vụ chính** của một tòa nhà căn hộ:

| Mảng | Mô tả | Bảng Chính | Quy mô |
|------|-------|-----------|--------|
| 🏠 **Core/Infra** | Người dùng, tòa nhà, căn hộ, cư dân | Users, Buildings, Apartments, Customers | 8 bảng |
| 💰 **Tài Chính** | Hóa đơn, giao dịch, danh mục, báo cáo, thuế | Invoices, Transactions, Categories, Reports, TaxRules | 12 bảng |
| 🏆 **Đấu Thầu** | Thầu, hồ sơ bỏ giá, tiêu chí, điểm số | Tenders, Bids, TenderCriteria, BidCriteriaScores | 4 bảng |
| 💼 **Nhân Sự** | Lương nhân viên, quyền hạn | EmployeeSalaries, Users (role-based) | 1 bảng (+Users) |
| 📢 **Truyền Thông** | Tin tức, bài viết, bình luận, thông báo, bình chọn | News, Posts, Comments, Notifications, Votes | 5 bảng |

### **📊 Quy mô Database**

```
📋 Tổng số bảng:           ~30 bảng
   ├─ Core/Infra:         8 bảng (Users, Buildings, Apartments, Customers...)
   ├─ Finance:           12 bảng (Invoices, Transactions, TaxRules, TransactionTaxes...)
   ├─ Tender:             4 bảng (Tenders, Bids, TenderCriteria, BidCriteriaScores)
   ├─ Salary:             1 bảng (EmployeeSalaries)
   └─ Media/Community:    5 bảng (News, Posts, Comments, Notifications, Votes)

🔧 Tính năng nâng cao:
   ✅ Stored Procedures (5 cái):  sp_CalculateTaxes*, sp_TransitionTenderStatus, sp_AutoCloseExpired
   ✅ Triggers (1 cái):           TR_TenderCriteria_Freeze (bảo vệ tiêu chí)
   ✅ Constraints: FK (Foreign Key), UNIQUE, CHECK (kiểm tra trạng thái)
   ✅ Indexes:    Trên các cột thường xuyên filter (date, status, userId, tenderId...)
   ✅ Views:      Không (logic chủ yếu ở backend Node.js)
```

### **🔐 Cấu trúc dữ liệu**

- **Primary Keys**: INT (hầu hết), BIGINT (Users, Audit logs)
- **Lookups**: Categories (chi phí), TaxTypes (loại thuế), Contractors (nhà thầu)
- **Relationships**: Hierarchical (từ Infrastructure → Finance → Transactions)
- **Audit**: AuditLogs (ghi lại mọi thay đổi quan trọng)
- **Soft delete**: Không dùng (xóa cứng via ON DELETE CASCADE/NO ACTION)

---

## **2. 🧩 PHÂN TÍCH CÁC NHÓM BẢNG CHÍNH (Key Modules Breakdown)**

### **📦 NHÓM 1: CORE / INFRASTRUCTURE (Lõi hệ thống)**

**Bảng chính:**
- `Users` (Id BIGINT IDENTITY) — Đăng nhập & phân quyền (admin, manager, employee, resident)
- `Buildings` (Id INT) — Danh sách tòa nhà (name, address, floors, status)
- `Apartments` (Id INT) — Danh sách căn hộ (floor, area, rooms, buildingId FK, customerId FK)
- `Customers` (Id INT) — Cư dân (name, email, phone, address)

**Liên kết:**
```
Users (1) ──┐
            ├──> Apartments (N)
Customers (1) ──────┘

Buildings (1) ──> Apartments (N)

Apartments (1) ──> Invoices (N)
Apartments (1) ──> Posts (N)
Apartments (1) ──> Comments (N)
```

**Logic:**
- 1 cư dân (`Customers`) sở hữu 1-N căn hộ (`Apartments`)
- 1 tòa nhà (`Buildings`) chứa 1-N căn hộ
- 1 căn hộ → 1-N hóa đơn (`Invoices`)
- 1 căn hộ → 1-N bài viết/bình luận từ cư dân

---

### **💰 NHÓM 2: TÀI CHÍNH (Finance Module)**

**Bảng chính:**

| Bảng | Mô tả | Liên kết |
|------|-------|---------|
| `Categories` | Danh mục chi phí/thu (101-121: Phí dịch vụ, Lương, Điện...) | 1 bảng lookup |
| `Invoices` | Hóa đơn tháng (invoiceNumber, customerId, apartmentId, totalAmount, status) | FK to Customers, Apartments |
| `InvoiceItems` | Chi tiết hóa đơn (mô tả, amount, categoryId) | FK to Invoices, Categories |
| `Transactions` | Ghi sổ kế toán (amount, date, type='income'/'expense', status) | FK to Categories, Invoices, Apartments, Customers, Bids, Tenders... |
| `Reports` | Báo cáo tài chính (month, year, totalIncome, totalExpense, balance) | Lookup |
| `ReportDetails` + Childs | Phân tích chi tiết báo cáo | FK to Reports |
| `TaxTypes` | Loại thuế (VAT_OUTPUT, VAT_INPUT, PIT_RENTAL...) | Lookup (5 dòng) |
| `TaxRules` | Quy tắc áp dụng thuế (categoryId, taxTypeId, rate, startDate, endDate) | FK to Categories, TaxTypes |
| `TransactionTaxes` | Thuế chi tiết trên giao dịch (baseAmount, taxAmount, appliedRate) | FK to Transactions, TaxTypes |
| `InvoiceTaxes` | Tóm tắt thuế trên hóa đơn | FK to Invoices, TaxTypes |

**Luồng dữ liệu tài chính:**

```
        ┌─────────────────────────────────────────┐
        │    HÓA ĐƠN (Invoice) được tạo          │
        │  - customerId, apartmentId, totalAmount │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────┐
        │  INVOICE ITEMS (Chi tiết hóa đơn)   │
        │  - mô tả, amount, categoryId        │
        │  - Mỗi item = 1 dòng chi phí        │
        └────────┬────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────────────┐
        │  TẠO TRANSACTIONS (Ghi sổ)             │
        │  - 1 Invoice → 1-N Transactions        │
        │  - Mỗi item hoặc summary → 1 Trans     │
        │  - amount, date, categoryId, type      │
        └────────┬───────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────────────┐
        │  TÍNH THUẾ (Tax Engine)                │
        │  - Lấy TaxRules theo categoryId        │
        │  - Tính TransactionTaxes               │
        │  - Tính InvoiceTaxes (tóm tắt)         │
        │                                        │
        │  💡 Logic:                             │
        │  - Tax-Inclusive: bóc tách từ amount   │
        │  - Tax-Exclusive: tính thêm vào amount │
        │  - Miễn thuế: skip                     │
        └────────────────────────────────────────┘
```

**Các loại thuế:**
- **VAT Output** (10%) — Phí dịch vụ, phí gửi xe (tax-inclusive)
- **VAT Input** (10%) — Chi điện, nước, dịch vụ (tax-exclusive)
- **Phí Bảo Trì** (2%, miễn VAT) — Quỹ dự trữ
- **Thuế Thu Hộ** (5% PIT/VAT) — Cho thuê mặt bằng
- **Miễn Thuế** — Lương, thuế & lệ phí

---

### **🏆 NHÓM 3: ĐẤU THẦU (Tender / Bidding Module)**

**Bảng chính:**

| Bảng | Mô tả |
|------|-------|
| `Tenders` | Gói thầu (code, name, estimatedBudget, startDate, endDate, **status**: DRAFT/OPEN/CLOSED/GRADING/PENDING_APPROVAL/AWARDED/CANCELLED) |
| `TenderDocuments` | Tài liệu thầu (PDF, DOC cho mỗi thầu) |
| `TenderCriteria` | Tiêu chí đánh giá (Name, MaxScore, Weight, Type: TECHNICAL/FINANCIAL) |
| `Bids` | Hồ sơ bỏ giá (tenderId, contractorId, bidAmount, technicalScore, financialScore, totalScore, ranking, isWinner) |
| `BidCriteriaScores` | Điểm chi tiết từng tiêu chí (bidId, criteriaId, score, notes) |
| `Contractors` | Nhà thầu (name, taxCode, representative, status) |

**Quy trình Đấu Thầu (State Machine):**

```
┌─────────┐
│  DRAFT  │ ← Khởi tạo gói thầu + tiêu chí
└────┬────┘
     │ (Validate criteria: TechnicalWeight=100%, FinancialWeight=100%)
     ▼
┌─────────┐
│  OPEN   │ ← Nhà thầu bỏ giá + tải hồ sơ
└────┬────┘
     │ (Deadline hết hạn hoặc manual close)
     ▼
┌─────────────┐
│  CLOSED     │ ← Dừng tiếp nhận hồ sơ
└────┬────────┘
     │ (Xác nhận hồ sơ valid, chuẩn bị chấm)
     ▼
┌─────────────┐
│  GRADING    │ ← Chuyên gia chấm điểm kỹ thuật & tài chính
└────┬────────┘
     │ (Tính TechnicalScore + FinancialScore → TotalScore → Ranking)
     ├─► sp_CalculateFinancialScores(tenderId)   [Công thức: (LowestBid / BidAmount) * MaxScore]
     ├─► sp_CalculateTechnicalScores(tenderId)   [Công thức: Σ(score × weight) / ΣMaxScore × 100]
     └─► sp_CalculateTotalScoresAndRanking()     [TotalScore = Tech*Weight + Finance*Weight]
     │
     ▼
┌──────────────────────┐
│ PENDING_APPROVAL     │ ← Gửi kết quả cho admin phê duyệt
└────┬─────────────────┘
     │ (Admin kiểm tra & approve hoặc reject lại chấm)
     │
     ├─► APPROVE
     │   └─► AWARDED   ← Giao thầu cho người thắng (ranking=1, isWinner=1)
     │
     └─► REJECT (trả về GRADING)
         └─► [Comment + yêu cầu chấm lại]

┌─────────┐
│ AWARDED │ ← Người thắng đã được chọn → Tạo contract
└────┬────┘
     │
     ▼
┌─────────┐
│ CLOSED  │ ← Kết thúc gói thầu
└─────────┘

(Any Status) ──► CANCELLED (nếu hủy vì lý do)
```

**Điểm số & Xếp hạng:**
- **Điểm kỹ thuật** (Technical): 0-100 (từ tiêu chí TECHNICAL)
- **Điểm tài chính** (Financial): 0-100 (công thức: (LowestBid / ThisBid) × MaxScore)
- **Điểm tổng** = (Tech × 50%) + (Finance × 50%) [hay tùy weight]
- **Xếp hạng** = ORDER BY TotalScore DESC, BidAmount ASC
- **Người thắng** = Ranking = 1, IsWinner = 1

---

### **💼 NHÓM 4: LƯƠNG NHÂN VIÊN (Salary Management)**

**Bảng chính:**
- `EmployeeSalaries` (employeeId FK→Users, month, year, baseSalary, allowances, deductions, netSalary, status, paymentDate, transactionId FK→Transactions)

**Logic Tính Lương:**
```
┌──────────────────────────────────────┐
│  Nhân viên (Users)                   │
│  - fullName, email, role             │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│  Tạo EmployeeSalary (tháng/năm)                  │
│  - baseSalary (lương cơ bản)                     │
│  - allowances (phụ cấp: ăn, xăng, điện thoại...) │
│  - deductions (khấu trừ: BHXH, BHYT, Thuế TNCN..)│
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  Tính NetSalary                      │
│  netSalary = baseSalary + allowances │
│              - deductions            │
│                                      │
│  ⚠️ LÀM TRÒN: Math.round(netSalary)  │
│     (Lưu ý: Tiền tệ VNĐ không có    │
│      phần thập phân)                 │
└────────────┬─────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│  Tạo TRANSACTION (ghi sổ lương)        │
│  - amount = netSalary                  │
│  - date = paymentDate                  │
│  - type = 'expense'                    │
│  - categoryId = 103 (Lương nhân viên)  │
│  - status = 'pending' → 'paid'         │
└────────────┬───────────────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  Lưu vào DB                    │
│  - EmployeeSalaries            │
│  - Gắn transactionId           │
│  - Chờ Manager approve/pay     │
└────────────────────────────────┘
```

**Status Workflow:**
- `pending` → Chờ manager xác nhận
- `confirmed` → Manager đã xác nhận
- `paid` → Đã thanh toán cho nhân viên
- `received` → Nhân viên đã nhận tiền

---

### **📢 NHÓM 5: TRUYỀN THÔNG / CỘNG ĐỒNG (Media & Community)**

**Bảng chính:**

| Bảng | Mô tả |
|------|-------|
| `News` | Tin tức (author FK→Users, buildingId FK→Buildings, status: published/draft) |
| `Posts` | Bài viết từ cư dân (apartmentId, topic, status: pending/approved/rejected) |
| `Comments` | Bình luận (creatorId FK→Customers, apartmentId, feedbacks: JSON array) |
| `Notifications` | Thông báo (senderId FK→Users, buildingId, type, sendDate) |
| `Votes` | Bình chọn (CreatedById FK→Users, buildingId, StartDate, EndDate) |
| `VoteResults` | Kết quả bỏ phiếu (voteId, userId/residentId, choice) |

**Luồng Truyền Thông:**
```
MEDIA MANAGER tạo News → Publish → Cư dân xem
                ↓
CỘNG ĐỒNG: Cư dân Post ý kiến → Moderate → Approve/Reject
                ↓
BÌNH LUẬN: Cư dân comment → Staff feedback (JSON array)
                ↓
THÔNG BÁO: Manager gửi Notification → Cư dân nhận
                ↓
BÌNH CHỌN: Tạo Vote → Cư dân & Staff bỏ phiếu → Kết quả
```

---

## **3. 🔗 SƠ ĐỒ QUAN HỆ QUAN TRỌNG (ERD Highlights)**

### **📌 Mối Quan Hệ 1: Invoice → Transactions → TransactionTaxes**

```
┌──────────────────┐
│   INVOICES       │
│ (1 hóa đơn)      │
│ - invoiceNumber  │
│ - customerId     │
│ - totalAmount    │
│ - issueDate      │
└────────┬─────────┘
         │ (1-N)
         ▼
┌──────────────────────┐
│   INVOICE ITEMS      │
│ (chi tiết hóa đơn)   │
│ - description        │
│ - amount             │
│ - categoryId         │
└────────┬─────────────┘
         │ (Mỗi item sinh ra 1 Transaction)
         ▼
┌────────────────────────────┐
│   TRANSACTIONS             │
│ (ghi sổ kế toán)           │
│ - amount                   │
│ - date                     │
│ - categoryId (FK)          │
│ - invoiceId (FK)           │
│ - type ('income/expense')  │
│ - status                   │
└────────┬───────────────────┘
         │ (1-N)
         ▼
┌──────────────────────────────┐
│   TRANSACTION TAXES          │
│ (thuế chi tiết)              │
│ - transactionId (FK)         │
│ - taxTypeId (FK)             │
│ - baseAmount                 │
│ - taxAmount                  │
│ - appliedRate                │
│ - taxDirection               │
└──────────────────────────────┘
```

**Ý nghĩa:**
- Khi tạo Invoice → tạo 1-N InvoiceItems (mỗi loại chi phí)
- Mỗi InvoiceItem sinh ra 1 Transaction (ghi sổ)
- Mỗi Transaction có 1-N TransactionTaxes (tính VAT, PIT, v.v.)
- Được kiểm soát bằng **Stored Procedure**: `sp_CalculateTaxesForTransaction()` + `sp_CalculateTaxesForInvoice()`

---

### **📌 Mối Quan Hệ 2: Tenders → Bids → BidCriteriaScores → Tenders.selectedBidId**

```
┌──────────────────────────┐
│   TENDERS                │
│ (gói thầu)               │
│ - code, name             │
│ - status (DRAFT→...→AWARDED) │
│ - selectedBidId (FK→Bids) ◄─┐
└────────┬─────────────────┘  │
         │ (1-N)              │
         ▼                     │
┌──────────────────────────┐   │
│   TENDER CRITERIA        │   │
│ (tiêu chí đánh giá)      │   │
│ - Name                   │   │
│ - MaxScore, Weight       │   │
│ - Type (TECHNICAL/...)   │   │
└────────────┬─────────────┘   │
             │ (1-N)           │
             ▼                 │
┌──────────────────────────┐   │
│   BID CRITERIA SCORES    │   │
│ (điểm chi tiết)          │   │
│ - bidId (FK)             │   │
│ - criteriaId (FK)        │   │
│ - score (0-100)          │   │
│ - notes                  │   │
└────────────┬─────────────┘   │
             │                 │
             ├─► Tính TechnicalScore (Σ score × weight) │
             ├─► Tính FinancialScore ((LowestBid / bidAmount) × MaxScore)
             └─► Tính TotalScore = Tech + Finance
                 └─► Ranking (ORDER BY TotalScore DESC)
                     └─► isWinner = 1 (Ranking = 1)
                         └─────────────────────────┘
                             ↑
┌──────────────────────────┐  │
│   BIDS                   │  │
│ (hồ sơ bỏ giá)           │  │
│ - tenderId (FK)          │  │
│ - contractorId (FK)      │  │
│ - bidAmount              │  │
│ - technicalScore         │  │
│ - financialScore         │  │
│ - totalScore             │  │
│ - ranking                │  │
│ - isWinner ──────────────┘
│ - status                 │
└──────────────────────────┘
```

**Ý nghĩa:**
- 1 Tender có 1-N Bids (nhiều nhà thầu bỏ giá)
- 1 Bid được chấm điểm theo 1-N TenderCriteria
- Từ BidCriteriaScores tính ra TechnicalScore + FinancialScore → TotalScore
- Stored Procedure tự động tính ranking & chọn isWinner=1
- Tender.selectedBidId = Bids.Id (người thắng)

---

### **📌 Mối Quan Hệ 3: Users (Role-based) → EmployeeSalaries → Transactions**

```
┌──────────────────────────────┐
│   USERS                      │
│ (người dùng hệ thống)        │
│ - Id (BIGINT)                │
│ - email, password (bcrypt)   │
│ - role: admin/manager/       │
│         employee/resident    │
└────────┬─────────────────────┘
         │ (1-N, khi role='employee')
         ▼
┌──────────────────────────────┐
│   EMPLOYEE SALARIES          │
│ (bảng lương)                 │
│ - employeeId (FK→Users.Id)   │
│ - month, year                │
│ - baseSalary, allowances     │
│ - deductions                 │
│ - netSalary (rounded integer) │
│ - status: pending/confirmed/ │
│           paid/received      │
│ - transactionId (FK)         │
│ - approvedBy, paidBy (FK)    │
│ - allowanceDetails (JSON)    │
│ - deductionDetails (JSON)    │
└────────┬─────────────────────┘
         │ (1-1 linked)
         ▼
┌──────────────────────────────┐
│   TRANSACTIONS               │
│ (ghi sổ lương)               │
│ - amount (= netSalary)       │
│ - type = 'expense'           │
│ - categoryId = 103 (Lương)   │
│ - status: pending→paid       │
│ - employeeSalaryId (FK)      │
└──────────────────────────────┘
```

**Ý nghĩa:**
- Users với role='employee' hoặc 'manager' (nếu được trả lương)
- Mỗi tháng tạo EmployeeSalary record
- Tính netSalary theo công thức & làm tròn
- Tạo Transaction tương ứng để ghi sổ kế toán
- Manager phê duyệt → ghi Payment
- nhân viên xác nhận → ghi nhận thanh toán

---

## **4. ⚙️ LOGIC NGHIỆP VỤ TRONG SQL (Stored Procedures & Business Logic)**

### **🔴 Stored Procedure 1: `sp_CalculateTaxesForTransaction` (Tính thuế cho giao dịch)**

**Mục đích:** Tính chi tiết các loại thuế (VAT, PIT, v.v.) cho một giao dịch dựa trên quy tắc thuế.

**Input:**
- `@TransactionID` (INT) — ID của giao dịch

**Logic:**
```sql
1. Lấy thông tin giao dịch:
   - @BaseAmount (amount của transaction)
   - @CategoryID (danh mục chi phí)
   - @TransactionDate (ngày giao dịch)

2. Xóa các TransactionTaxes cũ (nếu tính lại)

3. Tìm các TaxRules áp dụng:
   - WHERE CategoryID = @CategoryID
   - AND IsExempt = 0 (không miễn thuế)
   - AND @TransactionDate BETWEEN StartDate AND EndDate (still valid)

4. Với mỗi rule, tính:
   - AppliedRate = RateOverride ISNULL DefaultRate
   
   - NẾU IsTaxInclusive = 1 (thuế đã bao gồm trong amount)
     └─► BaseAmount = @BaseAmount / (1 + Rate/100)  [bóc tách]
     └─► TaxAmount = @BaseAmount - BaseAmount
   
   - NẾU IsTaxInclusive = 0 (thuế tính riêng)
     └─► BaseAmount = @BaseAmount
     └─► TaxAmount = @BaseAmount * Rate / 100
   
   - TaxDirection = 'add' hoặc 'deduct' (từ TaxType)

5. INSERT vào TransactionTaxes
   - TransactionID, TaxTypeID, BaseAmount, AppliedRate, TaxAmount, Direction
```

**Ví dụ:**
```
Transaction: amount = 1200000 VNĐ, categoryId = 101 (Phí dịch vụ)

Rule 1: VAT Output 10%, Tax-Inclusive
  BaseAmount = 1200000 / 1.10 = 1090909.09
  TaxAmount = 1200000 - 1090909.09 = 109090.91
  Direction = 'add' (OUTPUT)

→ TransactionTaxes:
  TaxTypeID=1 (VAT_OUTPUT), 
  BaseAmount=1090909.09, 
  TaxAmount=109090.91, 
  AppliedRate=10.00, 
  Direction=OUTPUT
```

---

### **🔴 Stored Procedure 2: `sp_CalculateFinancialScores` (Tính điểm tài chính thầu)**

**Mục đích:** Tính điểm tài chính cho mỗi bỏ giá dựa trên công thức: **người bỏ giá thấp nhất được điểm cao nhất**.

**Input:**
- `@TenderId` (INT) — ID gói thầu

**Logic:**
```sql
1. Lấy giá thấp nhất:
   @LowestBidAmount = MIN(bidAmount) WHERE tenderId = @TenderId

2. Lấy MaxScore của Financial criteria:
   @FinancialCriteriaMaxScore = MAX(MaxScore) 
   WHERE tenderId = @TenderId AND Type = 'FINANCIAL'

3. Tính điểm tài chính cho mỗi bid:
   financialScore = (LowestBidAmount / ThisBidAmount) * MaxScore
   
   Ví dụ:
   - Bid A: amount = 100M → score = (100/100) * 100 = 100 (thắp nhất)
   - Bid B: amount = 110M → score = (100/110) * 100 = 90.9
   - Bid C: amount = 120M → score = (100/120) * 100 = 83.3

4. CAP điểm (không vượt MaxScore):
   UPDATE bids SET financialScore = MaxScore WHERE financialScore > MaxScore
```

---

### **🔴 Stored Procedure 3: `sp_CalculateTechnicalScores` (Tính điểm kỹ thuật)**

**Mục đích:** Tính điểm kỹ thuật cho mỗi bỏ giá từ các BidCriteriaScores.

**Input:**
- `@TenderId` (INT)

**Logic:**
```sql
1. Với mỗi bid, tính:
   technicalScore = SUM(score × weight) / SUM(maxScore × weight) × 100
   
   Ví dụ:
   Tiêu chí 1: maxScore=30, weight=30%, score=25
               weighted = 25 × 30% = 7.5
   Tiêu chí 2: maxScore=20, weight=20%, score=18
               weighted = 18 × 20% = 3.6
   ───────────────────────────────────────
   technicalScore = (7.5 + 3.6) / (30×30% + 20×20%) × 100
                  = 11.1 / 10 × 100 = 111%  (cap lại = 100)

2. UPDATE bids:
   technicalScore = (weighted sum) / (max weighted sum) × 100
```

---

### **🔴 Stored Procedure 4: `sp_CalculateTotalScoresAndRanking` (Tính tổng điểm & xếp hạng)**

**Mục đích:** Tính totalScore = (TechScore × TechWeight%) + (FinanceScore × FinanceWeight%), rồi xếp hạng.

**Input:**
- `@TenderId`

**Logic:**
```sql
1. Lấy tổng weight:
   @TechnicalWeight = SUM(Weight) WHERE Type='TECHNICAL'
   @FinancialWeight = SUM(Weight) WHERE Type='FINANCIAL'

2. Validate Weight:
   IF @TechnicalWeight + @FinancialWeight != 100%
      RAISERROR (yêu cầu cân bằng 100%)

3. Tính totalScore:
   totalScore = (technicalScore × @TechnicalWeight/100) 
              + (financialScore × @FinancialWeight/100)

4. Xếp hạng:
   ranking = ROW_NUMBER() OVER (ORDER BY totalScore DESC, bidAmount ASC)
   
   (Nếu totalScore bằng, người bỏ giá thấp hơn xếp trước)

5. Đánh dấu người thắng:
   isWinner = 1 WHERE ranking = 1
   isWinner = 0 WHERE ranking > 1
```

---

### **🔴 Stored Procedure 5: `sp_TransitionTenderStatus` (Chuyển trạng thái thầu)**

**Mục đích:** Validate & chuyển trạng thái thầu theo workflow (DRAFT→OPEN→CLOSED→GRADING→PENDING_APPROVAL→AWARDED/CANCELLED).

**Input:**
- `@TenderId`, `@NewStatus`, `@UserId`, `@CancelledReason`, `@TransitionReason`

**Logic (State Machine Validation):**

```
DRAFT → OPEN
  ✓ Phải có ≥1 TECHNICAL criteria, ≥1 FINANCIAL criteria
  ✓ TECHNICAL weight = 100%
  ✓ FINANCIAL weight = 100%
  ✓ startDate ≤ endDate

OPEN → CLOSED
  ✓ Không cần validation
  ✓ Tự động khi hết deadline (sp_AutoCloseExpiredTenders)

CLOSED → GRADING
  ✓ Phải có ≥1 bid hợp lệ (bidAmount > 0)

GRADING → PENDING_APPROVAL
  ✓ Chỉ Tender Manager / Admin
  ✓ Phải tất cả bids có điểm đầy đủ (technical + financial + total + ranking)
  ✓ Phải có 1 người thắng (ranking=1)

PENDING_APPROVAL → GRADING (từ chối)
  ✓ Chỉ Admin
  ✓ Phải có lý do (@TransitionReason)
  ✓ Ghi log audit (Reject grading result)

PENDING_APPROVAL → AWARDED
  ✓ Chỉ Admin
  ✓ Tất cả bids phải có điểm đầy đủ
  ✓ Cập nhật:
    - Tenders.status = 'AWARDED'
    - Tenders.awardedAt = GETDATE()
    - Bids.isWinner = 1, awardedAt, awardedBy (cho ranking=1)

Any → CANCELLED
  ✓ Không được hủy AWARDED
  ✓ Phải có @CancelledReason
  ✓ Cập nhật Tenders.cancelledAt, cancelledReason

Ngoài các transition trên → Error
```

---

### **🔴 Stored Procedure 6: `sp_AutoCloseExpiredTenders` (Tự động đóng thầu hết hạn)**

**Mục đích:** Tự động chuyển status OPEN → CLOSED khi hết deadline.

**Logic:**
```sql
UPDATE Tenders
SET status = 'CLOSED', closedAt = GETDATE()
WHERE status = 'OPEN' AND endDate <= GETDATE() AND closedAt IS NULL
```

---

### **🔴 Trigger: `TR_TenderCriteria_Freeze` (Niêm phong tiêu chí)**

**Mục đích:** Bảo vệ tiêu chí khỏi bị sửa sau khi gói thầu không còn ở DRAFT.

**Logic:**
```sql
WHEN INSERT/UPDATE/DELETE on TenderCriteria
IF Tender(tenderId).status ≠ 'DRAFT'
   RAISERROR("Không thể sửa Tiêu chí khi gói thầu đang hoạt động")
   ROLLBACK
```

---

## **5. 💡 CÂUHỎI BẢO VỆ ĐỒỒ ÁN (Defense Q&A)**

### **❓ Câu Hỏi 1: "Tại sao bảng Transactions cần JOIN với 8-9 bảng khác (Invoices, Bids, Tenders, Contractors, Employees, v.v.) thay vì tách riêng?"**

**Câu trả lời:**

Transactions là **bảng sử dụng chung** (universal journal) để ghi sổ kế toán. Nó cần liên kết với đa dạng nguồn dữ liệu vì:

1. **Tính đơn nhất hoá**: Tất cả giao dịch (Income từ Invoice, Expense từ Salary, Tender payments...) đều được ghi trong **1 bảng duy nhất**.
   
2. **Báo cáo tài chính**: Kế toán cần xem tổng doanh thu & chi phí từ tất cả nguồn, không thể tách biệt.
   
3. **Audit & Traceability**: Có thể trace 1 giao dịch → gốc gốc nó (Ví dụ: Transaction → invoiceId → Invoice → InvoiceItems → chi tiết).

**Thiết kế thay thế (tệ hơn):**
```
❌ TBD: Để có 3 bảng riêng:
  - InvoiceTransactions
  - SalaryTransactions
  - TenderPaymentTransactions
  
Vấn đề: Kế toán phải UNION 3 bảng → vô hiệu & dễ lỗi
```

**Thiết kế hiện tại (tốt):**
```
✅ 1 bảng Transactions với 8 FK (nullable):
  - invoiceId, bidId, tenderId, contractorId, employeeSalaryId, apartmentId, customerId
  - Chỉ fill 1 FK, còn lại NULL
  - Dễ query, dễ báo cáo, dễ audit
  
SELECT SUM(amount) FROM Transactions WHERE [date] BETWEEN ... GROUP BY [type]
  → thu được tổng ALL doanh thu & chi phí cùng lúc
```

---

### **❓ Câu Hỏi 2: "Tại sao TaxRules cần 2 cột: RateOverride và DefaultRate, đồng thời còn có IsExempt? Không dư thừa sao?"**

**Câu trả lời:**

3 cột này **giải quyết các trường hợp khác nhau**:

| Tình huống | Rule | DefaultRate | RateOverride | IsExempt | Kết quả |
|-----------|------|-------------|--------------|----------|---------|
| VAT 10% bình thường | VAT_OUTPUT | 10 | NULL | 0 | Dùng 10% |
| VAT tạm thời giảm 8% | VAT_OUTPUT | 10 | 8 | 0 | Dùng 8% (override) |
| Phí bảo trì (miễn VAT) | MAINTENANCE_FEE | 0 | NULL | **1** | Bỏ qua tính thuế |
| Lương (không chịu VAT) | SALARY | 10 | NULL | **1** | Bỏ qua tính VAT |

**Vì sao không gộp lại?**
```
❌ Phương án 1: Chỉ cột Rate
  IF rate = 0 THEN không tính → nhầm với thuế 0% vs miễn thuế
  
❌ Phương án 2: Chỉ cột IsExempt
  Nếu cần giảm 8% thì sao? Phải thêm cột Rate → vẫn cần 2 cột

✅ Phương án hiện tại:
  - IsExempt = 1: Bỏ qua (rõ ràng là "miễn", không phải "thuế 0%")
  - RateOverride: Giảm giá tạm thời, override DefaultRate
  - DefaultRate: Mặc định theo luật
```

---

### **❓ Câu Hỏi 3: "Sơ đồ dữ liệu Tender có 5 trạng thái (DRAFT, OPEN, CLOSED, GRADING, PENDING_APPROVAL, AWARDED). Tại sao phải có PENDING_APPROVAL thay vì GRADING → AWARDED trực tiếp?"**

**Câu trả lời:**

PENDING_APPROVAL là **checkpoint kiểm duyệt** quan trọng:

| Khi không có PENDING_APPROVAL | Với PENDING_APPROVAL |
|------|------|
| GRADING → AWARDED | GRADING → PENDING_APPROVAL → AWARDED |
| Chuyên gia chấm xong → tự động award → dễ lỗi | Chuyên gia chấm → gửi duyệt → Admin kiểm tra → phê chuẩn |
| Ai cũng có quyền award → bảo mật thấp | Chỉ Admin final approval → bảo mật cao |
| Không thể chỉnh điểm nếu admin thấy lỗi | Admin thấy lỗi → REJECT → GRADING (chấm lại) |
| Audit trail mờ nhạt | Audit log: who approved, when |

**Ví dụ thực tế:**
```
Scenario: Chuyên gia chấm điểm xong, kết quả score = 89/Bid A, 90/Bid B
→ Gửi PENDING_APPROVAL
→ Admin xem & phát hiện: Bid B mô tả kỹ thuật phê phán
→ Admin REJECT → quay lại GRADING
→ Chuyên gia xem lại bài → chấm lại: 92/Bid A, 85/Bid B
→ Gửi lại PENDING_APPROVAL
→ Admin thấy OK → AWARD
```

**Kết luận:** PENDING_APPROVAL = **Governance & Control**.

---

## **📋 TÓMLƯỢC KỸ THUẬT**

| Khía cạnh | Chi tiết |
|-----------|---------|
| **DB Size** | ~30 bảng, 300+ dòng seed data |
| **Relationship** | Hierarchical: Infrastructure → Finance → Transactions |
| **Stored Procedures** | 6 cái (Tax, Tender, Auto-close) |
| **Triggers** | 1 cái (Tender Criteria Freeze) |
| **Indexes** | ~40 cái (trên date, status, FK, unique) |
| **Constraints** | FK, UNIQUE, CHECK (status validation) |
| **Data Types** | INT, BIGINT IDENTITY, DECIMAL(18,2), NVARCHAR(MAX), DATE |
| **Audit** | AuditLogs table + stored procedure logging |

---

## **✅ KẾT LUẬN**

Database `QUANLYTHUCHI` được **thiết kế hợp lý & toàn diện** cho một hệ thống quản lý tòa nhà:

✅ **Bảo mật**: Role-based auth, Audit logs, Transaction control  
✅ **Tính toàn vẹn dữ liệu**: FK constraints, Triggers, CHECK constraints  
✅ **Hiệu suất**: Indexes trên các cột thường xuyên, Connection pooling  
✅ **Tính mở rộng**: Modular (Finance, Tender, Salary modules tách biệt)  
✅ **Governance**: PENDING_APPROVAL checkpoint, Workflow state machine  

**Điểm cần cải thiện:**
- Nên thêm **Views** cho báo cáo phức tạp (thay vì UNION ở application)
- Nên có **Stored Procedures version control** & testing
- Nên có **Database backup & disaster recovery plan**
