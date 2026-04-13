// Lightweight SQL-backed API server (Express + mssql)
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('./db-config');

const JWT_SECRET = process.env.JWT_SECRET || 'nhom1-building-super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

/**
 * Xử lý SQL errors và trả về message thân thiện với user
 * @param {Error} err - SQL error object
 * @param {string} defaultMessage - Default error message
 * @returns {Object} - { status, message, code }
 */
function handleSQLError(err, defaultMessage = 'Đã xảy ra lỗi. Vui lòng thử lại sau.') {
  if (!err || !err.number) {
    return {
      status: 500,
      message: defaultMessage,
      code: 'SQL_ERROR'
    };
  }

  const errorNumber = err.number;
  const errorMessage = err.message || '';

  // Foreign Key Constraint (547)
  if (errorNumber === 547) {
    // Kiểm tra xem có phải là foreign key constraint không
    if (errorMessage.includes('FOREIGN KEY') || errorMessage.includes('REFERENCES')) {
      return {
        status: 400,
        message: 'Không thể thực hiện thao tác này vì dữ liệu đang được sử dụng ở nơi khác.',
        code: 'FOREIGN_KEY_CONSTRAINT'
      };
    }
    // Có thể là check constraint
    return {
      status: 400,
      message: 'Dữ liệu không đáp ứng yêu cầu. Vui lòng kiểm tra lại.',
      code: 'CHECK_CONSTRAINT'
    };
  }

  // Duplicate Key (2627, 2601)
  if (errorNumber === 2627 || errorNumber === 2601) {
    // Trích xuất tên field từ error message
    let fieldName = 'Dữ liệu';
    const fieldMatch = errorMessage.match(/constraint ['"]([^'"]+)['"]/i);
    if (fieldMatch) {
      const constraintName = fieldMatch[1];
      // Extract field name (e.g., "IX_Users_Email" -> "Email")
      const nameMatch = constraintName.match(/_([A-Z][a-zA-Z]+)$/);
      if (nameMatch) {
        fieldName = nameMatch[1];
      }
    }

    return {
      status: 409, // Conflict
      message: `${fieldName} đã tồn tại. Vui lòng chọn giá trị khác.`,
      code: 'DUPLICATE_KEY'
    };
  }

  // Null Constraint (515)
  if (errorNumber === 515) {
    return {
      status: 400,
      message: 'Vui lòng điền đầy đủ thông tin bắt buộc.',
      code: 'NULL_CONSTRAINT'
    };
  }

  // Default: Return technical error (only in development)
  return {
    status: 500,
    message: process.env.NODE_ENV === 'development'
      ? `SQL Error ${errorNumber}: ${errorMessage}`
      : defaultMessage,
    code: `SQL_${errorNumber}`
  };
}

function generateJwtToken(user) {
  if (!user) return null;
  return jwt.sign(
    {
      sub: user.Id,
      userId: user.Id,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizeUser(user, token) {
  if (!user) return null;
  return {
    Id: user.Id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    token
  };
}

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return authHeader || null;
}

async function getCurrentUser(req) {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.sub;
    if (!userId) return null;

    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.BigInt, userId)
      .query('SELECT TOP 1 Id, role, fullName FROM dbo.Users WHERE Id = @id');
    if (!rs.recordset.length) return null;
    return {
      id: rs.recordset[0].Id,
      role: rs.recordset[0].role,
      fullName: rs.recordset[0].fullName || ''
    };
  } catch (err) {
    console.warn('[Auth] Invalid token:', err.message);
    return null;
  }
}

async function ensureSalaryCategoryId(pool) {
  const existing = await pool.request()
    .input('name', sql.NVarChar, 'Lương nhân viên')
    .query("SELECT TOP 1 Id FROM dbo.Categories WHERE name = @name AND [type] = 'expense'");

  if (existing.recordset.length) {
    return existing.recordset[0].Id;
  }

  const nextId = await getNextId('dbo.Categories', pool.request());

  await pool.request()
    .input('Id', sql.Int, nextId)
    .input('name', sql.NVarChar, 'Lương nhân viên')
    .input('type', sql.NVarChar, 'expense')
    .input('description', sql.NVarChar, 'Chi phí trả lương nhân viên')
    .query(`INSERT INTO dbo.Categories (Id, name, [type], description)
            VALUES (@Id, @name, @type, @description)`);

  return nextId;
}

async function createSalaryTransaction(pool, {
  amount,
  paymentDate,
  description,
  employeeName,
  month,
  year
}) {
  try {
    const categoryId = await ensureSalaryCategoryId(pool);
    const finalDescription = description || `Lương nhân viên ${employeeName || ''} - Tháng ${month}/${year}`;

    const rs = await pool.request()
      .input('amount', sql.Decimal(18, 2), amount)
      .input('date', sql.Date, paymentDate ? new Date(paymentDate) : new Date())
      .input('categoryId', sql.Int, categoryId)
      .input('description', sql.NVarChar, finalDescription.trim())
      .query(`
        INSERT INTO dbo.Transactions (amount, [date], categoryId, [description], [type], status)
        OUTPUT INSERTED.Id
        VALUES (@amount, @date, @categoryId, @description, 'expense', 'paid')
      `);

    return rs.recordset[0]?.Id || null;
  } catch (err) {
    console.error('[employee-salaries] Failed to create transaction:', err.message);
    return null;
  }
}

async function syncSalaryTransaction(pool, transactionId, {
  amount,
  paymentDate,
  description
}) {
  if (!transactionId) return;
  try {
    const fields = [];
    const request = pool.request().input('id', sql.Int, transactionId);

    if (amount !== undefined) {
      request.input('amount', sql.Decimal(18, 2), amount);
      fields.push('amount = @amount');
    }
    if (paymentDate !== undefined) {
      request.input('date', sql.Date, paymentDate ? new Date(paymentDate) : null);
      fields.push('[date] = @date');
    }
    if (description !== undefined) {
      request.input('description', sql.NVarChar, description || null);
      fields.push('[description] = @description');
    }

    if (!fields.length) return;

    await request.query(`
      UPDATE dbo.Transactions
      SET ${fields.join(', ')}
      WHERE Id = @id
    `);
  } catch (err) {
    console.error('[employee-salaries] Failed to sync transaction:', err.message);
  }
}

function normalizeJsonField(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  try {
    return JSON.stringify(value);
  } catch (err) {
    console.warn('[employee-salaries] Failed to stringify JSON field:', err.message);
    return null;
  }
}

function computeTimelineUpdatesOnCreate(status, currentUser) {
  return computeTimelineUpdatesOnTransition({}, status, currentUser);
}

function computeTimelineUpdatesOnTransition(existingRow = {}, nextStatus, currentUser) {
  const updates = {};
  if (!nextStatus) return updates;
  const now = new Date();
  const actingUserId = currentUser?.id || null;

  const ensureApproval = () => {
    if (!existingRow.approvedAt && updates.approvedAt === undefined) {
      updates.approvedAt = now;
      updates.approvedById = actingUserId;
    }
  };

  const ensurePaid = () => {
    if (!existingRow.paidAt && updates.paidAt === undefined) {
      updates.paidAt = now;
      updates.paidById = actingUserId;
    }
  };

  switch (nextStatus) {
    case 'confirmed':
      ensureApproval();
      break;
    case 'paid':
      ensureApproval();
      ensurePaid();
      break;
    case 'received':
      ensureApproval();
      ensurePaid();
      if (updates.acknowledgedAt === undefined) {
        updates.acknowledgedAt = now;
        updates.acknowledgedById = actingUserId;
      }
      break;
    default:
      break;
  }

  return updates;
}

async function linkTransactionToSalary(pool, transactionId, salaryId) {
  if (!transactionId || !salaryId) return;
  try {
    await pool.request()
      .input('transactionId', sql.Int, transactionId)
      .input('salaryId', sql.Int, salaryId)
      .query(`
        UPDATE dbo.Transactions
        SET employeeSalaryId = @salaryId
        WHERE Id = @transactionId
      `);
  } catch (err) {
    console.error('[employee-salaries] Failed to link transaction to salary:', err.message);
  }
}


async function syncAndTaxInvoiceItems(pool, invoiceId) {
  try {
    console.log(`Bắt đầu đồng bộ thuế cho Hóa đơn ID: ${invoiceId}...`);

    // 1. Lấy thông tin chính của Hóa đơn (để gán vào Giao dịch)
    const invoiceRes = await pool.request()
      .input('id', sql.Int, invoiceId)
      .query(`
        SELECT customerId, apartmentId, paidDate, status 
        FROM dbo.Invoices 
        WHERE Id = @id
      `);

    if (!invoiceRes.recordset.length) {
      console.error(`Không tìm thấy Hóa đơn ID: ${invoiceId}`);
      return;
    }
    const invoice = invoiceRes.recordset[0];

    // 2. Lấy TẤT CẢ các mục con (invoice items) của hóa đơn này
    const itemsRes = await pool.request()
      .input('id', sql.Int, invoiceId)
      .query(`
        SELECT categoryId, amount, description 
        FROM dbo.InvoiceItems 
        WHERE invoiceId = @id AND categoryId IS NOT NULL
      `);

    // 3. Xóa các Giao dịch và Thuế cũ liên quan đến hóa đơn này để đồng bộ lại
    //    (Database CASCADEs sẽ tự động xóa TransactionTaxes)
    await pool.request()
      .input('id', sql.Int, invoiceId)
      .query(`DELETE FROM dbo.Transactions WHERE invoiceId = @id`);

    // CHỈ TẠO GIAO DỊCH KHI HÓA ĐƠN ĐÃ THANH TOÁN
    // Nếu hóa đơn chỉ là 'pending' (chờ) hoặc 'overdue' (quá hạn)
    // chúng ta không nên tạo giao dịch (giao dịch = dòng tiền đã chạy)
    if (invoice.status !== 'paid' && invoice.status !== 'partial') {
      console.log(`Hóa đơn ${invoiceId} chưa thanh toán (status: ${invoice.status}). Không tạo giao dịch.`);
      return;
    }

    // 4. Lặp qua các mục con (1:N) và tạo Giao dịch + gọi Tax Engine
    for (const item of itemsRes.recordset) {
      // 4a. Tạo Giao dịch
      const transRes = await pool.request()
        .input('amount', sql.Decimal(18, 2), item.amount)
        .input('date', sql.Date, invoice.paidDate || new Date()) // Dùng ngày thanh toán, nếu không có thì dùng hôm nay
        .input('categoryId', sql.Int, item.categoryId)
        .input('description', sql.NVarChar, item.description)
        .input('type', sql.NVarChar, 'income')
        .input('invoiceId', sql.Int, invoiceId)
        .input('customerId', sql.Int, invoice.customerId)
        .input('apartmentId', sql.Int, invoice.apartmentId)
        .input('status', sql.NVarChar, 'paid')
        .query(`
          INSERT INTO dbo.Transactions (amount, [date], categoryId, description, [type], invoiceId, customerId, apartmentId, status)
OUTPUT INSERTED.Id
          VALUES (@amount, @date, @categoryId, @description, @type, @invoiceId, @customerId, @apartmentId, @status);
        `);

      const newTransactionId = transRes.recordset[0].Id;

      // 4b. TỰ ĐỘNG GỌI "BỘ NÃO THUẾ"
      if (newTransactionId) {
        console.log(`Gọi Tax Engine cho Giao dịch ID: ${newTransactionId}`);
        await pool.request()
          .input('TransactionID', sql.Int, newTransactionId)
          .execute('dbo.sp_CalculateTaxesForTransaction');
      }
    }
    console.log(`Hoàn tất đồng bộ ${itemsRes.recordset.length} mục cho Hóa đơn ID: ${invoiceId}.`);

  } catch (err) {
    console.error(`Lỗi nghiêm trọng khi đồng bộ Hóa đơn ID ${invoiceId}:`, err);
  }
}

/**
 * (Hàm lõi 3) Lấy báo cáo VAT
 * @param {object} pool - Đối tượng poolPromise đã kết nối.
 * @param {object} sql - Đối tượng 'mssql'.
 * @param {number} month - Tháng (1-12)
 * @param {number} year - Năm
 * @returns {Promise<object>} - Báo cáo VAT (Input, Output, Net)
 */
async function getVatReport(pool, sql, month, year) {
  console.log(`[TaxEngine] Lấy báo cáo VAT cho ${month}/${year}`);

  // Chỉ lấy 2 TaxTypeID chính: 1 (VAT_OUTPUT) và 2 (VAT_INPUT)
  // (Bỏ qua các loại thuế khoán)

  const reportRequest = pool.request();
  const result = await reportRequest
    .input('Month', sql.Int, month)
    .input('Year', sql.Int, year)
    .input('VatOutputID', sql.Int, 1) // Giả định ID 1 = VAT_OUTPUT
    .input('VatInputID', sql.Int, 2)  // Giả định ID 2 = VAT_INPUT
    .query(`
            SELECT 
                -- 1. Tính tổng ĐẦU RA (OUTPUT)
                (SELECT ISNULL(SUM(tt.TaxAmount), 0)
                 FROM dbo.TransactionTaxes tt
                 JOIN dbo.Transactions t ON tt.TransactionID = t.Id
                 WHERE tt.TaxTypeID = @VatOutputID 
                   AND tt.TaxDirection = 'OUTPUT'
                   AND MONTH(t.[date]) = @Month 
                   AND YEAR(t.[date]) = @Year
                ) AS TotalOutputVAT,
                
                -- 2. Tính tổng ĐẦU VÀO (INPUT)
                (SELECT ISNULL(SUM(tt.TaxAmount), 0)
                 FROM dbo.TransactionTaxes tt
                 JOIN dbo.Transactions t ON tt.TransactionID = t.Id
                 WHERE tt.TaxTypeID = @VatInputID
                   AND tt.TaxDirection = 'INPUT'
                   AND MONTH(t.[date]) = @Month 
                   AND YEAR(t.[date]) = @Year
                ) AS TotalInputVAT
        `);

  const report = result.recordset[0];
  const totalOutputVAT = parseFloat(report.TotalOutputVAT);
  const totalInputVAT = parseFloat(report.TotalInputVAT);
  const netVATPayable = totalOutputVAT - totalInputVAT; // (Output - Input)

  return {
    month: month,
    year: year,
    totalOutputVAT: totalOutputVAT,
    totalInputVAT: totalInputVAT,
    netVATPayable: netVATPayable
  };
}

/**
 * (Hàm lõi 4) Lấy danh sách các quy tắc thuế
 * @param {object} pool - Đối tượng poolPromise đã kết nối.
 * @param {object} sql - Đối tượng 'mssql'.
 * @returns {Promise<array>} - Danh sách quy tắc
 */
async function getTaxRules(pool, sql) {
  console.log(`[TaxEngine] Lấy danh sách quy tắc thuế (Rules)`);

  const request = pool.request();
  const result = await request.query(`
        SELECT 
            r.Id, r.Name, r.CategoryID, r.TaxTypeID, r.IsExempt, 
            r.RateOverride, r.StartDate, r.EndDate, r.Priority,
            c.Name AS CategoryName,
            t.Name AS TaxTypeName, t.Code AS TaxTypeCode,
            t.DefaultRate, t.DefaultDirection
        FROM dbo.TaxRules r
        LEFT JOIN dbo.Categories c ON r.CategoryID = c.Id
        LEFT JOIN dbo.TaxTypes t ON r.TaxTypeID = t.Id
        ORDER BY r.Priority ASC, c.Name ASC
    `);

  return result.recordset;
}

// ===== KẾT THÚC TAX ENGINE LOGIC =====

const app = express();

// Cấu hình body parser TRƯỚC cors để đảm bảo xử lý đúng
// Tăng giới hạn body size lên 50MB để hỗ trợ upload ảnh base64
app.use(express.json({ limit: '50mb', parameterLimit: 50000 }));
app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));

// CORS middleware
app.use(cors());

// ===== MIDDLEWARE =====

/**
 * Middleware: Inject database pool vào request
 * Giảm việc lặp lại "const pool = await poolPromise" ở mỗi endpoint
 */
app.use(async (req, res, next) => {
  try {
    req.pool = await poolPromise;
    next();
  } catch (err) {
    console.error('[Middleware] Database connection error:', err);
    return res.status(500).json({
      message: 'Lỗi kết nối database. Vui lòng thử lại sau.'
    });
  }
});

/**
 * Middleware: Parse và validate ID từ URL params
 * @param {string} paramName - Tên param (mặc định: 'id')
 */
const parseId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName], 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        message: `${paramName} không hợp lệ`
      });
    }
    req.parsedId = id;
    next();
  };
};

// Health check
app.get('/health/db', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request().query('SELECT DB_NAME() AS db');
    return res.json({ ok: true, db: result.recordset?.[0]?.db });
  } catch (err) {
    console.error('[health/db] error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Auth (basic; register + login + me)
app.post('/auth/register', async (req, res) => {
  try {
    // Chỉ log trong development để tránh lộ thông tin nhạy cảm
    if (process.env.NODE_ENV === 'development') {
      console.log('[auth/register] Request body:', req.body);
    }
    const { fullName, email, password, role } = req.body || {};

    if (!email || !password) {
      console.log('[auth/register] Missing email or password');
      return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    // Check if email already exists
    const exists = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE email = @email');

    if (exists.recordset.length > 0) {
      console.log('[auth/register] Email already exists:', email);
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Insert new user
    const insert = await pool.request()
      .input('fullName', sql.NVarChar, fullName || null)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, role || 'manager')
      .query(`INSERT INTO dbo.Users (fullName, email, password, role)
              OUTPUT INSERTED.Id, INSERTED.fullName, INSERTED.email, INSERTED.role
              VALUES (@fullName, @email, @password, @role)`);

    if (insert.recordset.length === 0) {
      console.log('[auth/register] Insert failed - no record returned');
      return res.status(500).json({ message: 'Lỗi tạo tài khoản' });
    }

    const newUser = insert.recordset[0];
    console.log('[auth/register] User created successfully:', newUser);

    const token = generateJwtToken(newUser);
    return res.status(201).json(sanitizeUser(newUser, token));
  } catch (err) {
    console.error('[auth/register] SQL Error:', err);
    console.error('[auth/register] Error details:', {
      message: err.message,
      code: err.code,
      number: err.number
    });
    const sqlError = handleSQLError(err, 'Lỗi đăng ký. Vui lòng thử lại sau.');
    return res.status(sqlError.status).json({
      message: sqlError.message,
      code: sqlError.code
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    // Chỉ log trong development để tránh lộ thông tin nhạy cảm
    if (process.env.NODE_ENV === 'development') {
      console.log('[auth/login] Request body:', req.body);
    }
    const { email, password } = req.body || {};

    if (!email || !password) {
      console.log('[auth/login] Missing email or password');
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    // Find user by email
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT TOP 1 Id, fullName, email, role, password FROM dbo.Users WHERE email = @email');

    if (result.recordset.length === 0) {
      console.log('[auth/login] Invalid credentials for email:', email);
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    let user = result.recordset[0];
    console.log('[auth/login] User found:', { id: user.Id, email: user.email, role: user.role });

    let passwordMatches = false;
    if (user.password && user.password.startsWith('$2')) {
      passwordMatches = await bcrypt.compare(password, user.password);
    } else {
      passwordMatches = user.password === password;
      if (passwordMatches) {
        const upgraded = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        await pool.request()
          .input('hash', sql.NVarChar, upgraded)
          .input('id', sql.BigInt, user.Id)
          .query('UPDATE dbo.Users SET password = @hash WHERE Id = @id');
        user.password = upgraded;
        console.log('[auth/login] Upgraded plaintext password to bcrypt hash');
      }
    }

    if (!passwordMatches) {
      console.log('[auth/login] Password mismatch for email:', email);
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const token = generateJwtToken(user);

    console.log('[auth/login] Login successful, returning user data');
    return res.json(sanitizeUser(user, token));
  } catch (err) {
    console.error('[auth/login] SQL Error:', err);
    console.error('[auth/login] Error details:', {
      message: err.message,
      code: err.code,
      number: err.number
    });
    const sqlError = handleSQLError(err, 'Lỗi đăng nhập. Vui lòng thử lại sau.');
    return res.status(sqlError.status).json({
      message: sqlError.message,
      code: sqlError.code
    });
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - No token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (verifyErr) {
      console.error('[auth/me] Invalid token:', verifyErr.message);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request()
      .input('id', sql.BigInt, decoded.userId || decoded.sub)
      .query('SELECT TOP 1 Id, fullName, email, role FROM dbo.Users WHERE Id = @id');
    if (!result.recordset.length) return res.status(401).json({ message: 'Unauthorized' });
    return res.json(result.recordset[0]);
  } catch (err) {
    console.error('[auth/me] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy thông tin người dùng' });
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Helper to run a simple SELECT * with optional order
 * ⚠️ Duplicated logic note: prefer explicit field aliasing over this generic helper
 * to keep API contracts stable. Retained only for a few legacy endpoints.
 */
async function simpleList(req, res, table, orderBy) {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const query = `SELECT * FROM ${table} ${orderBy ? 'ORDER BY ' + orderBy : ''}`;
    const result = await pool.request().query(query);
    return res.json(result.recordset);
  } catch (err) {
    console.error(`[GET ${table}] error:`, err);
    return res.status(500).json({ message: `Lỗi lấy dữ liệu ${table}` });
  }
}

/**
 * Helper: Tính nextId cho bảng (tránh lặp code)
 * @param {string} tableName - Tên bảng (VD: 'dbo.Categories')
 * @param {object} request - SQL request object (pool.request() hoặc transaction.request())
 * @returns {Promise<number>} - Next ID
 */
async function getNextId(tableName, request) {
  const nextIdRs = await request.query(`SELECT ISNULL(MAX(Id),0)+1 AS nextId FROM ${tableName}`);
  return nextIdRs.recordset?.[0]?.nextId || 1;
}

/**
 * Helper: Xử lý lỗi và trả response chuẩn
 * @param {object} res - Express response object
 * @param {Error} err - Error object
 * @param {string} endpoint - Endpoint name (for logging)
 * @param {string} defaultMessage - Default error message
 * @param {number} defaultStatus - Default status code
 */
function handleError(res, err, endpoint, defaultMessage = 'Đã xảy ra lỗi', defaultStatus = 500) {
  console.error(`[${endpoint}] error:`, err);
  const sqlError = handleSQLError(err, defaultMessage);
  return res.status(sqlError.status || defaultStatus).json({
    message: sqlError.message,
    code: sqlError.code,
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
}

/**
 * Helper: Lấy tên từ related table (cho việc populate name fields)
 * @param {object} pool - SQL pool
 * @param {string} tableName - Tên bảng (VD: 'dbo.Customers')
 * @param {number|string} id - ID cần lookup
 * @param {string} nameField - Tên field chứa name (VD: 'name', 'fullName')
 * @returns {Promise<string>} - Name hoặc empty string
 */
async function getRelatedName(pool, tableName, id, nameField = 'name') {
  if (!id) return '';
  try {
    const idType = tableName.includes('Users') ? sql.BigInt : sql.Int;
    const rs = await pool.request()
      .input('id', idType, id)
      .query(`SELECT TOP 1 ${nameField} FROM ${tableName} WHERE Id = @id`);
    return rs.recordset[0]?.[nameField] || '';
  } catch (err) {
    console.warn(`[getRelatedName] Failed to get name from ${tableName} for id ${id}:`, err.message);
    return '';
  }
}

/**
 * Helper: Kiểm tra record có tồn tại không
 * @param {Array} recordset - Kết quả query từ SQL
 * @param {string} entityName - Tên entity (VD: 'cư dân', 'danh mục')
 * @returns {Object} - Record đầu tiên
 * @throws {Error} - Nếu không tìm thấy record
 */
function checkRecordExists(recordset, entityName = 'bản ghi') {
  if (!recordset || !recordset.length) {
    const error = new Error(`Không tìm thấy ${entityName}`);
    error.status = 404;
    throw error;
  }
  return recordset[0];
}

// Core lists
// Dashboard aggregates
app.get('/dashboard', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const [residents, apartments, income, expense] = await Promise.all([
      pool.request().query('SELECT COUNT(1) AS total FROM dbo.Customers'),
      pool.request().query('SELECT COUNT(1) AS total FROM dbo.Apartments'),
      pool.request().query("SELECT ISNULL(SUM(CASE WHEN [type]='income' THEN amount END),0) AS total FROM dbo.Transactions"),
      pool.request().query("SELECT ISNULL(SUM(CASE WHEN [type]='expense' THEN amount END),0) AS total FROM dbo.Transactions"),
    ]);
    return res.json({
      totalResidents: Number(residents.recordset[0].total || 0),
      totalApartments: Number(apartments.recordset[0].total || 0),
      totalRevenue: Number(income.recordset[0].total || 0),
      totalExpense: Number(expense.recordset[0].total || 0)
    });
  } catch (err) {
    console.error('[GET /dashboard] error:', err);
    return res.status(500).json({ message: 'Lỗi tải bảng điều khiển' });
  }
});

// Categories CRUD with aliases matching UI
app.get('/categories', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT CAST(Id AS INT) AS id, ISNULL(name,'') AS name, ISNULL([type],'') AS type, ISNULL([description],'') AS description
      FROM dbo.Categories ORDER BY Id ASC`);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET categories] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách danh mục' });
  }
});

app.post('/categories', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const { name, type, description } = req.body || {};

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc' });
    }

    // Thử nhiều lần để tránh race condition khi nhiều request cùng tạo cùng lúc
    const maxAttempts = 5;
    let inserted = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nextId = await getNextId('dbo.Categories', pool.request());

      try {
        const rs = await pool.request()
          .input('Id', sql.Int, nextId)
          .input('name', sql.NVarChar(200), String(name).trim())
          .input('type', sql.NVarChar(50), type ? String(type).trim() : null)
          .input('description', sql.NVarChar(1000), description ? String(description) : null)
          .query(`
            INSERT INTO dbo.Categories (Id, name, type, description)
            OUTPUT INSERTED.Id, INSERTED.name, INSERTED.type, INSERTED.description
            VALUES (@Id, @name, @type, @description)
          `);

        inserted = rs.recordset?.[0] || null;
        break; // thành công
      } catch (err) {
        // Nếu là lỗi duplicate key do race, thử lại; else ném lỗi
        if (err && (err.number === 2627 || err.number === 2601)) {
          continue;
        }
        throw err;
      }
    }

    if (!inserted) {
      return res.status(500).json({ success: false, message: 'Không thể tạo danh mục do xung đột Id. Vui lòng thử lại.' });
    }

    return res.status(201).json({ success: true, category: inserted });
  } catch (err) {
    console.error('[POST /categories] error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi tạo danh mục', error: err.message });
  }
});

app.put('/categories/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const { name, type, description } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('type', sql.NVarChar, type)
      .input('description', sql.NVarChar, description)
      .query(`UPDATE dbo.Categories SET name=@name, [type]=@type, [description]=@description
              OUTPUT INSERTED.Id, INSERTED.name, INSERTED.[type], INSERTED.[description]
              WHERE Id=@id`);
    const row = checkRecordExists(rs.recordset, 'danh mục'); // Sử dụng helper
    return res.json({ id: row.Id, name: row.name, type: row.type, description: row.description });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[PUT categories/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật danh mục' });
  }
});

app.delete('/categories/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Categories WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE categories/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa danh mục' });
  }
});
// Customers with explicit field aliases expected by frontend
app.get('/customers', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(Id AS INT) AS id,
        ISNULL(name, '') AS name,
        ISNULL(email, '') AS email,
        ISNULL(phone, '') AS phone,
        ISNULL(address, '') AS address
      FROM dbo.Customers
      ORDER BY Id ASC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET customers] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách cư dân' });
  }
});

// Buildings with aliases used in UI
app.get('/buildings', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(Id AS INT) AS id,
        ISNULL(name, '') AS name,
        ISNULL(floors, 0) AS floors
      FROM dbo.Buildings
      ORDER BY Id ASC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET buildings] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách tòa nhà' });
  }
});
app.get('/apartments', async (req, res) => {
  const customerId = req.query.customerId;
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    if (customerId) {
      const result = await pool.request()
        .input('customerId', sql.Int, parseInt(customerId, 10))
        .query(`
          SELECT 
            CAST(Id AS INT) AS id,
            ISNULL(name, '') AS name,
            CAST(ISNULL(floor, 0) AS INT) AS floor,
            CAST(ISNULL(buildingId, 0) AS INT) AS buildingId,
            CAST(ISNULL(area, 0) AS INT) AS area,
            CAST(ISNULL(rooms, 0) AS INT) AS rooms,
            CAST(customerId AS INT) AS customerId
          FROM dbo.Apartments
          WHERE customerId = @customerId
          ORDER BY Id ASC`);
      return res.json(result.recordset);
    }
    const result = await pool.request().query(`
      SELECT 
        CAST(Id AS INT) AS id,
        ISNULL(name, '') AS name,
        CAST(ISNULL(floor, 0) AS INT) AS floor,
        CAST(ISNULL(buildingId, 0) AS INT) AS buildingId,
        CAST(ISNULL(area, 0) AS INT) AS area,
        CAST(ISNULL(rooms, 0) AS INT) AS rooms,
        CAST(customerId AS INT) AS customerId
      FROM dbo.Apartments
      ORDER BY Id ASC`);
    return res.json(result.recordset);
  } catch (err) {
    console.error('[GET apartments] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách căn hộ' });
  }
});

// Users endpoint - Get all users (for employee salary management)
app.get('/users', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(Id AS BIGINT) AS id,
        ISNULL(fullName, '') AS fullName,
        ISNULL(email, '') AS email,
        ISNULL(role, '') AS role,
        CONVERT(varchar(19), CreatedAt, 126) AS createdAt,
        CONVERT(varchar(19), UpdatedAt, 126) AS updatedAt
      FROM dbo.Users
      ORDER BY Id ASC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET users] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách người dùng' });
  }
});

// Users endpoint - Get single user by ID
app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT 
          CAST(Id AS BIGINT) AS id,
          ISNULL(fullName, '') AS fullName,
          ISNULL(email, '') AS email,
          ISNULL(role, '') AS role,
          CONVERT(varchar(19), CreatedAt, 126) AS createdAt,
          CONVERT(varchar(19), UpdatedAt, 126) AS updatedAt
        FROM dbo.Users
        WHERE Id = @id
      `);
    if (rs.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[GET users/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy thông tin người dùng' });
  }
});

// Users endpoint - Create new user (for admin to add employees)
app.post('/users', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    // Check if email already exists
    const exists = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE email = @email');

    if (exists.recordset.length > 0) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Insert new user
    const insert = await pool.request()
      .input('fullName', sql.NVarChar, fullName || null)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, role || 'manager')
      .query(`INSERT INTO dbo.Users (fullName, email, password, role)
              OUTPUT INSERTED.Id, INSERTED.fullName, INSERTED.email, INSERTED.role
              VALUES (@fullName, @email, @password, @role)`);

    if (insert.recordset.length === 0) {
      return res.status(500).json({ message: 'Lỗi tạo người dùng' });
    }

    const newUser = insert.recordset[0];
    return res.status(201).json({
      id: newUser.Id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    });
  } catch (err) {
    console.error('[POST /users] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo người dùng: ' + err.message });
  }
});

// Users endpoint - Update user
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, password, role } = req.body || {};

    const pool = req.pool; // Sử dụng pool từ middleware

    // Check if user exists
    const existing = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT TOP 1 Id, email FROM dbo.Users WHERE Id = @id');

    if (existing.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // If email is being changed, check if new email already exists
    if (email && email !== existing.recordset[0].email) {
      const emailExists = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT TOP 1 Id FROM dbo.Users WHERE email = @email AND Id != @id');

      if (emailExists.recordset.length > 0) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    // Build update query dynamically
    let updateFields = [];
    const request = pool.request().input('id', sql.BigInt, id);

    if (fullName !== undefined) {
      updateFields.push('fullName = @fullName');
      request.input('fullName', sql.NVarChar, fullName || null);
    }
    if (email !== undefined) {
      updateFields.push('email = @email');
      request.input('email', sql.NVarChar, email);
    }
    if (role !== undefined) {
      updateFields.push('role = @role');
      request.input('role', sql.NVarChar, role);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      updateFields.push('password = @password');
      request.input('password', sql.NVarChar, hashedPassword);
    }

    updateFields.push('UpdatedAt = SYSUTCDATETIME()');

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'Không có trường nào để cập nhật' });
    }

    const updateQuery = `
      UPDATE dbo.Users
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.Id, INSERTED.fullName, INSERTED.email, INSERTED.role
      WHERE Id = @id
    `;

    const result = await request.query(updateQuery);

    const updatedUser = checkRecordExists(result.recordset, 'người dùng'); // Sử dụng helper

    return res.json({
      id: updatedUser.Id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      role: updatedUser.role
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[PUT /users/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật người dùng: ' + err.message });
  }
});

// Users endpoint - Delete user
app.delete('/users/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware

    // Check if user exists
    const existing = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE Id = @id');

    checkRecordExists(existing.recordset, 'người dùng'); // Sử dụng helper

    // Delete user (CASCADE will handle related records)
    await pool.request()
      .input('id', sql.BigInt, id)
      .query('DELETE FROM dbo.Users WHERE Id = @id');

    return res.json({ message: 'Xóa người dùng thành công' });
  } catch (err) {
    console.error('[DELETE /users/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa người dùng: ' + err.message });
  }
});

// Joined view for apartments (optional, for readable names)
app.get('/apartments/view', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request().query(`
      SELECT 
        a.Id AS id,
        a.name,
        a.floor,
        a.buildingId,
        a.area,
        a.rooms,
        a.customerId,
        b.name AS buildingName,
        ISNULL(c.name, ISNULL(c.fullName, '')) AS residentName
      FROM dbo.Apartments a
      LEFT JOIN dbo.Buildings b ON a.buildingId = b.Id
      LEFT JOIN dbo.Customers c ON a.customerId = c.Id
      ORDER BY a.Id ASC`);
    return res.json(result.recordset);
  } catch (err) {
    console.error('[GET apartments/view] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách căn hộ (view)' });
  }
});

// Transactions CRUD with aliases
app.get('/transactions', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT CAST(Id AS INT) AS id,
             CONVERT(varchar(10), [date], 23) AS [date],
             CAST(amount AS float) AS amount,
             ISNULL([type],'') AS [type],
             ISNULL([description],'') AS [description],
             CAST(categoryId AS INT) AS categoryId,
             CAST(invoiceId AS INT) AS invoiceId
      FROM dbo.Transactions
      ORDER BY Id DESC`);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET transactions] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách giao dịch' });
  }
});

app.post('/transactions', async (req, res) => {
  try {
    const { date, amount, type, description, categoryId, invoiceId } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    const ins = await pool.request()
      .input('date', sql.Date, date)
      .input('amount', sql.Float, amount ? parseFloat(amount) : 0)
      .input('type', sql.NVarChar, type)
      .input('description', sql.NVarChar, description)
      .input('categoryId', sql.Int, categoryId || null)
      .input('invoiceId', sql.Int, invoiceId || null)
      .query(`
        /*  Xóa "Id" khỏi danh sách cột INSERT */
        INSERT INTO dbo.Transactions ([date], amount, [type], [description], categoryId, invoiceId, status)
        OUTPUT INSERTED.Id, CONVERT(varchar(10), INSERTED.[date], 23) AS [date], INSERTED.amount, INSERTED.[type], INSERTED.[description], INSERTED.categoryId, INSERTED.invoiceId
        /*  Xóa "@Id" khỏi danh sách VALUES */
        VALUES (@date, @amount, @type, @description, @categoryId, @invoiceId, 'paid')
      `);

    const newTransaction = ins.recordset[0];
    const newTransactionId = newTransaction.Id;
    if (newTransactionId && newTransaction.categoryId) {
      console.log(` Giao dịch thủ công ${newTransactionId} được tạo. Đang gọi Tax Engine...`);
      await pool.request()
        .input('TransactionID', sql.Int, newTransactionId)
        .execute('dbo.sp_CalculateTaxesForTransaction');
      console.log(`Hoàn tất tính thuế cho ${newTransactionId}.`);
    }

    return res.status(201).json(newTransaction);

  } catch (err) {
    console.error('[POST transactions] error:', err);
    return res.status(500).json({ message: 'Lỗi thêm giao dịch' });
  }
});

app.put('/transactions/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const { date, amount, type, description, categoryId, invoiceId } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    // 1. Cập nhật giao dịch
    const up = await pool.request()
      .input('id', sql.Int, id)
      .input('date', sql.Date, date)
      .input('amount', sql.Float, amount ? parseFloat(amount) : 0)
      .input('type', sql.NVarChar, type)
      .input('description', sql.NVarChar, description)
      .input('categoryId', sql.Int, categoryId || null)
      .input('invoiceId', sql.Int, invoiceId || null)
      .query(`UPDATE dbo.Transactions SET [date]=@date, amount=@amount, [type]=@type, [description]=@description, categoryId=@categoryId, invoiceId=@invoiceId
              OUTPUT INSERTED.Id, CONVERT(varchar(10), INSERTED.[date], 23) AS [date], INSERTED.amount, INSERTED.[type], INSERTED.[description], INSERTED.categoryId, INSERTED.invoiceId
              WHERE Id=@id`);

    const updatedTransaction = checkRecordExists(up.recordset, 'giao dịch'); // Sử dụng helper

    // 2. [LUỒNG TỰ ĐỘNG 2] Kích hoạt "bộ não" thuế để TÍNH TOÁN LẠI
    //    SP này rất thông minh: nó sẽ xóa thuế cũ và tính lại từ đầu.
    //    Nếu bạn xóa categoryId (thành null), nó sẽ xóa hết thuế cũ.
    console.log(`[Sync 2] Giao dịch thủ công ${id} được cập nhật. Đang TÁI TÍNH TOÁN thuế...`);
    await pool.request()
      .input('TransactionID', sql.Int, id) // Dùng 'id' từ params
      .execute('dbo.sp_CalculateTaxesForTransaction');
    console.log(`[Sync 2] Hoàn tất tái tính thuế cho ${id}.`);

    return res.json(updatedTransaction);

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[PUT transactions/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật giao dịch' });
  }
});

app.delete('/transactions/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Transactions WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE transactions/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa giao dịch' });
  }
});

// Transaction view with joins
app.get('/transactions/view', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT t.Id AS id,
             CONVERT(varchar(10), t.[date], 23) AS [date],
             t.amount,
             t.[type],
             t.[description],
             t.categoryId,
             c.name AS categoryName,
             t.invoiceId,
             i.invoiceNumber
      FROM dbo.Transactions t
      LEFT JOIN dbo.Categories c ON t.categoryId = c.Id
      LEFT JOIN dbo.Invoices i ON t.invoiceId = i.Id
      ORDER BY t.Id DESC`);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET transactions/view] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách giao dịch (view)' });
  }
});

// Get transaction taxes (thuế của một giao dịch)
app.get('/transactions/:id/taxes', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware (đã validate)

    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          tt.Id,
          tt.TransactionID,
          tt.TaxTypeID,
          tt.BaseAmount,
          tt.AppliedRate,
          tt.TaxAmount,
          tt.TaxDirection,
          taxType.Code AS TaxTypeCode,
          taxType.Name AS TaxTypeName
        FROM dbo.TransactionTaxes tt
        JOIN dbo.TaxTypes taxType ON tt.TaxTypeID = taxType.Id
        WHERE tt.TransactionID = @id
        ORDER BY tt.TaxDirection DESC, taxType.Code ASC
      `);

    return res.json(result.recordset);
  } catch (err) {
    console.error('[GET /transactions/:id/taxes] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy thông tin thuế', error: err.message });
  }
});

// Get transactions with tax summary (tổng thuế của mỗi giao dịch)
app.get('/transactions/with-taxes', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        t.Id AS id,
        CONVERT(varchar(10), t.[date], 23) AS [date],
        CAST(t.amount AS float) AS amount,
        ISNULL(t.[type],'') AS [type],
        ISNULL(t.[description],'') AS [description],
        CAST(t.categoryId AS INT) AS categoryId,
        CAST(t.invoiceId AS INT) AS invoiceId,
        ISNULL(SUM(tt.TaxAmount), 0) AS totalTaxAmount,
        COUNT(tt.Id) AS taxCount
      FROM dbo.Transactions t
      LEFT JOIN dbo.TransactionTaxes tt ON t.Id = tt.TransactionID
      GROUP BY t.Id, t.[date], t.amount, t.[type], t.[description], t.categoryId, t.invoiceId
      ORDER BY t.Id DESC`);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET transactions/with-taxes] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách giao dịch kèm thuế' });
  }
});

// ===== Invoice Routes =====

// Get all invoices with joined customer and apartment details
app.get('/invoices', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request().query(`
      SELECT 
        i.Id as id,
        i.invoiceNumber,
        CAST(i.customerId AS INT) AS customerId,
        CAST(i.apartmentId AS INT) AS apartmentId,
        CONVERT(varchar(10), i.issueDate, 23) as issueDate,
        CONVERT(varchar(10), i.dueDate, 23) as dueDate,
        i.status,
        CAST(i.totalAmount AS float) as totalAmount,
        CAST(i.paidAmount AS float) as paidAmount,
        CONVERT(varchar(10), i.paidDate, 23) as paidDate,
        ISNULL(i.notes, '') as notes,
        ISNULL(c.name, '') as customerName,
        ISNULL(a.name, '') as apartmentName,
        ISNULL(a.name, '') as apartment -- duplicate alias for frontends expecting 'apartment'
      FROM dbo.Invoices i
      LEFT JOIN dbo.Customers c ON i.customerId = c.Id
      LEFT JOIN dbo.Apartments a ON i.apartmentId = a.Id
      ORDER BY i.Id DESC
    `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('[GET /invoices] error:', err);
    return res.status(500).json({ message: 'Error fetching invoices', error: err.message });
  }
});

// Get invoice by ID with details and items
app.get('/invoices/:id', parseId(), async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const id = req.parsedId; // Sử dụng ID từ middleware (đã validate)

    const invRs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          i.Id as id,
          i.invoiceNumber,
          CAST(i.customerId AS INT) AS customerId,
          CAST(i.apartmentId AS INT) AS apartmentId,
          CONVERT(varchar(10), i.issueDate, 23) as issueDate,
          CONVERT(varchar(10), i.dueDate, 23) as dueDate,
          i.status,
          CAST(i.totalAmount AS float) as totalAmount,
          CAST(i.paidAmount AS float) as paidAmount,
          CONVERT(varchar(10), i.paidDate, 23) as paidDate,
          ISNULL(i.notes, '') as notes,
          ISNULL(c.name, '') as customerName,
          ISNULL(a.name, '') as apartmentName,
          ISNULL(a.name, '') as apartment
        FROM dbo.Invoices i
        LEFT JOIN dbo.Customers c ON i.customerId = c.Id
        LEFT JOIN dbo.Apartments a ON i.apartmentId = a.Id
        WHERE i.Id = @id
      `);

    const invoice = checkRecordExists(invRs.recordset, 'hóa đơn'); // Sử dụng helper

    const itemsRs = await pool.request()
      .input('invoiceId', sql.Int, id)
      .query(`SELECT Id, invoiceId, ISNULL(description,'') AS description, CAST(amount AS float) AS amount, CAST(categoryId AS INT) AS categoryId FROM dbo.InvoiceItems WHERE invoiceId = @invoiceId ORDER BY Id ASC`);

    return res.json({ invoice, items: itemsRs.recordset });
  } catch (err) {
    console.error('[GET /invoices/:id] error:', err);
    return res.status(500).json({ message: 'Error fetching invoice', error: err.message });
  }
});

// Create new invoice (resolve apartment id if frontend sent name/label)
app.post('/invoices', async (req, res) => {
  const body = req.body || {};
  const { customerId, apartmentId, issueDate, dueDate, status, notes, items } = body;

  // 1. Kiểm tra đầu vào
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Hóa đơn phải có ít nhất 1 mục (items).' });
  }

  const pool = req.pool; // Sử dụng pool từ middleware
  const transaction = new sql.Transaction(pool); // Bắt đầu DB Transaction

  try {
    await transaction.begin(); // Bắt đầu giao dịch

    // 2. Xử lý logic nghiệp vụ (Đã đúng)
    const customerIdInt = customerId ? parseInt(customerId, 10) : null;
    const apartmentIdInt = apartmentId ? parseInt(apartmentId, 10) : null;

    // 3. Tạo ID và Số hóa đơn (Đã đúng)
    const newInvoiceId = await getNextId('dbo.Invoices', transaction.request());
    const invoiceNumber = body.invoiceNumber || `INV-${new Date().getFullYear()}-${String(newInvoiceId).slice(-3).padStart(3, '0')}`;

    // Tính tổng tiền từ items
    let calculatedTotal = 0;
    for (const item of items) {
      const amount = parseFloat(item.amount);
      if (!isNaN(amount)) {
        calculatedTotal += amount;
      }
    }
    const paidAmount = parseFloat(body.paidAmount) || 0;

    // 4. Thêm hóa đơn chính (CHA) TRƯỚC (Đã đúng)
    await transaction.request()
      .input('Id', sql.Int, newInvoiceId)
      .input('invoiceNumber', sql.NVarChar(50), invoiceNumber)
      .input('customerId', sql.Int, customerIdInt)
      .input('apartmentId', sql.Int, apartmentIdInt) // Đã nhận '401' (Tốt)
      .input('issueDate', sql.Date, issueDate || new Date())
      .input('dueDate', sql.Date, dueDate || new Date())
      .input('status', sql.NVarChar(50), status || 'pending')
      .input('totalAmount', sql.Decimal(18, 2), calculatedTotal)
      .input('paidAmount', sql.Decimal(18, 2), paidAmount)
      .input('paidDate', sql.Date, body.paidDate || null)
      .input('notes', sql.NVarChar(255), notes || null)
      .query(`
        INSERT INTO dbo.Invoices (Id, invoiceNumber, customerId, apartmentId, issueDate, dueDate, status, totalAmount, paidAmount, paidDate, notes)
        VALUES (@Id, @invoiceNumber, @customerId, @apartmentId, @issueDate, @dueDate, @status, @totalAmount, @paidAmount, @paidDate, @notes);
      `);

    // 5. Thêm các mục con (CON) SAU
    for (const item of items) {
      let categoryIdToInsert = parseInt(item.categoryId, 10);
      // Kiểm tra xem nó có phải là số không
      if (isNaN(categoryIdToInsert)) {
        // NẾU LÀ CHỮ (ví dụ: "Phí quản lý chung")
        console.log(`[POST /invoices] Chú ý: categoryId là string "${item.categoryId}". Đang tra cứu ID...`);

        // Phải dùng 'transaction.request()' vì chúng ta đang ở trong một transaction
        const categoryResult = await transaction.request()
          .input('categoryName', sql.NVarChar, item.categoryId.trim()) // .trim() để xóa khoảng trắng
          .query('SELECT Id FROM dbo.Categories WHERE name = @categoryName');

        if (categoryResult.recordset.length > 0) {
          categoryIdToInsert = categoryResult.recordset[0].Id;
          console.log(`[POST /invoices] Đã tìm thấy ID: ${categoryIdToInsert}`);
        } else {
          // Nếu không tìm thấy category -> Báo lỗi và HỦY Giao dịch
          console.error(`[POST /invoices] Lỗi: Không tìm thấy Category ID cho tên: "${item.categoryId}"`);
          throw new Error(`Danh mục không hợp lệ: "${item.categoryId}"`);
        }
      }

      await transaction.request()
        .input('invoiceId', sql.Int, newInvoiceId)
        .input('description', sql.NVarChar, item.description || '')
        .input('amount', sql.Decimal(18, 2), parseFloat(item.amount))
        .input('categoryId', sql.Int, categoryIdToInsert) // <-- Dùng ID đã được xác thực
        .query(`
            INSERT INTO dbo.InvoiceItems (invoiceId, description, amount, categoryId)
            VALUES (@invoiceId, @description, @amount, @categoryId);
        `);
    }

    // 6. Commit DB Transaction
    await transaction.commit();

    // 7. KÍCH HOẠT "LUỒNG TỰ ĐỘNG 1" (nếu trạng thái là 'paid')
    if (status === 'paid' || status === 'partial') {
      // (Đảm bảo hàm syncAndTaxInvoiceItems tồn tại trong file này)
      await syncAndTaxInvoiceItems(pool, newInvoiceId);
    }

    // 8. Lấy dữ liệu đầy đủ để trả về frontend
    const completeRs = await pool.request().input('id', sql.Int, newInvoiceId).query(`
      SELECT 
        i.*, 
        ISNULL(c.name, '') as customerName,
        ISNULL(a.name, '') as apartmentName
      FROM dbo.Invoices i
      LEFT JOIN dbo.Customers c ON i.customerId = c.Id
      LEFT JOIN dbo.Apartments a ON i.apartmentId = a.Id
      WHERE i.Id = @id
    `);

    return res.status(201).json({ success: true, invoice: completeRs.recordset[0] });

  } catch (err) {
    console.error('[POST /invoices] Lỗi Transaction:', err);
    console.error('Payload debug:', req.body);
    await transaction.rollback(); // Hoàn tác nếu có lỗi
    return res.status(500).json({ success: false, message: 'Lỗi tạo hóa đơn', error: err.message });
  }
});

// Update PUT /invoices/:id endpoint: remove unused variable assignment
app.put('/invoices/:id', parseId(), async (req, res) => {
  const id = req.parsedId; // Sử dụng ID từ middleware (đã validate)
  const body = req.body || {};
  // Lấy các trường
  const {
    customerId,
    apartmentId,
    issueDate,
    dueDate,
    status,
    notes,
    items,
    paidAmount,
    paidDate
  } = body;

  const hasItems = Array.isArray(items) && items.length > 0;
  const pool = req.pool; // Sử dụng pool từ middleware
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const customerIdInt = customerId ? parseInt(customerId, 10) : null;
    const apartmentIdInt = apartmentId ? parseInt(apartmentId, 10) : null;
    const finalPaidAmount = parseFloat(paidAmount) || 0;
    if (hasItems) {
      console.log(`[PUT /invoices/${id}] Đang cập nhật đầy đủ (với items)...`);

      // 1. Tính tổng tiền mới
      let calculatedTotal = 0;
      for (const item of items) {
        const amount = parseFloat(item.amount);
        if (!isNaN(amount)) calculatedTotal += amount;
      }

      // 2. Update bảng Invoices
      await transaction.request()
        .input('id', sql.Int, id)
        .input('customerId', sql.Int, customerIdInt)
        .input('apartmentId', sql.Int, apartmentIdInt)
        .input('issueDate', sql.Date, issueDate || null)
        .input('dueDate', sql.Date, dueDate || null)
        .input('status', sql.NVarChar(50), status || null)
        .input('totalAmount', sql.Decimal(18, 2), calculatedTotal)
        .input('paidAmount', sql.Decimal(18, 2), finalPaidAmount)
        .input('paidDate', sql.Date, paidDate || null)
        .input('notes', sql.NVarChar(255), notes || null)
        .query(`
                    UPDATE dbo.Invoices
                    SET customerId = @customerId,
                        apartmentId = @apartmentId,
                        issueDate = @issueDate,
                        dueDate = @dueDate,
                        status = @status,
                        totalAmount = @totalAmount,
                        paidAmount = @paidAmount,
                        paidDate = @paidDate,
                        notes = @notes
                    WHERE Id = @id
                `);

      // 3. Xóa items cũ
      await transaction.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM dbo.InvoiceItems WHERE invoiceId = @id`);

      // 4. Insert items mới
      for (const item of items) {
        let categoryIdToInsert = parseInt(item.categoryId, 10);

        // SMART BUFFER nếu gửi categoryId là string
        if (isNaN(categoryIdToInsert)) {
          console.log(
            `[PUT /invoices] Chú ý: categoryId là string "${item.categoryId}". Đang tra cứu ID...`
          );

          const categoryResult = await transaction.request()
            .input('categoryName', sql.NVarChar, item.categoryId.trim())
            .query(`
                            SELECT Id 
                            FROM dbo.Categories 
                            WHERE name = @categoryName
                        `);

          if (categoryResult.recordset.length > 0) {
            categoryIdToInsert = categoryResult.recordset[0].Id;
          } else {
            throw new Error(`Danh mục không hợp lệ: "${item.categoryId}"`);
          }
        }

        await transaction.request()
          .input('invoiceId', sql.Int, id)
          .input('description', sql.NVarChar, item.description || '')
          .input('amount', sql.Decimal(18, 2), parseFloat(item.amount))
          .input('categoryId', sql.Int, categoryIdToInsert)
          .query(`
                        INSERT INTO dbo.InvoiceItems (invoiceId, description, amount, categoryId)
                        VALUES (@invoiceId, @description, @amount, @categoryId)
                    `);
      }
    } else {
      console.log(`[PUT /invoices/${id}] Đang cập nhật nhanh (chỉ status/paidAmount)...`);

      await transaction.request()
        .input('id', sql.Int, id)
        .input('status', sql.NVarChar(50), status || null)
        .input('paidAmount', sql.Decimal(18, 2), finalPaidAmount)
        .input('paidDate', sql.Date, paidDate || null)
        .input('notes', sql.NVarChar(255), notes || null)
        .query(`
                    UPDATE dbo.Invoices
                    SET status = @status,
                        paidAmount = @paidAmount,
                        paidDate = @paidDate,
                        notes = @notes
                    WHERE Id = @id
                `);
    }

    // Commit
    await transaction.commit();

    // Đồng bộ + tính thuế (nếu đã thanh toán)
    if (status === 'paid' || status === 'partial') {
      await syncAndTaxInvoiceItems(pool, id);
    }

    // Trả về dữ liệu mới nhất
    const completeRs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
                SELECT 
                    i.*,
                    ISNULL(c.name, '') AS customerName,
                    ISNULL(a.name, '') AS apartmentName
                FROM dbo.Invoices i
                LEFT JOIN dbo.Customers c ON i.customerId = c.Id
                LEFT JOIN dbo.Apartments a ON i.apartmentId = a.Id
                WHERE i.Id = @id
            `);

    return res.json({
      success: true,
      invoice: completeRs.recordset[0]
    });

  } catch (err) {
    console.error(`[PUT /invoices/${id}] Lỗi Transaction:`, err);
    console.error('Payload debug:', req.body);

    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật hóa đơn',
      error: err.message
    });
  }
});


// Delete invoice
app.delete('/invoices/:id', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const id = parseInt(req.params.id);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.Invoices WHERE Id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    return res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    console.error('[DELETE /invoices/:id] error:', err);
    return res.status(500).json({ message: 'Error deleting invoice' });
  }
});

// Get summary view with customer and apartment details
app.get('/invoices/view', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request().query(`
      SELECT 
        i.Id as id,
        i.invoiceNumber,
        i.issueDate,
        i.dueDate,
        i.status,
        i.totalAmount,
        i.paidAmount,
        ISNULL(c.name, '') as customerName,
        ISNULL(a.name, '') as apartmentName
      FROM dbo.Invoices i
      LEFT JOIN dbo.Customers c ON i.customerId = c.Id
      LEFT JOIN dbo.Apartments a ON i.apartmentId = a.Id
      ORDER BY i.issueDate DESC
    `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('[GET /invoices/view] error:', err);
    return res.status(500).json({ message: 'Error fetching invoices view' });
  }
});

// Reports list normalized
app.get('/reports', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT CAST(Id AS INT) AS id,
             CAST([month] AS INT) AS [month],
             CAST([year] AS INT) AS [year],
             CAST(totalIncome AS float) AS totalIncome,
             CAST(totalExpense AS float) AS totalExpense,
             CAST(balance AS float) AS balance
      FROM dbo.Reports
      ORDER BY Id DESC`);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET reports] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách báo cáo' });
  }
});

app.get('/reports/view', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT r.Id AS id, r.[month], r.[year], r.totalIncome, r.totalExpense, r.balance,
             rd.Id AS detailId
      FROM dbo.Reports r
      LEFT JOIN dbo.ReportDetails rd ON rd.reportId = r.Id
      ORDER BY r.Id DESC`);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET reports/view] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy báo cáo (view)' });
  }
});
app.get('/reportDetails', (req, res) => simpleList(req, res, 'dbo.ReportDetails', 'Id ASC'));

app.get('/contractors', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(Id AS INT) AS id,
        ISNULL(name, '') AS name,
        ISNULL(taxCode, '') AS taxCode,
        ISNULL(email, '') AS email,
        ISNULL(phone, '') AS phone,
        ISNULL(address, '') AS address,
        ISNULL(representativeName, '') AS representativeName,
        ISNULL(representativePosition, '') AS representativePosition,
        ISNULL(status, 'active') AS status
      FROM dbo.Contractors
      ORDER BY Id ASC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET contractors] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách nhà thầu' });
  }
});

app.get('/tenders', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(t.Id AS INT) AS id,
        ISNULL(t.code, '') AS code,
        ISNULL(t.name, '') AS name,
        ISNULL(t.description, '') AS description,
        CAST(ISNULL(t.estimatedBudget, 0) AS FLOAT) AS estimatedBudget,
        CONVERT(varchar(10), t.startDate, 23) AS startDate,
        CONVERT(varchar(10), t.endDate, 23) AS endDate,
        ISNULL(t.status, 'DRAFT') AS status,
        CAST(t.createdBy AS BIGINT) AS createdBy,
        CONVERT(varchar(10), t.createdAt, 23) AS createdAt,
        CONVERT(varchar(19), t.closedAt, 126) AS closedAt,
        CONVERT(varchar(19), t.gradingStartedAt, 126) AS gradingStartedAt,
        CONVERT(varchar(19), t.awardedAt, 126) AS awardedAt,
        CONVERT(varchar(19), t.cancelledAt, 126) AS cancelledAt,
        t.cancelledReason,
        ISNULL(COUNT(tc.Id), 0) AS criteriaCount
      FROM dbo.Tenders t
      LEFT JOIN dbo.TenderCriteria tc ON t.Id = tc.tenderId AND tc.IsActive = 1
      GROUP BY t.Id, t.code, t.name, t.description, t.estimatedBudget, t.startDate, t.endDate, 
               t.status, t.createdBy, t.createdAt, t.closedAt, t.gradingStartedAt, t.awardedAt, 
               t.cancelledAt, t.cancelledReason
      ORDER BY t.Id DESC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET tenders] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách gói thầu' });
  }
});
app.get('/bids', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const { tenderId, contractorId } = req.query;

    let rs;
    if (tenderId) {
      rs = await pool.request()
        .input('tId', sql.Int, parseInt(tenderId, 10))
        .query(`
          SELECT 
            CAST(Id AS INT) AS id,
            CAST(tenderId AS INT) AS tenderId,
            CAST(contractorId AS INT) AS contractorId,
            CAST(bidAmount AS FLOAT) AS bidAmount,
            CONVERT(varchar(10), bidDate, 23) AS bidDate,
            ISNULL(status, 'pending') AS status,
            CAST(technicalScore AS FLOAT) AS technicalScore,
            CAST(financialScore AS FLOAT) AS financialScore,
            CAST(totalScore AS FLOAT) AS totalScore,
            CAST(ranking AS INT) AS ranking,
            CAST(isWinner AS BIT) AS isWinner
          FROM dbo.Bids 
          WHERE tenderId = @tId 
          ORDER BY Id DESC
        `);
    } else if (contractorId) {
      rs = await pool.request()
        .input('cId', sql.Int, parseInt(contractorId, 10))
        .query(`
          SELECT 
            CAST(Id AS INT) AS id,
            CAST(tenderId AS INT) AS tenderId,
            CAST(contractorId AS INT) AS contractorId,
            CAST(bidAmount AS FLOAT) AS bidAmount,
            CONVERT(varchar(10), bidDate, 23) AS bidDate,
            ISNULL(status, 'pending') AS status,
            CAST(technicalScore AS FLOAT) AS technicalScore,
            CAST(financialScore AS FLOAT) AS financialScore,
            CAST(totalScore AS FLOAT) AS totalScore,
            CAST(ranking AS INT) AS ranking,
            CAST(isWinner AS BIT) AS isWinner
          FROM dbo.Bids 
          WHERE contractorId = @cId 
          ORDER BY Id DESC
        `);
    } else {
      rs = await pool.request().query(`
        SELECT 
          CAST(Id AS INT) AS id,
          CAST(tenderId AS INT) AS tenderId,
          CAST(contractorId AS INT) AS contractorId,
          CAST(bidAmount AS FLOAT) AS bidAmount,
          CONVERT(varchar(10), bidDate, 23) AS bidDate,
          ISNULL(status, 'pending') AS status,
          CAST(technicalScore AS FLOAT) AS technicalScore,
          CAST(financialScore AS FLOAT) AS financialScore,
          CAST(totalScore AS FLOAT) AS totalScore,
          CAST(ranking AS INT) AS ranking,
          CAST(isWinner AS BIT) AS isWinner
        FROM dbo.Bids 
        ORDER BY Id DESC
      `);
    }

    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET bids] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách hồ sơ dự thầu' });
  }
});

// ===== EMPLOYEE SALARIES =====
app.get('/employee-salaries', async (req, res) => {
  try {
    const { employeeId, month, year } = req.query || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const request = pool.request();
    let query = `
      SELECT 
        CAST(es.Id AS INT) AS id,
        CAST(es.employeeId AS BIGINT) AS employeeId,
        es.[month] AS [month],
        es.[year] AS [year],
        CAST(es.baseSalary AS float) AS baseSalary,
        CAST(es.allowances AS float) AS allowances,
        CAST(es.deductions AS float) AS deductions,
        CAST(es.netSalary AS float) AS netSalary,
        CAST(ISNULL(es.standardWorkingDays, 26) AS float) AS standardWorkingDays,
        CAST(ISNULL(es.actualWorkingDays, es.standardWorkingDays) AS float) AS actualWorkingDays,
        CONVERT(varchar(10), es.paymentDate, 23) AS paymentDate,
        CAST(es.transactionId AS INT) AS transactionId,
        ISNULL(es.status, 'pending') AS status,
        ISNULL(es.description, '') AS description,
        ISNULL(es.notes, '') AS notes,
        ISNULL(es.bankName, '') AS bankName,
        ISNULL(es.bankAccountNumber, '') AS bankAccountNumber,
        ISNULL(es.transferReference, '') AS transferReference,
        ISNULL(es.allowanceDetails, '') AS allowanceDetails,
        ISNULL(es.deductionDetails, '') AS deductionDetails,
        CONVERT(varchar(19), es.approvedAt, 126) AS approvedAt,
        CONVERT(varchar(19), es.paidAt, 126) AS paidAt,
        CONVERT(varchar(19), es.acknowledgedAt, 126) AS acknowledgedAt,
        CAST(es.approvedById AS BIGINT) AS approvedById,
        CAST(es.paidById AS BIGINT) AS paidById,
        CAST(es.acknowledgedById AS BIGINT) AS acknowledgedById,
        ISNULL(approvedBy.fullName, '') AS approvedByName,
        ISNULL(paidBy.fullName, '') AS paidByName,
        ISNULL(ackBy.fullName, '') AS acknowledgedByName,
        CONVERT(varchar(10), es.CreatedAt, 23) AS createdAt,
        CONVERT(varchar(10), es.UpdatedAt, 23) AS updatedAt,
        ISNULL(u.fullName, '') AS employeeName,
        ISNULL(u.email, '') AS employeeEmail
      FROM dbo.EmployeeSalaries es
      LEFT JOIN dbo.Users u ON es.employeeId = u.Id
      LEFT JOIN dbo.Users approvedBy ON es.approvedById = approvedBy.Id
      LEFT JOIN dbo.Users paidBy ON es.paidById = paidBy.Id
      LEFT JOIN dbo.Users ackBy ON es.acknowledgedById = ackBy.Id
      WHERE 1=1
    `;

    if (employeeId) {
      request.input('employeeId', sql.BigInt, parseInt(employeeId, 10));
      query += ' AND es.employeeId = @employeeId';
    }
    if (month) {
      request.input('month', sql.Int, parseInt(month, 10));
      query += ' AND es.[month] = @month';
    }
    if (year) {
      request.input('year', sql.Int, parseInt(year, 10));
      query += ' AND es.[year] = @year';
    }

    query += ' ORDER BY es.[year] DESC, es.[month] DESC, es.CreatedAt DESC';
    const rs = await request.query(query);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET employee-salaries] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách lương nhân viên' });
  }
});

// GET /api/salaries/me - Lấy lương của user hiện tại
app.get('/salaries/me', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = currentUser.id || currentUser.Id;
    if (!userId) {
      return res.status(400).json({ message: 'User ID not found' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware
    const request = pool.request();
    request.input('employeeId', sql.BigInt, parseInt(userId, 10));

    const query = `
      SELECT 
        CAST(es.Id AS INT) AS id,
        CAST(es.employeeId AS BIGINT) AS employeeId,
        es.[month] AS [month],
        es.[year] AS [year],
        CAST(es.baseSalary AS float) AS baseSalary,
        CAST(es.allowances AS float) AS allowances,
        CAST(es.deductions AS float) AS deductions,
        CAST(es.netSalary AS float) AS netSalary,
        CAST(ISNULL(es.standardWorkingDays, 26) AS float) AS standardWorkingDays,
        CAST(ISNULL(es.actualWorkingDays, es.standardWorkingDays) AS float) AS actualWorkingDays,
        CONVERT(varchar(10), es.paymentDate, 23) AS paymentDate,
        CAST(es.transactionId AS INT) AS transactionId,
        ISNULL(es.status, 'pending') AS status,
        ISNULL(es.description, '') AS description,
        ISNULL(es.notes, '') AS notes,
        ISNULL(es.bankName, '') AS bankName,
        ISNULL(es.bankAccountNumber, '') AS bankAccountNumber,
        ISNULL(es.transferReference, '') AS transferReference,
        ISNULL(es.allowanceDetails, '') AS allowanceDetails,
        ISNULL(es.deductionDetails, '') AS deductionDetails,
        CONVERT(varchar(19), es.approvedAt, 126) AS approvedAt,
        CONVERT(varchar(19), es.paidAt, 126) AS paidAt,
        CONVERT(varchar(19), es.acknowledgedAt, 126) AS acknowledgedAt,
        CAST(es.approvedById AS BIGINT) AS approvedById,
        CAST(es.paidById AS BIGINT) AS paidById,
        CAST(es.acknowledgedById AS BIGINT) AS acknowledgedById,
        ISNULL(approvedBy.fullName, '') AS approvedByName,
        ISNULL(paidBy.fullName, '') AS paidByName,
        ISNULL(ackBy.fullName, '') AS acknowledgedByName,
        CONVERT(varchar(10), es.CreatedAt, 23) AS createdAt,
        CONVERT(varchar(10), es.UpdatedAt, 23) AS updatedAt,
        ISNULL(u.fullName, '') AS employeeName,
        ISNULL(u.email, '') AS employeeEmail
      FROM dbo.EmployeeSalaries es
      LEFT JOIN dbo.Users u ON es.employeeId = u.Id
      LEFT JOIN dbo.Users approvedBy ON es.approvedById = approvedBy.Id
      LEFT JOIN dbo.Users paidBy ON es.paidById = paidBy.Id
      LEFT JOIN dbo.Users ackBy ON es.acknowledgedById = ackBy.Id
      WHERE es.employeeId = @employeeId
      ORDER BY es.[year] DESC, es.[month] DESC, es.CreatedAt DESC
    `;

    const rs = await request.query(query);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET /salaries/me] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách lương của bạn' });
  }
});

app.get('/employee-salaries/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid salary id' });
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          CAST(es.Id AS INT) AS id,
          CAST(es.employeeId AS BIGINT) AS employeeId,
          es.[month] AS [month],
          es.[year] AS [year],
          CAST(es.baseSalary AS float) AS baseSalary,
          CAST(es.allowances AS float) AS allowances,
          CAST(es.deductions AS float) AS deductions,
          CAST(es.netSalary AS float) AS netSalary,
          CAST(ISNULL(es.standardWorkingDays, 26) AS float) AS standardWorkingDays,
          CAST(ISNULL(es.actualWorkingDays, es.standardWorkingDays) AS float) AS actualWorkingDays,
          CONVERT(varchar(10), es.paymentDate, 23) AS paymentDate,
          CAST(es.transactionId AS INT) AS transactionId,
          ISNULL(es.status, 'pending') AS status,
          ISNULL(es.description, '') AS description,
          ISNULL(es.notes, '') AS notes,
          ISNULL(es.bankName, '') AS bankName,
          ISNULL(es.bankAccountNumber, '') AS bankAccountNumber,
          ISNULL(es.transferReference, '') AS transferReference,
          ISNULL(es.allowanceDetails, '') AS allowanceDetails,
          ISNULL(es.deductionDetails, '') AS deductionDetails,
          CONVERT(varchar(19), es.approvedAt, 126) AS approvedAt,
          CONVERT(varchar(19), es.paidAt, 126) AS paidAt,
          CONVERT(varchar(19), es.acknowledgedAt, 126) AS acknowledgedAt,
          CAST(es.approvedById AS BIGINT) AS approvedById,
          CAST(es.paidById AS BIGINT) AS paidById,
          CAST(es.acknowledgedById AS BIGINT) AS acknowledgedById,
          ISNULL(approvedBy.fullName, '') AS approvedByName,
          ISNULL(paidBy.fullName, '') AS paidByName,
          ISNULL(ackBy.fullName, '') AS acknowledgedByName,
          CONVERT(varchar(10), es.CreatedAt, 23) AS createdAt,
          CONVERT(varchar(10), es.UpdatedAt, 23) AS updatedAt,
          ISNULL(u.fullName, '') AS employeeName,
          ISNULL(u.email, '') AS employeeEmail
        FROM dbo.EmployeeSalaries es
        LEFT JOIN dbo.Users u ON es.employeeId = u.Id
        LEFT JOIN dbo.Users approvedBy ON es.approvedById = approvedBy.Id
        LEFT JOIN dbo.Users paidBy ON es.paidById = paidBy.Id
        LEFT JOIN dbo.Users ackBy ON es.acknowledgedById = ackBy.Id
        WHERE es.Id = @id
      `);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy bảng lương' });
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[GET employee-salaries/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy thông tin lương nhân viên' });
  }
});

app.post('/employee-salaries', async (req, res) => {
  try {
    const {
      employeeId,
      month,
      year,
      baseSalary,
      allowances,
      deductions,
      netSalary,
      paymentDate,
      status,
      description,
      notes,
      bankName,
      bankAccountNumber,
      transferReference,
      allowanceDetails,
      deductionDetails,
      standardWorkingDays,
      actualWorkingDays
    } = req.body || {};

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const employeeIdInt = parseInt(employeeId, 10);
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);
    if (Number.isNaN(employeeIdInt) || Number.isNaN(monthInt) || Number.isNaN(yearInt)) {
      return res.status(400).json({ message: 'Thiếu employeeId / month / year hợp lệ' });
    }
    if (monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ message: 'Tháng phải trong khoảng 1-12' });
    }

    const base = baseSalary != null && baseSalary !== '' ? parseFloat(baseSalary) : 0;
    const allow = allowances != null && allowances !== '' ? parseFloat(allowances) : 0;
    const deduct = deductions != null && deductions !== '' ? parseFloat(deductions) : 0;

    // Xử lý Working Days
    const standardDays = standardWorkingDays != null && standardWorkingDays !== ''
      ? parseFloat(standardWorkingDays) : 26; // Mặc định 26 ngày
    const actualDays = actualWorkingDays != null && actualWorkingDays !== ''
      ? parseFloat(actualWorkingDays) : standardDays; // Mặc định = standardDays nếu không nhập

    // Validation working days
    if (standardDays <= 0) {
      return res.status(400).json({ message: 'Số ngày công chuẩn phải lớn hơn 0' });
    }
    if (actualDays < 0) {
      return res.status(400).json({ message: 'Số ngày công thực tế không được âm' });
    }

    // Tính RealBaseSalary theo công thức: (BaseSalary / StandardDays) × ActualDays
    const realBaseSalary = (base / standardDays) * actualDays;

    // Tính NetSalary: RealBaseSalary + Allowances - Deductions
    const net = netSalary != null && netSalary !== '' ? parseFloat(netSalary) : (realBaseSalary + allow - deduct);

    if (Number.isNaN(net) || net < 0) {
      return res.status(400).json({ message: 'Lương thực nhận không hợp lệ' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    const employeeRs = await pool.request()
      .input('employeeId', sql.BigInt, employeeIdInt)
      .query('SELECT TOP 1 fullName FROM dbo.Users WHERE Id = @employeeId');
    if (!employeeRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên với ID đã cung cấp' });
    }
    const employeeName = employeeRs.recordset[0].fullName;

    const exists = await pool.request()
      .input('employeeId', sql.BigInt, employeeIdInt)
      .input('month', sql.Int, monthInt)
      .input('year', sql.Int, yearInt)
      .query('SELECT TOP 1 Id FROM dbo.EmployeeSalaries WHERE employeeId = @employeeId AND [month] = @month AND [year] = @year');
    if (exists.recordset.length) {
      return res.status(409).json({ message: 'Bảng lương tháng/năm này đã tồn tại' });
    }

    const transactionId = await createSalaryTransaction(pool, {
      amount: net,
      paymentDate,
      description,
      employeeName,
      month: monthInt,
      year: yearInt
    });

    const normalizedAllowanceDetails = normalizeJsonField(allowanceDetails);
    const normalizedDeductionDetails = normalizeJsonField(deductionDetails);
    const timelineSeed = computeTimelineUpdatesOnCreate(status || 'pending', currentUser);

    const insert = await pool.request()
      .input('employeeId', sql.BigInt, employeeIdInt)
      .input('month', sql.Int, monthInt)
      .input('year', sql.Int, yearInt)
      .input('baseSalary', sql.Decimal(18, 2), base)
      .input('allowances', sql.Decimal(18, 2), allow)
      .input('deductions', sql.Decimal(18, 2), deduct)
      .input('netSalary', sql.Decimal(18, 2), net)
      .input('paymentDate', sql.Date, paymentDate ? new Date(paymentDate) : null)
      .input('transactionId', sql.Int, transactionId || null)
      .input('status', sql.NVarChar, status || 'pending')
      .input('description', sql.NVarChar, description || null)
      .input('notes', sql.NVarChar, notes || null)
      .input('bankName', sql.NVarChar(255), bankName ? bankName.trim() : null)
      .input('bankAccountNumber', sql.NVarChar(100), bankAccountNumber ? bankAccountNumber.trim() : null)
      .input('transferReference', sql.NVarChar(255), transferReference ? transferReference.trim() : null)
      .input('allowanceDetails', sql.NVarChar(sql.MAX), normalizedAllowanceDetails)
      .input('deductionDetails', sql.NVarChar(sql.MAX), normalizedDeductionDetails)
      .input('standardWorkingDays', sql.Float, standardDays)
      .input('actualWorkingDays', sql.Float, actualDays)
      .input('approvedAt', sql.DateTime2, timelineSeed.approvedAt || null)
      .input('approvedById', sql.BigInt, timelineSeed.approvedById || null)
      .input('paidAt', sql.DateTime2, timelineSeed.paidAt || null)
      .input('paidById', sql.BigInt, timelineSeed.paidById || null)
      .input('acknowledgedAt', sql.DateTime2, timelineSeed.acknowledgedAt || null)
      .input('acknowledgedById', sql.BigInt, timelineSeed.acknowledgedById || null)
      .query(`
        INSERT INTO dbo.EmployeeSalaries
          (employeeId, [month], [year], baseSalary, allowances, deductions, netSalary, paymentDate, transactionId, status, description, notes,
           bankName, bankAccountNumber, transferReference, allowanceDetails, deductionDetails,
           standardWorkingDays, actualWorkingDays,
           approvedAt, approvedById, paidAt, paidById, acknowledgedAt, acknowledgedById)
        OUTPUT CAST(INSERTED.Id AS INT) AS id,
               CAST(INSERTED.employeeId AS BIGINT) AS employeeId,
               INSERTED.[month],
               INSERTED.[year],
               CAST(INSERTED.baseSalary AS float) AS baseSalary,
               CAST(INSERTED.allowances AS float) AS allowances,
               CAST(INSERTED.deductions AS float) AS deductions,
               CAST(INSERTED.netSalary AS float) AS netSalary,
               CONVERT(varchar(10), INSERTED.paymentDate, 23) AS paymentDate,
               INSERTED.transactionId,
               INSERTED.status,
               ISNULL(INSERTED.description,'' ) AS description,
               ISNULL(INSERTED.notes,'') AS notes,
               ISNULL(INSERTED.bankName,'') AS bankName,
               ISNULL(INSERTED.bankAccountNumber,'') AS bankAccountNumber,
               ISNULL(INSERTED.transferReference,'') AS transferReference,
               ISNULL(INSERTED.allowanceDetails,'') AS allowanceDetails,
               ISNULL(INSERTED.deductionDetails,'') AS deductionDetails,
               CAST(INSERTED.standardWorkingDays AS float) AS standardWorkingDays,
               CAST(INSERTED.actualWorkingDays AS float) AS actualWorkingDays,
               CONVERT(varchar(19), INSERTED.approvedAt, 126) AS approvedAt,
               CONVERT(varchar(19), INSERTED.paidAt, 126) AS paidAt,
               CONVERT(varchar(19), INSERTED.acknowledgedAt, 126) AS acknowledgedAt,
               INSERTED.approvedById,
               INSERTED.paidById,
               INSERTED.acknowledgedById
        VALUES (@employeeId, @month, @year, @baseSalary, @allowances, @deductions, @netSalary, @paymentDate, @transactionId, @status, @description, @notes,
                @bankName, @bankAccountNumber, @transferReference, @allowanceDetails, @deductionDetails,
                @standardWorkingDays, @actualWorkingDays,
                @approvedAt, @approvedById, @paidAt, @paidById, @acknowledgedAt, @acknowledgedById)
      `);

    const insertedSalary = insert.recordset[0];
    await linkTransactionToSalary(pool, transactionId, insertedSalary?.id);

    return res.status(201).json(insertedSalary);
  } catch (err) {
    console.error('[POST employee-salaries] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo bảng lương: ' + err.message });
  }
});

app.put('/employee-salaries/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid salary id' });

    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ message: 'Unauthorized' });

    const pool = req.pool; // Sử dụng pool từ middleware
    const existing = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT TOP 1 
          Id,
          employeeId,
          transactionId,
          status,
          paymentDate,
          approvedAt,
          approvedById,
          paidAt,
          paidById,
          acknowledgedAt,
          acknowledgedById
        FROM dbo.EmployeeSalaries
        WHERE Id = @id
      `);
    if (!existing.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy bảng lương' });
    }

    const salaryRow = existing.recordset[0];
    const isOwner = salaryRow.employeeId && Number(salaryRow.employeeId) === Number(currentUser.id);

    const {
      baseSalary,
      allowances,
      deductions,
      netSalary,
      paymentDate,
      status,
      description,
      notes,
      bankName,
      bankAccountNumber,
      transferReference,
      allowanceDetails,
      deductionDetails,
      standardWorkingDays,
      actualWorkingDays
    } = req.body || {};

    const updateFields = [];
    const request = pool.request().input('id', sql.Int, id);

    const parseMoney = (value) => (value != null && value !== '' ? parseFloat(value) : undefined);
    const parseDays = (value) => (value != null && value !== '' ? parseFloat(value) : undefined);

    const base = parseMoney(baseSalary);
    const allow = parseMoney(allowances);
    const deduct = parseMoney(deductions);

    // Xử lý Working Days
    const standardDays = parseDays(standardWorkingDays);
    const actualDays = parseDays(actualWorkingDays);

    // Nếu có thay đổi working days hoặc baseSalary, cần tính lại netSalary
    let recalculateNet = false;
    let finalBase = base;
    let finalStandardDays = standardDays;
    let finalActualDays = actualDays;

    // Lấy giá trị hiện tại nếu không có trong request
    if (finalBase === undefined || finalStandardDays === undefined || finalActualDays === undefined) {
      const current = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT baseSalary, ISNULL(standardWorkingDays, 26) AS standardWorkingDays, ISNULL(actualWorkingDays, ISNULL(standardWorkingDays, 26)) AS actualWorkingDays FROM dbo.EmployeeSalaries WHERE Id = @id');

      if (current.recordset.length) {
        const currentData = current.recordset[0];
        if (finalBase === undefined) finalBase = currentData.baseSalary;
        if (finalStandardDays === undefined) finalStandardDays = currentData.standardWorkingDays;
        if (finalActualDays === undefined) finalActualDays = currentData.actualWorkingDays;
      }
    }

    // Tính RealBaseSalary nếu có đủ thông tin
    let realBaseSalary = finalBase;
    if (finalBase !== undefined && finalStandardDays !== undefined && finalActualDays !== undefined && finalStandardDays > 0) {
      realBaseSalary = (finalBase / finalStandardDays) * finalActualDays;
      recalculateNet = true;
    }

    const net = parseMoney(netSalary);

    if (base !== undefined) {
      updateFields.push('baseSalary = @baseSalary');
      request.input('baseSalary', sql.Decimal(18, 2), base);
      recalculateNet = true;
    }
    if (standardDays !== undefined) {
      if (standardDays <= 0) {
        return res.status(400).json({ message: 'Số ngày công chuẩn phải lớn hơn 0' });
      }
      updateFields.push('standardWorkingDays = @standardWorkingDays');
      request.input('standardWorkingDays', sql.Float, standardDays);
      recalculateNet = true;
    }
    if (actualDays !== undefined) {
      if (actualDays < 0) {
        return res.status(400).json({ message: 'Số ngày công thực tế không được âm' });
      }
      updateFields.push('actualWorkingDays = @actualWorkingDays');
      request.input('actualWorkingDays', sql.Float, actualDays);
      recalculateNet = true;
    }
    if (allow !== undefined) {
      updateFields.push('allowances = @allowances');
      request.input('allowances', sql.Decimal(18, 2), allow);
      recalculateNet = true;
    }
    if (deduct !== undefined) {
      updateFields.push('deductions = @deductions');
      request.input('deductions', sql.Decimal(18, 2), deduct);
      recalculateNet = true;
    }

    // Tính lại netSalary nếu cần
    let finalNet = net;
    if (recalculateNet && net === undefined) {
      // Lấy giá trị hiện tại của allowances và deductions nếu chưa được cập nhật
      const currentData = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT allowances, deductions FROM dbo.EmployeeSalaries WHERE Id = @id');

      const currentAllow = allow !== undefined ? allow : (currentData.recordset[0]?.allowances || 0);
      const currentDeduct = deduct !== undefined ? deduct : (currentData.recordset[0]?.deductions || 0);
      finalNet = realBaseSalary + currentAllow - currentDeduct;
    }

    if (finalNet !== undefined) {
      if (finalNet < 0) {
        return res.status(400).json({ message: 'Lương thực nhận không hợp lệ' });
      }
      updateFields.push('netSalary = @netSalary');
      request.input('netSalary', sql.Decimal(18, 2), finalNet);
    }
    if (paymentDate !== undefined) {
      updateFields.push('paymentDate = @paymentDate');
      request.input('paymentDate', sql.Date, paymentDate ? new Date(paymentDate) : null);
    }
    if (description !== undefined) {
      updateFields.push('description = @description');
      request.input('description', sql.NVarChar, description || null);
    }
    if (notes !== undefined) {
      updateFields.push('notes = @notes');
      request.input('notes', sql.NVarChar, notes || null);
    }
    if (bankName !== undefined) {
      updateFields.push('bankName = @bankName');
      request.input('bankName', sql.NVarChar(255), bankName ? bankName.trim() : null);
    }
    if (bankAccountNumber !== undefined) {
      updateFields.push('bankAccountNumber = @bankAccountNumber');
      request.input('bankAccountNumber', sql.NVarChar(100), bankAccountNumber ? bankAccountNumber.trim() : null);
    }
    if (transferReference !== undefined) {
      updateFields.push('transferReference = @transferReference');
      request.input('transferReference', sql.NVarChar(255), transferReference ? transferReference.trim() : null);
    }
    if (allowanceDetails !== undefined) {
      updateFields.push('allowanceDetails = @allowanceDetails');
      request.input('allowanceDetails', sql.NVarChar(sql.MAX), normalizeJsonField(allowanceDetails));
    }
    if (deductionDetails !== undefined) {
      updateFields.push('deductionDetails = @deductionDetails');
      request.input('deductionDetails', sql.NVarChar(sql.MAX), normalizeJsonField(deductionDetails));
    }

    if (status !== undefined) {
      updateFields.push('status = @status');
      request.input('status', sql.NVarChar, status);
    }

    if (status !== undefined && status !== salaryRow.status) {
      const timelineUpdates = computeTimelineUpdatesOnTransition(salaryRow, status, currentUser);
      if (timelineUpdates.approvedAt !== undefined) {
        updateFields.push('approvedAt = @approvedAt');
        updateFields.push('approvedById = @approvedById');
        request.input('approvedAt', sql.DateTime2, timelineUpdates.approvedAt);
        request.input('approvedById', sql.BigInt, timelineUpdates.approvedById || null);
      }
      if (timelineUpdates.paidAt !== undefined) {
        updateFields.push('paidAt = @paidAt');
        updateFields.push('paidById = @paidById');
        request.input('paidAt', sql.DateTime2, timelineUpdates.paidAt);
        request.input('paidById', sql.BigInt, timelineUpdates.paidById || null);
      }
      if (timelineUpdates.acknowledgedAt !== undefined) {
        updateFields.push('acknowledgedAt = @acknowledgedAt');
        updateFields.push('acknowledgedById = @acknowledgedById');
        request.input('acknowledgedAt', sql.DateTime2, timelineUpdates.acknowledgedAt);
        request.input('acknowledgedById', sql.BigInt, timelineUpdates.acknowledgedById || null);
      }
    }

    if (!updateFields.length) {
      return res.status(400).json({ message: 'Không có dữ liệu để cập nhật' });
    }

    updateFields.push('UpdatedAt = SYSUTCDATETIME()');

    const rs = await request.query(`
      UPDATE dbo.EmployeeSalaries
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.Id, INSERTED.employeeId, INSERTED.[month], INSERTED.[year],
             CAST(INSERTED.baseSalary AS float) AS baseSalary,
             CAST(INSERTED.allowances AS float) AS allowances,
             CAST(INSERTED.deductions AS float) AS deductions,
             CAST(INSERTED.netSalary AS float) AS netSalary,
             CAST(ISNULL(INSERTED.standardWorkingDays, 26) AS float) AS standardWorkingDays,
             CAST(ISNULL(INSERTED.actualWorkingDays, INSERTED.standardWorkingDays) AS float) AS actualWorkingDays,
             CONVERT(varchar(10), INSERTED.paymentDate, 23) AS paymentDate,
             INSERTED.transactionId, INSERTED.status,
             ISNULL(INSERTED.description,'') AS description,
             ISNULL(INSERTED.notes,'') AS notes,
             ISNULL(INSERTED.bankName,'') AS bankName,
             ISNULL(INSERTED.bankAccountNumber,'') AS bankAccountNumber,
             ISNULL(INSERTED.transferReference,'') AS transferReference,
             ISNULL(INSERTED.allowanceDetails,'') AS allowanceDetails,
             ISNULL(INSERTED.deductionDetails,'') AS deductionDetails,
             CONVERT(varchar(19), INSERTED.approvedAt, 126) AS approvedAt,
             CONVERT(varchar(19), INSERTED.paidAt, 126) AS paidAt,
             CONVERT(varchar(19), INSERTED.acknowledgedAt, 126) AS acknowledgedAt,
             INSERTED.approvedById,
             INSERTED.paidById,
             INSERTED.acknowledgedById
      WHERE Id = @id
    `);

    const updated = rs.recordset[0];
    await syncSalaryTransaction(pool, salaryRow.transactionId, {
      amount: net !== undefined ? net : undefined,
      paymentDate,
      description
    });

    return res.json(updated);
  } catch (err) {
    console.error('[PUT employee-salaries/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật bảng lương: ' + err.message });
  }
});

app.delete('/employee-salaries/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid salary id' });

    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ message: 'Unauthorized' });

    const pool = req.pool; // Sử dụng pool từ middleware
    const existing = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT TOP 1 Id FROM dbo.EmployeeSalaries WHERE Id = @id');
    if (!existing.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy bảng lương' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.EmployeeSalaries WHERE Id = @id');

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE employee-salaries/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa bảng lương: ' + err.message });
  }
});

// ===== CRUD: Customers =====
app.post('/customers', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    // Do bảng Customers.Id không phải IDENTITY trong DB script, tự tạo Id kế tiếp
    const nextId = await getNextId('dbo.Customers', pool.request());

    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone)
      .input('address', sql.NVarChar, address)
      .query(`INSERT INTO dbo.Customers (Id, name, email, phone, address)
              OUTPUT INSERTED.Id, INSERTED.name, INSERTED.email, INSERTED.phone, INSERTED.address
              VALUES (@Id, @name, @email, @phone, @address)`);
    return res.status(201).json(rs.recordset[0]);
  } catch (err) {
    console.error('[POST customers] error:', err);
    return res.status(500).json({ message: 'Lỗi thêm cư dân' });
  }
});

app.put('/customers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone, address } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone)
      .input('address', sql.NVarChar, address)
      .query(`UPDATE dbo.Customers SET name=@name, email=@email, phone=@phone, address=@address
              OUTPUT INSERTED.Id, INSERTED.name, INSERTED.email, INSERTED.phone, INSERTED.address
              WHERE Id=@id`);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy cư dân' });
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[PUT customers/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật cư dân' });
  }
});

app.delete('/customers/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Customers WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE customers/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa cư dân' });
  }
});

// ===== CRUD: Apartments =====
app.post('/apartments', async (req, res) => {
  try {
    const { name, floor, buildingId, area, rooms, customerId } = req.body || {};
    if (!name || String(name).trim() === '') {
      return res.status(400).json({ success: false, message: 'Tên căn hộ (name) là bắt buộc' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    // Tính nextId và thử insert, thao tác retry để tránh race condition
    const maxAttempts = 5;
    let inserted = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nextId = await getNextId('dbo.Apartments', pool.request());

      try {
        const rs = await pool.request()
          .input('Id', sql.Int, nextId)
          .input('name', sql.NVarChar(100), String(name).trim())
          .input('floor', sql.NVarChar(50), floor != null && floor !== '' ? String(floor) : null)
          .input('buildingId', sql.Int, buildingId != null && buildingId !== '' ? parseInt(buildingId, 10) : null)
          .input('area', sql.Decimal(18, 4), area != null && area !== '' ? parseFloat(area) : null)
          .input('rooms', sql.NVarChar(50), rooms != null && rooms !== '' ? String(rooms) : null)
          .input('customerId', sql.Int, customerId != null && customerId !== '' ? parseInt(customerId, 10) : null)
          .query(`
            INSERT INTO dbo.Apartments (Id, name, floor, buildingId, area, rooms, customerId)
            OUTPUT INSERTED.Id, INSERTED.name, INSERTED.floor, INSERTED.buildingId, INSERTED.area, INSERTED.rooms, INSERTED.customerId
            VALUES (@Id, @name, @floor, @buildingId, @area, @rooms, @customerId)
          `);

        inserted = rs.recordset?.[0] || null;
        break; // insert thành công
      } catch (err) {
        // Nếu là lỗi duplicate key, thử lại; ngược lại throw
        if (err && (err.number === 2627 || err.number === 2601)) {
          continue; // tính lại nextId và thử insert lại
        }
        throw err;
      }
    }

    if (!inserted) {
      return res.status(500).json({ success: false, message: 'Không thể tạo căn hộ do xung đột Id. Vui lòng thử lại.' });
    }

    return res.status(201).json({ success: true, apartment: inserted });
  } catch (err) {
    console.error('[POST apartments] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi thêm căn hộ. Vui lòng thử lại sau.');
    return res.status(sqlError.status).json({
      success: false,
      message: sqlError.message,
      code: sqlError.code
    });
  }
});

app.put('/apartments/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const { name, floor, buildingId, area, rooms, customerId } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('floor', sql.Int, floor ? parseInt(floor, 10) : null)
      .input('buildingId', sql.Int, buildingId ? parseInt(buildingId, 10) : null)
      .input('area', sql.Int, area ? parseInt(area, 10) : null)
      .input('rooms', sql.Int, rooms ? parseInt(rooms, 10) : null)
      .input('customerId', sql.Int, customerId === null || customerId === '' ? null : parseInt(customerId, 10))
      .query(`UPDATE dbo.Apartments SET name=@name, floor=@floor, buildingId=@buildingId, area=@area, rooms=@rooms, customerId=@customerId
              OUTPUT INSERTED.Id, INSERTED.name, INSERTED.floor, INSERTED.buildingId, INSERTED.area, INSERTED.rooms, INSERTED.customerId
              WHERE Id=@id`);
    const apartment = checkRecordExists(rs.recordset, 'căn hộ'); // Sử dụng helper
    return res.json(apartment);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[PUT apartments/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật căn hộ' });
  }
});

app.delete('/apartments/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Apartments WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE apartments/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa căn hộ' });
  }
});

// ===== CRUD: Contractors =====
app.post('/contractors', async (req, res) => {
  try {
    const { name, taxCode, email, phone, address, representativeName, representativePosition, status } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    // Tính nextId vì bảng Contractors.Id không phải IDENTITY
    const nextId = await getNextId('dbo.Contractors', pool.request());

    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('name', sql.NVarChar, name)
      .input('taxCode', sql.NVarChar, taxCode || null)
      .input('email', sql.NVarChar, email || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('address', sql.NVarChar, address || null)
      .input('representativeName', sql.NVarChar, representativeName || null)
      .input('representativePosition', sql.NVarChar, representativePosition || null)
      .input('status', sql.NVarChar, status || 'active')
      .query(`INSERT INTO dbo.Contractors (Id, name, taxCode, email, phone, address, representativeName, representativePosition, status)
              OUTPUT INSERTED.Id, INSERTED.name, INSERTED.taxCode, INSERTED.email, INSERTED.phone, INSERTED.address, INSERTED.representativeName, INSERTED.representativePosition, INSERTED.status
              VALUES (@Id, @name, @taxCode, @email, @phone, @address, @representativeName, @representativePosition, @status)`);
    return res.status(201).json(rs.recordset[0]);
  } catch (err) {
    console.error('[POST contractors] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi thêm nhà thầu');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

app.put('/contractors/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const { name, taxCode, email, phone, address, representativeName, representativePosition, status } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('taxCode', sql.NVarChar, taxCode)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone)
      .input('address', sql.NVarChar, address)
      .input('representativeName', sql.NVarChar, representativeName)
      .input('representativePosition', sql.NVarChar, representativePosition)
      .input('status', sql.NVarChar, status || 'active')
      .query(`UPDATE dbo.Contractors SET name=@name, taxCode=@taxCode, email=@email, phone=@phone, address=@address, representativeName=@representativeName, representativePosition=@representativePosition, status=@status
              OUTPUT INSERTED.Id, INSERTED.name, INSERTED.taxCode, INSERTED.email, INSERTED.phone, INSERTED.address, INSERTED.representativeName, INSERTED.representativePosition, INSERTED.status
              WHERE Id=@id`);
    const contractor = checkRecordExists(rs.recordset, 'nhà thầu'); // Sử dụng helper
    return res.json(contractor);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[PUT contractors/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật nhà thầu' });
  }
});

app.delete('/contractors/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Contractors WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE contractors/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa nhà thầu' });
  }
});

// ===== CRUD: Tenders =====
app.post('/tenders', async (req, res) => {
  try {
    const { code, name, description, estimatedBudget, startDate, endDate, status, createdBy, createdAt } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    // Tính nextId vì bảng Tenders.Id không phải IDENTITY
    const nextId = await getNextId('dbo.Tenders', pool.request());

    // Lấy currentUser nếu có (từ JWT token)
    const currentUser = await getCurrentUser(req);
    const finalCreatedBy = createdBy || currentUser?.id || null;
    const finalCreatedAt = createdAt ? new Date(createdAt) : new Date();

    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('code', sql.NVarChar, code || null)
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .input('estimatedBudget', sql.Decimal(18, 2), estimatedBudget ? parseFloat(estimatedBudget) : null)
      .input('startDate', sql.Date, startDate || null)
      .input('endDate', sql.Date, endDate || null)
      .input('status', sql.NVarChar, status || 'DRAFT')
      .input('createdBy', sql.BigInt, finalCreatedBy)
      .input('createdAt', sql.Date, finalCreatedAt)
      .query(`INSERT INTO dbo.Tenders (Id, code, name, description, estimatedBudget, startDate, endDate, status, createdBy, createdAt)
              OUTPUT INSERTED.Id, INSERTED.code, INSERTED.name, INSERTED.description, INSERTED.estimatedBudget, CONVERT(varchar(10), INSERTED.startDate, 23) AS startDate, CONVERT(varchar(10), INSERTED.endDate, 23) AS endDate, INSERTED.status, INSERTED.createdBy, CONVERT(varchar(10), INSERTED.createdAt, 23) AS createdAt
              VALUES (@Id, @code, @name, @description, @estimatedBudget, @startDate, @endDate, @status, @createdBy, @createdAt)`);
    return res.status(201).json(rs.recordset[0]);
  } catch (err) {
    console.error('[POST tenders] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi thêm gói thầu');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

app.put('/tenders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { code, name, description, estimatedBudget, startDate, endDate } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const currentUser = await getCurrentUser(req);
    const isAdmin = currentUser?.role === 'admin';

    // Lấy trạng thái hiện tại
    const currentStatusRs = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT status FROM dbo.Tenders WHERE Id = @id');

    if (!currentStatusRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }

    const currentStatus = currentStatusRs.recordset[0].status;

    // Logic validation:
    // - Admin có thể cập nhật tất cả trường (trừ status) ở mọi trạng thái
    // - User thường chỉ có thể cập nhật khi status = 'DRAFT'
    // - Status luôn phải qua transition API, không cho phép cập nhật trực tiếp
    if (!isAdmin && currentStatus && currentStatus !== 'DRAFT') {
      return res.status(400).json({
        message: 'Không thể sửa gói thầu khi đã mở. Vui lòng sử dụng API chuyển trạng thái.',
        currentStatus: currentStatus
      });
    }

    // Admin có thể cập nhật, nhưng cần validate một số trường khi tender đã mở
    if (isAdmin && currentStatus && currentStatus !== 'DRAFT') {
      // Khi tender đã mở, chỉ cho phép cập nhật description, startDate, endDate
      // Không cho phép thay đổi code, name, estimatedBudget để tránh ảnh hưởng đến quá trình đấu thầu
      // Tuy nhiên, nếu admin thực sự cần, có thể cho phép cập nhật tất cả
      // Ở đây ta cho phép admin cập nhật tất cả để linh hoạt hơn
    }

    // Build dynamic UPDATE query để chỉ cập nhật các trường được cung cấp
    const updateFields = [];
    const request = pool.request().input('id', sql.Int, id);

    if (code !== undefined) {
      updateFields.push('code = @code');
      request.input('code', sql.NVarChar, code);
    }
    if (name !== undefined) {
      updateFields.push('name = @name');
      request.input('name', sql.NVarChar, name);
    }
    if (description !== undefined) {
      updateFields.push('description = @description');
      request.input('description', sql.NVarChar, description);
    }
    if (estimatedBudget !== undefined) {
      updateFields.push('estimatedBudget = @estimatedBudget');
      request.input('estimatedBudget', sql.Float, estimatedBudget ? parseFloat(estimatedBudget) : 0);
    }
    if (startDate !== undefined) {
      updateFields.push('startDate = @startDate');
      request.input('startDate', sql.Date, startDate);
    }
    if (endDate !== undefined) {
      updateFields.push('endDate = @endDate');
      request.input('endDate', sql.Date, endDate);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'Không có trường nào để cập nhật' });
    }

    const updateQuery = `
      UPDATE dbo.Tenders 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.Id, INSERTED.code, INSERTED.name, INSERTED.description, INSERTED.estimatedBudget, 
             CONVERT(varchar(10), INSERTED.startDate, 23) AS startDate, 
             CONVERT(varchar(10), INSERTED.endDate, 23) AS endDate, 
             INSERTED.status
      WHERE Id = @id
    `;

    const rs = await request.query(updateQuery);

    if (!rs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }

    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[PUT tenders/:id] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi cập nhật gói thầu');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

app.delete('/tenders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Tenders WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE tenders/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa gói thầu' });
  }
});

// ===== CRUD: Bids =====
const ALLOWED_BID_STATUSES = ['pending', 'approved', 'rejected'];
const normalizeBidStatus = (value) => {
  if (!value && value !== 0) return null;
  const str = value.toString().trim().toLowerCase();
  const mapped =
    {
      dang_xet_duyet: 'pending',
      'đang xét duyệt': 'pending'
    }[str] || str;
  return ALLOWED_BID_STATUSES.includes(mapped) ? mapped : null;
};

app.post('/bids', async (req, res) => {
  try {
    const {
      tenderId,
      contractorId,
      bidAmount,
      bidDate,
      status,
      technicalScore,
      financialScore
    } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    // Kiểm tra tender có đang mở không
    const tenderRs = await pool.request()
      .input('tenderId', sql.Int, parseInt(tenderId, 10))
      .query('SELECT status, endDate FROM dbo.Tenders WHERE Id = @tenderId');

    if (!tenderRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }

    const tender = tenderRs.recordset[0];

    // Chỉ cho phép nộp hồ sơ khi tender đang mở (OPEN)
    if (tender.status !== 'OPEN') {
      return res.status(400).json({
        message: `Không thể nộp hồ sơ. Gói thầu đang ở trạng thái: ${tender.status}`,
        currentStatus: tender.status
      });
    }

    // Kiểm tra hạn đóng thầu (cho phép nộp đến hết ngày endDate, tránh lệch TZ)
    const endDate = new Date(tender.endDate);
    const deadline = new Date(endDate);
    deadline.setHours(23, 59, 59, 999);
    const today = new Date();
    if (deadline < today) {
      return res.status(400).json({
        message: 'Đã quá hạn đóng thầu. Không thể nộp hồ sơ mới.',
        endDate: tender.endDate
      });
    }

    // Tính nextId vì bảng Bids.Id không phải IDENTITY
    const nextId = await getNextId('dbo.Bids', pool.request());

    const normalizedStatus = normalizeBidStatus(status);
    if (normalizedStatus && normalizedStatus !== 'pending') {
      return res.status(400).json({ message: 'Hồ sơ mới chỉ có thể ở trạng thái pending' });
    }

    const initialStatus = 'pending';
    const technicalScoreValue = technicalScore !== undefined && technicalScore !== null
      ? parseFloat(technicalScore)
      : null;
    const financialScoreValue = financialScore !== undefined && financialScore !== null
      ? parseFloat(financialScore)
      : null;

    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('tenderId', sql.Int, parseInt(tenderId, 10))
      .input('contractorId', sql.Int, parseInt(contractorId, 10))
      .input('bidAmount', sql.Decimal(18, 2), bidAmount ? parseFloat(bidAmount) : 0)
      .input('bidDate', sql.Date, bidDate)
      .input('technicalScore', sql.Decimal(18, 4), technicalScoreValue)
      .input('financialScore', sql.Decimal(18, 4), financialScoreValue)
      .input('status', sql.NVarChar, initialStatus)
      .query(`INSERT INTO dbo.Bids (Id, tenderId, contractorId, bidAmount, bidDate, technicalScore, financialScore, status)
              OUTPUT INSERTED.Id, INSERTED.tenderId, INSERTED.contractorId, INSERTED.bidAmount, CONVERT(varchar(10), INSERTED.bidDate, 23) AS bidDate, INSERTED.technicalScore, INSERTED.financialScore, INSERTED.status
              VALUES (@Id, @tenderId, @contractorId, @bidAmount, @bidDate, @technicalScore, @financialScore, @status)`);
    return res.status(201).json(rs.recordset[0]);
  } catch (err) {
    console.error('[POST bids] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi thêm hồ sơ dự thầu');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

app.put('/bids/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { tenderId, contractorId, bidAmount, bidDate, status, technicalScore, financialScore } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware

    const existingBidRs = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT Id, tenderId, technicalScore, financialScore, status FROM dbo.Bids WHERE Id=@id');
    if (!existingBidRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ dự thầu' });
    }

    const existingBid = existingBidRs.recordset[0];

    const tenderStatusRs = await pool.request()
      .input('tenderId', sql.Int, existingBid.tenderId)
      .query('SELECT status FROM dbo.Tenders WHERE Id = @tenderId');
    const tenderStatus = tenderStatusRs.recordset[0]?.status || null;

    const normalizedStatus = normalizeBidStatus(status);
    if (status && !normalizedStatus) {
      return res.status(400).json({ message: 'Trạng thái hồ sơ không hợp lệ' });
    }

    const technicalScoreValue = technicalScore !== undefined && technicalScore !== null
      ? parseFloat(technicalScore)
      : null;
    const financialScoreValue = financialScore !== undefined && financialScore !== null
      ? parseFloat(financialScore)
      : null;

    if ((technicalScore !== undefined || financialScore !== undefined) && tenderStatus && tenderStatus !== 'GRADING') {
      return res.status(400).json({ message: `Chỉ được cập nhật điểm khi gói thầu đang ở trạng thái GRADING (hiện tại: ${tenderStatus})` });
    }

    const nextTechnicalScore = technicalScore !== undefined ? technicalScoreValue : existingBid.technicalScore;
    const nextFinancialScore = financialScore !== undefined ? financialScoreValue : existingBid.financialScore;
    const hasTechnicalScore = nextTechnicalScore !== null && nextTechnicalScore !== undefined && !Number.isNaN(nextTechnicalScore);
    const hasFinancialScore = nextFinancialScore !== null && nextFinancialScore !== undefined && !Number.isNaN(nextFinancialScore);

    if (normalizedStatus === 'approved' && (!hasTechnicalScore || !hasFinancialScore)) {
      return res.status(400).json({ message: 'Cần đủ điểm kỹ thuật và tài chính trước khi duyệt (approved)' });
    }

    // Nếu không gửi status, hệ thống tự xác định
    const finalStatus = normalizedStatus
      ? normalizedStatus
      : (hasTechnicalScore && hasFinancialScore ? 'approved' : 'pending');

    if (!ALLOWED_BID_STATUSES.includes(finalStatus)) {
      return res.status(400).json({ message: 'Trạng thái hồ sơ không hợp lệ' });
    }

    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('tenderId', sql.Int, tenderId ? parseInt(tenderId, 10) : null)
      .input('contractorId', sql.Int, contractorId ? parseInt(contractorId, 10) : null)
      .input('bidAmount', sql.Float, bidAmount ? parseFloat(bidAmount) : null)
      .input('bidDate', sql.Date, bidDate)
      .input('technicalScore', sql.Decimal(18, 4), technicalScoreValue)
      .input('financialScore', sql.Decimal(18, 4), financialScoreValue)
      .input('status', sql.NVarChar, finalStatus)
      .query(`UPDATE dbo.Bids SET 
                tenderId = COALESCE(@tenderId, tenderId),
                contractorId = COALESCE(@contractorId, contractorId),
                bidAmount = COALESCE(@bidAmount, bidAmount),
                bidDate = COALESCE(@bidDate, bidDate),
                technicalScore = COALESCE(@technicalScore, technicalScore),
                financialScore = COALESCE(@financialScore, financialScore),
                status = @status
              OUTPUT INSERTED.Id, INSERTED.tenderId, INSERTED.contractorId, INSERTED.bidAmount, CONVERT(varchar(10), INSERTED.bidDate, 23) AS bidDate, INSERTED.technicalScore, INSERTED.financialScore, INSERTED.status
              WHERE Id=@id`);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy hồ sơ dự thầu sau khi cập nhật' });
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[PUT bids/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật hồ sơ dự thầu' });
  }
});

app.delete('/bids/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Bids WHERE Id=@id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE bids/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa hồ sơ dự thầu' });
  }
});

// ===== SEALED BIDS: GET /tenders/:id/bids (Bảo mật đấu thầu kín) =====
app.get('/tenders/:id/bids', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const forceShow = req.query.forceShow === 'true';
    const currentUser = await getCurrentUser(req);

    const pool = req.pool; // Sử dụng pool từ middleware

    // 1. Lấy thông tin tender + bids trong 1 query để tối ưu
    const tenderRs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .query(`
        SELECT 
          t.status, t.endDate
        FROM dbo.Tenders t
        WHERE t.Id = @tenderId
      `);

    if (!tenderRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }

    const tender = tenderRs.recordset[0];
    const isAdmin = currentUser?.role === 'admin';
    const closedStates = ['CLOSED', 'GRADING', 'PENDING_APPROVAL', 'AWARDED'];
    const isClosed = closedStates.includes(tender.status);
    const endDate = new Date(tender.endDate);
    const now = new Date();
    const isPastEndDate = endDate <= now;
    const shouldShowAmount = tender.status === 'AWARDED' || (isClosed && isPastEndDate);

    // 2. Lấy danh sách bids với logic ẩn/hiện bidAmount
    const bidsRs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .input('shouldShowAmount', sql.Bit, shouldShowAmount ? 1 : 0)
      .input('isAdmin', sql.Bit, isAdmin ? 1 : 0)
      .input('forceShow', sql.Bit, forceShow ? 1 : 0)
      .query(`
        SELECT 
          b.Id, b.tenderId, b.contractorId, b.bidDate, b.status,
          b.technicalScore, b.financialScore, b.totalScore, b.ranking,
          b.isWinner,
          c.name AS contractorName,
          -- Logic ẩn/hiện bidAmount
          CASE 
            WHEN @shouldShowAmount = 1 OR (@isAdmin = 1 AND @forceShow = 1)
            THEN b.bidAmount
            ELSE NULL
          END AS bidAmount,
          -- Flag để frontend biết có bị ẩn không
          CASE 
            WHEN @shouldShowAmount = 1 OR (@isAdmin = 1 AND @forceShow = 1)
            THEN 0
            ELSE 1
          END AS isAmountHidden
        FROM dbo.Bids b
        INNER JOIN dbo.Contractors c ON b.contractorId = c.Id
        WHERE b.tenderId = @tenderId
        ORDER BY b.totalScore DESC, b.bidAmount ASC
      `);

    // 3. Log audit + notification nếu admin override (không áp dụng khi status = AWARDED)
    // Chỉ log nếu admin đang cố xem bids khi chưa đóng thầu (tức là khi shouldShowAmount = false ban đầu)
    const needsAuditLog = isAdmin && forceShow && !shouldShowAmount && currentUser?.id;
    
    if (needsAuditLog) {
      try {
        await pool.request()
          .input('action', sql.NVarChar, 'VIEW_SEALED_BIDS')
          .input('entityType', sql.NVarChar, 'Tender')
          .input('entityId', sql.Int, tenderId)
          .input('userId', sql.BigInt, currentUser.id)
          .input('details', sql.NVarChar, 'Admin forced view of sealed bids before closing')
          .query(`
            INSERT INTO dbo.AuditLogs (action, entityType, entityId, userId, details, createdAt)
            VALUES (@action, @entityType, @entityId, @userId, @details, GETDATE())
          `);
      } catch (auditErr) {
        // Log lỗi audit nhưng không fail request
        console.warn('[Audit Log] Failed to log sealed bids view:', auditErr.message);
      }

      try {
        const nextNotificationId = await getNextId('dbo.Notifications', pool.request());
        const viewerName = currentUser.fullName || 'Admin';
        const alertContent = `User ${viewerName} (ID: ${currentUser.id}) đã thực hiện xem giá gói thầu ${tenderId} khi chưa đóng thầu.`;

        await pool.request()
          .input('Id', sql.Int, nextNotificationId)
          .input('title', sql.NVarChar, '🚨 CẢNH BÁO AN NINH: XEM GIÁ THẦU')
          .input('content', sql.NVarChar, alertContent)
          .input('type', sql.NVarChar, 'SECURITY_ALERT')
          .input('senderId', sql.BigInt, currentUser.id)
          .input('buildingId', sql.Int, null)
          .input('images', sql.NVarChar, '[]')
          .query(`
            INSERT INTO dbo.Notifications (Id, title, content, type, senderId, buildingId, images, sendDate, isActive, createdAt)
            VALUES (@Id, @title, @content, @type, @senderId, @buildingId, @images, GETDATE(), 1, GETDATE())
          `);
      } catch (notifyErr) {
        console.warn('[Security Alert] Failed to insert notification:', notifyErr.message);
      }
    }

    // Flag để frontend biết có security alert
    const hasSecurityAlert = isAdmin && forceShow && !shouldShowAmount && currentUser?.id;

    return res.json({
      bids: bidsRs.recordset,
      metadata: {
        isAmountHidden: !shouldShowAmount && !(isAdmin && forceShow),
        tenderStatus: tender.status,
        endDate: tender.endDate,
        hasSecurityAlert: hasSecurityAlert || false,
        securityAlertMessage: hasSecurityAlert
          ? `🚨 CẢNH BÁO AN NINH: Bạn đã xem giá gói thầu #${tenderId} khi chưa đóng thầu. Hành động này đã được ghi vào audit log.`
          : null
      }
    });
  } catch (err) {
    console.error('[GET /tenders/:id/bids] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách hồ sơ dự thầu' });
  }
});

// ===== TENDER WORKFLOW STATE MACHINE APIs =====
// API: Chuyển trạng thái Tender
app.post('/tenders/:id/transition', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const { newStatus, cancelledReason, reason, transitionReason: bodyTransitionReason } = req.body || {};
    const transitionReason = reason || bodyTransitionReason || null;
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    if (!newStatus) {
      return res.status(400).json({ message: 'Thiếu trường newStatus' });
    }

    // Kiểm tra quyền theo từng transition
    const validStatuses = ['OPEN', 'CLOSED', 'GRADING', 'PENDING_APPROVAL', 'AWARDED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware
    const tenderStatusRs = await pool.request()
      .input('id', sql.Int, tenderId)
      .query('SELECT status FROM dbo.Tenders WHERE Id = @id');

    if (!tenderStatusRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }

    const currentStatus = tenderStatusRs.recordset[0].status;

    // Phân quyền
    const isAdmin = currentUser.role === 'admin';
    const isTenderManager = currentUser.role === 'tender_manager';

    if (newStatus === 'AWARDED') {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Chỉ Admin mới được trao thầu' });
      }
      if (currentStatus !== 'PENDING_APPROVAL') {
        return res.status(400).json({ message: 'Chỉ có thể trao thầu khi gói thầu đang chờ phê duyệt' });
      }
    }

    if (newStatus === 'PENDING_APPROVAL') {
      if (!isTenderManager && !isAdmin) {
        return res.status(403).json({ message: 'Chỉ Tender Manager hoặc Admin mới được gửi phê duyệt' });
      }
      if (currentStatus !== 'GRADING') {
        return res.status(400).json({ message: 'Chỉ có thể gửi phê duyệt khi đang ở trạng thái GRADING' });
      }
    }

    if (newStatus === 'GRADING') {
      if (currentStatus === 'CLOSED') {
        if (!isAdmin && !isTenderManager) {
          return res.status(403).json({ message: 'Chỉ Admin hoặc Tender Manager mới được chuyển sang chấm điểm' });
        }
      } else if (currentStatus === 'PENDING_APPROVAL') {
        if (!isAdmin) {
          return res.status(403).json({ message: 'Chỉ Admin mới được yêu cầu chấm điểm lại' });
        }
        if (!transitionReason || !transitionReason.trim()) {
          return res.status(400).json({ message: 'Phải nhập lý do khi trả về trạng thái GRADING' });
        }
      }
    }

    if (newStatus === 'CANCELLED' && !isAdmin) {
      return res.status(403).json({ message: 'Chỉ Admin mới được hủy gói thầu' });
    }

    // Gọi stored procedure để validate và chuyển trạng thái
    const result = await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .input('NewStatus', sql.NVarChar, newStatus)
      .input('UserId', sql.BigInt, currentUser.id)
      .input('CancelledReason', sql.NVarChar, cancelledReason || null)
      .input('TransitionReason', sql.NVarChar, transitionReason || null)
      .execute('dbo.sp_TransitionTenderStatus');

    if (result.recordset.length && result.recordset[0].Success === 1) {
      // Lấy thông tin tender đã cập nhật
      const tenderRs = await pool.request()
        .input('id', sql.Int, tenderId)
        .query(`
          SELECT 
            Id, code, name, description, estimatedBudget,
            CONVERT(varchar(10), startDate, 23) AS startDate,
            CONVERT(varchar(10), endDate, 23) AS endDate,
            status,
            CONVERT(varchar(19), closedAt, 126) AS closedAt,
            CONVERT(varchar(19), gradingStartedAt, 126) AS gradingStartedAt,
            CONVERT(varchar(19), awardedAt, 126) AS awardedAt,
            CONVERT(varchar(19), cancelledAt, 126) AS cancelledAt,
            cancelledReason
          FROM dbo.Tenders
          WHERE Id = @id
        `);

      return res.json({
        message: 'Chuyển trạng thái thành công',
        tender: tenderRs.recordset[0],
        newStatus: newStatus
      });
    } else {
      return res.status(400).json({ message: 'Chuyển trạng thái thất bại' });
    }
  } catch (err) {
    console.error('[POST /tenders/:id/transition] error:', err);
    console.error('[POST /tenders/:id/transition] error details:', {
      message: err.message,
      originalError: err.originalError?.message,
      tenderId: req.params.id,
      newStatus: req.body?.newStatus
    });

    // Xử lý lỗi từ stored procedure (RAISERROR)
    if (err.originalError) {
      const sqlError = err.originalError;
      if (sqlError.message) {
        // Lấy message từ RAISERROR (format: "Error: Message text")
        const errorMessage = sqlError.message
          .replace(/^.*?Error:\s*/i, '')
          .replace(/^.*?RAISERROR.*?:\s*/i, '')
          .trim();

        if (errorMessage) {
          return res.status(400).json({
            message: errorMessage,
            error: sqlError.message,
            type: 'VALIDATION_ERROR'
          });
        }
      }
    }

    // Xử lý lỗi từ stored procedure (format khác)
    if (err.message && (err.message.includes('RAISERROR') || err.message.includes('Error:'))) {
      const errorMessage = err.message
        .replace(/^.*?Error:\s*/i, '')
        .replace(/^.*?RAISERROR.*?:\s*/i, '')
        .trim();

      return res.status(400).json({
        message: errorMessage || 'Lỗi validation từ stored procedure',
        error: err.message,
        type: 'VALIDATION_ERROR'
      });
    }

    // Xử lý lỗi thông thường
    const sqlError = handleSQLError(err, 'Lỗi chuyển trạng thái');
    return res.status(sqlError.status).json({
      message: sqlError.message,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// API: Tự động đóng các tender hết hạn (có thể gọi định kỳ)
app.post('/tenders/auto-close-expired', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);

    // Chỉ Admin mới được gọi API này
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới được thực hiện thao tác này' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware
    const result = await pool.request()
      .execute('dbo.sp_AutoCloseExpiredTenders');

    const closedCount = result.recordset[0]?.ClosedTenders || 0;

    return res.json({
      message: `Đã tự động đóng ${closedCount} gói thầu hết hạn`,
      closedCount: closedCount
    });
  } catch (err) {
    console.error('[POST /tenders/auto-close-expired] error:', err);
    return res.status(500).json({ message: 'Lỗi tự động đóng thầu' });
  }
});

// API: Lấy thông tin tender kèm validation status
app.get('/tenders/:id/status-info', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware

    const tenderRs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .query(`
        SELECT 
          t.Id, t.code, t.name, t.status,
          CONVERT(varchar(10), t.startDate, 23) AS startDate,
          CONVERT(varchar(10), t.endDate, 23) AS endDate,
          CONVERT(varchar(19), t.closedAt, 126) AS closedAt,
          CONVERT(varchar(19), t.gradingStartedAt, 126) AS gradingStartedAt,
          CONVERT(varchar(19), t.awardedAt, 126) AS awardedAt,
          -- Đếm criteria
          (SELECT COUNT(*) FROM dbo.TenderCriteria WHERE tenderId = t.Id AND Type = 'TECHNICAL' AND IsActive = 1) AS technicalCriteriaCount,
          (SELECT COUNT(*) FROM dbo.TenderCriteria WHERE tenderId = t.Id AND Type = 'FINANCIAL' AND IsActive = 1) AS financialCriteriaCount,
          -- Tổng weight (xử lý NULL)
          ISNULL((SELECT SUM(Weight) FROM dbo.TenderCriteria WHERE tenderId = t.Id AND Type = 'TECHNICAL' AND IsActive = 1), 0) AS technicalWeight,
          ISNULL((SELECT SUM(Weight) FROM dbo.TenderCriteria WHERE tenderId = t.Id AND Type = 'FINANCIAL' AND IsActive = 1), 0) AS financialWeight,
          -- Đếm bids
          (SELECT COUNT(*) FROM dbo.Bids WHERE tenderId = t.Id AND bidAmount > 0) AS validBidCount,
          -- Đếm bids có điểm đầy đủ
          (SELECT COUNT(*) FROM dbo.Bids WHERE tenderId = t.Id AND technicalScore IS NOT NULL AND financialScore IS NOT NULL AND totalScore IS NOT NULL) AS bidsWithCompleteScores,
          -- Có winner chưa (kiểm tra isWinner = 1 hoặc ranking = 1)
          (SELECT COUNT(*) FROM dbo.Bids WHERE tenderId = t.Id AND (isWinner = 1 OR ranking = 1)) AS winnerCount
        FROM dbo.Tenders t
        WHERE t.Id = @tenderId
      `);

    if (!tenderRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }

    const tender = tenderRs.recordset[0];

    // Tính toán các transition có thể thực hiện
    const canTransitionTo = [];
    const currentStatus = tender.status;

    if (currentStatus === 'DRAFT') {
      // Kiểm tra điều kiện để chuyển sang OPEN
      const technicalCount = parseInt(tender.technicalCriteriaCount || 0, 10);
      const financialCount = parseInt(tender.financialCriteriaCount || 0, 10);
      const technicalWeight = parseFloat(tender.technicalWeight || 0);
      const financialWeight = parseFloat(tender.financialWeight || 0);

      const canOpen = technicalCount > 0 &&
        financialCount > 0 &&
        Math.abs(technicalWeight - 100) < 0.01 && // Cho phép sai số nhỏ do DECIMAL
        Math.abs(financialWeight - 100) < 0.01;

      if (canOpen) canTransitionTo.push('OPEN');
      canTransitionTo.push('CANCELLED');
    } else if (currentStatus === 'OPEN') {
      canTransitionTo.push('CLOSED');
      canTransitionTo.push('CANCELLED');
    } else if (currentStatus === 'CLOSED') {
      const validBidCount = parseInt(tender.validBidCount || 0, 10);
      if (validBidCount > 0) {
        canTransitionTo.push('GRADING');
      }
      canTransitionTo.push('CANCELLED');
    } else if (currentStatus === 'GRADING') {
      const validBidCount = parseInt(tender.validBidCount || 0, 10);
      const bidsWithCompleteScores = parseInt(tender.bidsWithCompleteScores || 0, 10);
      const winnerCount = parseInt(tender.winnerCount || 0, 10);

      const allBidsScored = validBidCount > 0 &&
        bidsWithCompleteScores >= validBidCount &&
        winnerCount > 0;
      if (allBidsScored) {
        canTransitionTo.push('PENDING_APPROVAL');
      }
      canTransitionTo.push('CANCELLED');
    } else if (currentStatus === 'PENDING_APPROVAL') {
      canTransitionTo.push('GRADING');
      canTransitionTo.push('AWARDED');
    } else if (currentStatus === 'AWARDED' || currentStatus === 'CANCELLED') {
      // AWARDED và CANCELLED: Không thể chuyển sang trạng thái nào nữa
      // canTransitionTo = [] (rỗng)
    }

    return res.json({
      tender: tender,
      canTransitionTo: canTransitionTo,
      validation: {
        readyForOpen: currentStatus === 'DRAFT' &&
          (parseInt(tender.technicalCriteriaCount || 0, 10) > 0) &&
          (parseInt(tender.financialCriteriaCount || 0, 10) > 0) &&
          (Math.abs(parseFloat(tender.technicalWeight || 0) - 100) < 0.01) &&
          (Math.abs(parseFloat(tender.financialWeight || 0) - 100) < 0.01),
        readyForGrading: currentStatus === 'CLOSED' && (parseInt(tender.validBidCount || 0, 10) > 0),
        readyForApproval: currentStatus === 'GRADING' &&
          (parseInt(tender.validBidCount || 0, 10) > 0) &&
          (parseInt(tender.bidsWithCompleteScores || 0, 10) >= parseInt(tender.validBidCount || 0, 10)) &&
          (parseInt(tender.winnerCount || 0, 10) > 0),
        readyForAwarded: currentStatus === 'PENDING_APPROVAL'
      }
    });
  } catch (err) {
    console.error('[GET /tenders/:id/status-info] error:', err);
    console.error('[GET /tenders/:id/status-info] error details:', {
      message: err.message,
      stack: err.stack,
      tenderId: req.params.id
    });
    return res.status(500).json({
      message: 'Lỗi lấy thông tin trạng thái',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ===== TENDER SCORE CALCULATION APIs =====
// API: Tính điểm tài chính
app.post('/tenders/:id/calculate-financial-scores', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware

    const result = await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .execute('dbo.sp_CalculateFinancialScores');

    return res.json({
      message: 'Tính điểm tài chính thành công',
      updatedBids: result.recordset[0]?.UpdatedBids || 0,
      tenderId: tenderId
    });
  } catch (err) {
    console.error('[POST /tenders/:id/calculate-financial-scores] error:', err);
    return res.status(500).json({
      message: 'Lỗi tính điểm tài chính',
      error: err.message
    });
  }
});

// API: Tính tất cả điểm (Financial + Technical + Total + Ranking)
app.post('/tenders/:id/calculate-scores', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware

    // Tính điểm theo thứ tự: Financial -> Technical -> Total + Ranking
    const financialResult = await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .execute('dbo.sp_CalculateFinancialScores');

    const technicalResult = await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .execute('dbo.sp_CalculateTechnicalScores');

    const totalResult = await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .execute('dbo.sp_CalculateTotalScoresAndRanking');

    return res.json({
      message: 'Tính điểm thành công',
      tenderId: tenderId,
      results: {
        financial: financialResult.recordset[0]?.UpdatedBids || 0,
        technical: technicalResult.recordset[0]?.UpdatedBids || 0,
        total: totalResult.recordset[0]?.UpdatedBids || 0
      }
    });
  } catch (err) {
    console.error('[POST /tenders/:id/calculate-scores] error:', err);
    return res.status(500).json({
      message: err.message || 'Lỗi tính điểm',
      error: err.message
    });
  }
});

// ===== HELPER FUNCTIONS FOR TENDERS =====
async function getTenderStatus(pool, tenderId) {
  if (!tenderId) return null;
  try {
    const rs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .query('SELECT status FROM dbo.Tenders WHERE Id = @tenderId');
    return rs.recordset[0]?.status || null;
  } catch (err) {
    console.error('[getTenderStatus] error:', err);
    return null;
  }
}

// ===== TENDER CRITERIA APIs =====
// GET /tenders/:id/criteria - Lấy danh sách tiêu chí của gói thầu
app.get('/tenders/:id/criteria', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const type = req.query.type; // Optional filter: TECHNICAL or FINANCIAL
    const pool = req.pool; // Sử dụng pool từ middleware

    let query = `
      SELECT 
        Id, tenderId, Name, Description, MaxScore, Weight, Type, [Order], IsActive,
        CONVERT(varchar(19), CreatedAt, 126) AS CreatedAt,
        CONVERT(varchar(19), UpdatedAt, 126) AS UpdatedAt,
        CreatedBy
      FROM dbo.TenderCriteria
      WHERE tenderId = @tenderId
    `;

    if (type) {
      query += ' AND Type = @type';
    }

    query += ' ORDER BY [Order], Id';

    const request = pool.request().input('tenderId', sql.Int, tenderId);
    if (type) {
      request.input('type', sql.NVarChar, type);
    }

    const rs = await request.query(query);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET /tenders/:id/criteria] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy danh sách tiêu chí' });
  }
});

// POST /tenders/:id/criteria - Tạo tiêu chí mới
app.post('/tenders/:id/criteria', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const { Name, Description, MaxScore, Weight, Type, Order, IsActive } = req.body || {};
    const currentUser = await getCurrentUser(req);

    if (!Name || MaxScore === undefined || Weight === undefined || !Type) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const maxScoreVal = Number(MaxScore);
    const weightVal = Number(Weight);
    const validTypes = ['TECHNICAL', 'FINANCIAL'];

    if (!Number.isFinite(maxScoreVal) || maxScoreVal <= 0) {
      return res.status(400).json({ message: 'Điểm tối đa không hợp lệ (phải > 0)' });
    }
    if (!Number.isFinite(weightVal) || weightVal < 0 || weightVal > 100) {
      return res.status(400).json({ message: 'Trọng số không hợp lệ (0 - 100)' });
    }
    if (!validTypes.includes(Type)) {
      return res.status(400).json({ message: 'Loại tiêu chí không hợp lệ' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware
    const tenderStatus = await getTenderStatus(pool, tenderId);
    if (!tenderStatus) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }
    if (tenderStatus !== 'DRAFT') {
      return res.status(400).json({ message: 'Không thể chỉnh sửa tiêu chí khi gói thầu đã mở hoặc không còn ở trạng thái nháp.' });
    }
    const rs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .input('Name', sql.NVarChar, Name)
      .input('Description', sql.NVarChar, Description || null)
      .input('MaxScore', sql.Decimal(18, 2), maxScoreVal)
      .input('Weight', sql.Decimal(5, 2), weightVal)
      .input('Type', sql.NVarChar, Type)
      .input('Order', sql.Int, Order || 0)
      .input('IsActive', sql.Bit, IsActive !== undefined ? IsActive : 1)
      .input('CreatedBy', sql.BigInt, currentUser?.id || null)
      .query(`
        INSERT INTO dbo.TenderCriteria (tenderId, Name, Description, MaxScore, Weight, Type, [Order], IsActive, CreatedBy)
        VALUES (@tenderId, @Name, @Description, @MaxScore, @Weight, @Type, @Order, @IsActive, @CreatedBy);

        SELECT 
          Id,
          tenderId,
          Name,
          Description,
          MaxScore,
          Weight,
          Type,
          [Order],
          IsActive,
          CONVERT(varchar(19), CreatedAt, 126) AS CreatedAt
        FROM dbo.TenderCriteria
        WHERE Id = SCOPE_IDENTITY();
      `);

    return res.status(201).json(rs.recordset[0]);
  } catch (err) {
    console.error('[POST /tenders/:id/criteria] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi tạo tiêu chí');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

// PUT /tenders/:id/criteria/:criteriaId - Cập nhật tiêu chí
app.put('/tenders/:id/criteria/:criteriaId', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const criteriaId = parseInt(req.params.criteriaId, 10);
    const { Name, Description, MaxScore, Weight, Type, Order, IsActive } = req.body || {};

    const maxScoreVal = MaxScore !== undefined && MaxScore !== null ? Number(MaxScore) : null;
    const weightVal = Weight !== undefined && Weight !== null ? Number(Weight) : null;
    const validTypes = ['TECHNICAL', 'FINANCIAL'];

    if (maxScoreVal !== null && (!Number.isFinite(maxScoreVal) || maxScoreVal <= 0)) {
      return res.status(400).json({ message: 'Điểm tối đa không hợp lệ (phải > 0)' });
    }
    if (weightVal !== null && (!Number.isFinite(weightVal) || weightVal < 0 || weightVal > 100)) {
      return res.status(400).json({ message: 'Trọng số không hợp lệ (0 - 100)' });
    }
    if (Type && !validTypes.includes(Type)) {
      return res.status(400).json({ message: 'Loại tiêu chí không hợp lệ' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware
    const tenderStatus = await getTenderStatus(pool, tenderId);
    if (!tenderStatus) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }
    if (tenderStatus !== 'DRAFT') {
      return res.status(400).json({ message: 'Không thể chỉnh sửa tiêu chí khi gói thầu đã mở hoặc không còn ở trạng thái nháp.' });
    }
    const updateRs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .input('criteriaId', sql.Int, criteriaId)
      .input('Name', sql.NVarChar, Name)
      .input('Description', sql.NVarChar, Description || null)
      .input('MaxScore', sql.Decimal(18, 2), maxScoreVal !== null ? maxScoreVal : null)
      .input('Weight', sql.Decimal(5, 2), weightVal !== null ? weightVal : null)
      .input('Type', sql.NVarChar, Type)
      .input('Order', sql.Int, Order)
      .input('IsActive', sql.Bit, IsActive)
      .query(`
        UPDATE dbo.TenderCriteria
        SET 
          Name = COALESCE(@Name, Name),
          Description = COALESCE(@Description, Description),
          MaxScore = COALESCE(@MaxScore, MaxScore),
          Weight = COALESCE(@Weight, Weight),
          Type = COALESCE(@Type, Type),
          [Order] = COALESCE(@Order, [Order]),
          IsActive = COALESCE(@IsActive, IsActive),
          UpdatedAt = GETDATE()
        WHERE Id = @criteriaId AND tenderId = @tenderId;
      `);

    if (updateRs.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tiêu chí' });
    }

    const rs = await pool.request()
      .input('criteriaId', sql.Int, criteriaId)
      .query(`
        SELECT 
          Id, tenderId, Name, Description, MaxScore, Weight, Type, [Order], IsActive,
          CONVERT(varchar(19), CreatedAt, 126) AS CreatedAt,
          CONVERT(varchar(19), UpdatedAt, 126) AS UpdatedAt
        FROM dbo.TenderCriteria
        WHERE Id = @criteriaId
      `);

    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[PUT /tenders/:id/criteria/:criteriaId] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi cập nhật tiêu chí');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

// DELETE /tenders/:id/criteria/:criteriaId - Xóa tiêu chí
app.delete('/tenders/:id/criteria/:criteriaId', async (req, res) => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    const criteriaId = parseInt(req.params.criteriaId, 10);

    const pool = req.pool; // Sử dụng pool từ middleware
    const tenderStatus = await getTenderStatus(pool, tenderId);
    if (!tenderStatus) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu' });
    }
    if (tenderStatus !== 'DRAFT') {
      return res.status(400).json({ message: 'Không thể chỉnh sửa tiêu chí khi gói thầu đã mở hoặc không còn ở trạng thái nháp.' });
    }
    const rs = await pool.request()
      .input('tenderId', sql.Int, tenderId)
      .input('criteriaId', sql.Int, criteriaId)
      .query('DELETE FROM dbo.TenderCriteria WHERE Id = @criteriaId AND tenderId = @tenderId');

    if (rs.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tiêu chí' });
    }

    return res.json({ success: true, id: criteriaId });
  } catch (err) {
    console.error('[DELETE /tenders/:id/criteria/:criteriaId] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa tiêu chí' });
  }
});

// POST /tenders/:id/clone-criteria - Sao chép tiêu chí từ gói thầu khác
app.post('/tenders/:id/clone-criteria', async (req, res) => {
  try {
    const targetTenderId = parseInt(req.params.id, 10);
    const { sourceTenderId } = req.body || {};
    const currentUser = await getCurrentUser(req);

    if (!sourceTenderId) {
      return res.status(400).json({ message: 'Thiếu sourceTenderId' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    // Validation: Check target tender exists and status is DRAFT
    const targetStatus = await getTenderStatus(pool, targetTenderId);
    if (!targetStatus) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu đích' });
    }
    if (targetStatus !== 'DRAFT') {
      return res.status(400).json({ message: 'Chỉ được sao chép tiêu chí khi gói thầu đang ở trạng thái DRAFT' });
    }

    // Validation: Check source tender exists
    const sourceStatus = await getTenderStatus(pool, sourceTenderId);
    if (!sourceStatus) {
      return res.status(404).json({ message: 'Không tìm thấy gói thầu nguồn' });
    }

    // Check if source tender has criteria
    const sourceCriteriaCount = await pool.request()
      .input('sourceTenderId', sql.Int, sourceTenderId)
      .query('SELECT COUNT(*) AS count FROM dbo.TenderCriteria WHERE tenderId = @sourceTenderId AND IsActive = 1');

    const count = sourceCriteriaCount.recordset[0]?.count || 0;
    if (count === 0) {
      return res.status(400).json({ message: 'Gói thầu nguồn không có tiêu chí nào để sao chép' });
    }

    // Clean up: Delete all existing criteria of target tender
    await pool.request()
      .input('targetTenderId', sql.Int, targetTenderId)
      .query('DELETE FROM dbo.TenderCriteria WHERE tenderId = @targetTenderId');

    // Cloning: Insert criteria from source to target
    const cloneResult = await pool.request()
      .input('sourceTenderId', sql.Int, sourceTenderId)
      .input('targetTenderId', sql.Int, targetTenderId)
      .input('createdBy', sql.BigInt, currentUser?.id || null)
      .query(`
        INSERT INTO dbo.TenderCriteria (tenderId, Name, Description, MaxScore, Weight, Type, [Order], IsActive, CreatedBy)
        SELECT 
          @targetTenderId AS tenderId,
          Name,
          Description,
          MaxScore,
          Weight,
          Type,
          [Order],
          IsActive,
          @createdBy AS CreatedBy
        FROM dbo.TenderCriteria
        WHERE tenderId = @sourceTenderId AND IsActive = 1
        ORDER BY [Order], Id
      `);

    const clonedCount = cloneResult.rowsAffected[0] || 0;

    // Audit Log
    try {
      await pool.request()
        .input('action', sql.NVarChar, 'CLONE_CRITERIA')
        .input('entityType', sql.NVarChar, 'Tender')
        .input('entityId', sql.Int, targetTenderId)
        .input('userId', sql.BigInt, currentUser?.id || null)
        .input('details', sql.NVarChar, `Đã sao chép ${clonedCount} tiêu chí từ gói thầu #${sourceTenderId} sang gói thầu #${targetTenderId}`)
        .query(`
          INSERT INTO dbo.AuditLogs (action, entityType, entityId, userId, details, createdAt)
          VALUES (@action, @entityType, @entityId, @userId, @details, GETDATE())
        `);
    } catch (auditErr) {
      console.warn('[CLONE_CRITERIA] Failed to log audit:', auditErr.message);
    }

    return res.json({
      success: true,
      message: `Sao chép thành công ${clonedCount} tiêu chí`,
      clonedCount: clonedCount
    });
  } catch (err) {
    console.error('[POST /tenders/:id/clone-criteria] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi sao chép tiêu chí');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

// ===== BID CRITERIA SCORES APIs =====
// GET /bids/:id/criteria-scores - Lấy điểm chi tiết của hồ sơ dự thầu
app.get('/bids/:id/criteria-scores', async (req, res) => {
  try {
    const bidId = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware

    const rs = await pool.request()
      .input('bidId', sql.Int, bidId)
      .query(`
        SELECT 
          bcs.Id, bcs.bidId, bcs.criteriaId, bcs.score, bcs.notes,
          CONVERT(varchar(19), bcs.scoredAt, 126) AS scoredAt,
          bcs.scoredBy,
          tc.Name AS criteriaName,
          tc.Type AS criteriaType,
          tc.MaxScore AS criteriaMaxScore,
          tc.Weight AS criteriaWeight
        FROM dbo.BidCriteriaScores bcs
        INNER JOIN dbo.TenderCriteria tc ON bcs.criteriaId = tc.Id
        WHERE bcs.bidId = @bidId
        ORDER BY tc.Type, tc.[Order], tc.Id
      `);

    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET /bids/:id/criteria-scores] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy điểm chi tiết' });
  }
});

// POST /bids/:id/criteria-scores - Lưu điểm chi tiết
app.post('/bids/:id/criteria-scores', async (req, res) => {
  try {
    const bidId = parseInt(req.params.id, 10);
    const { scores } = req.body || {}; // Array of { criteriaId, score, notes? }
    const currentUser = await getCurrentUser(req);

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: 'Thiếu dữ liệu điểm' });
    }

    const pool = req.pool; // Sử dụng pool từ middleware

    const bidInfoRs = await pool.request()
      .input('bidId', sql.Int, bidId)
      .query(`
        SELECT b.tenderId, t.status
        FROM dbo.Bids b
        INNER JOIN dbo.Tenders t ON b.tenderId = t.Id
        WHERE b.Id = @bidId
      `);

    if (!bidInfoRs.recordset.length) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ dự thầu' });
    }

    const tenderId = bidInfoRs.recordset[0].tenderId;
    const tenderStatus = bidInfoRs.recordset[0].status;

    if (tenderStatus !== 'GRADING') {
      return res.status(400).json({ message: `Chỉ được cập nhật điểm khi gói thầu đang ở trạng thái GRADING (hiện tại: ${tenderStatus})` });
    }

    // Xóa điểm cũ của bid này
    await pool.request()
      .input('bidId', sql.Int, bidId)
      .query('DELETE FROM dbo.BidCriteriaScores WHERE bidId = @bidId');

    // Thêm điểm mới
    for (const scoreData of scores) {
      const { criteriaId, score, notes } = scoreData;

      // Validate score không vượt quá MaxScore
      const criteriaRs = await pool.request()
        .input('criteriaId', sql.Int, criteriaId)
        .query('SELECT MaxScore FROM dbo.TenderCriteria WHERE Id = @criteriaId');

      if (!criteriaRs.recordset.length) {
        continue; // Skip nếu không tìm thấy criteria
      }

      const maxScore = criteriaRs.recordset[0].MaxScore;
      const finalScore = Math.min(parseFloat(score) || 0, maxScore);

      await pool.request()
        .input('bidId', sql.Int, bidId)
        .input('criteriaId', sql.Int, criteriaId)
        .input('score', sql.Decimal(18, 2), finalScore)
        .input('notes', sql.NVarChar, notes || null)
        .input('scoredBy', sql.BigInt, currentUser?.id || null)
        .query(`
          INSERT INTO dbo.BidCriteriaScores (bidId, criteriaId, score, notes, scoredBy)
          VALUES (@bidId, @criteriaId, @score, @notes, @scoredBy)
        `);
    }

    // Tính lại điểm kỹ thuật và tổng điểm sau khi cập nhật
    await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .execute('dbo.sp_CalculateTechnicalScores');

    await pool.request()
      .input('TenderId', sql.Int, tenderId)
      .execute('dbo.sp_CalculateTotalScoresAndRanking');

    // Lấy lại danh sách điểm đã lưu
    const resultRs = await pool.request()
      .input('bidId', sql.Int, bidId)
      .query(`
        SELECT 
          bcs.Id, bcs.bidId, bcs.criteriaId, bcs.score, bcs.notes,
          CONVERT(varchar(19), bcs.scoredAt, 126) AS scoredAt,
          tc.Name AS criteriaName
        FROM dbo.BidCriteriaScores bcs
        INNER JOIN dbo.TenderCriteria tc ON bcs.criteriaId = tc.Id
        WHERE bcs.bidId = @bidId
      `);

    return res.json({
      message: 'Lưu điểm thành công',
      scores: resultRs.recordset
    });
  } catch (err) {
    console.error('[POST /bids/:id/criteria-scores] error:', err);
    const sqlError = handleSQLError(err, 'Lỗi lưu điểm');
    return res.status(sqlError.status).json({ message: sqlError.message });
  }
});

/**
 * API 1: Lấy danh sách TẤT CẢ các quy tắc thuế
 * (Dùng cho Tab 3: TaxRulesViewer)
 */
app.get('/taxes/rules', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rules = await getTaxRules(pool, sql); // Gọi hàm engine
    return res.json({
      message: `Lấy thành công ${rules.length} quy tắc thuế.`,
      data: rules
    });
  } catch (err) {
    console.error('[GET /taxes/rules] error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ', details: err.message });
  }
});

/**
 * API 2: Kích hoạt tính thuế cho MỘT Giao dịch
 */
app.post('/taxes/calculate/transaction', async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId || isNaN(parseInt(transactionId))) {
    return res.status(400).json({ error: 'Thiếu hoặc transactionId không hợp lệ.' });
  }

  const txId = parseInt(transactionId);

  try {
    const pool = req.pool; // Sử dụng pool từ middleware

    // 1. Gọi "bộ não" SQL
    await pool.request()
      .input('TransactionID', sql.Int, txId)
      .execute('dbo.sp_CalculateTaxesForTransaction');

    // 2. Lấy kết quả mà "bộ não" vừa lưu (để trả về cho UI)
    const results = await pool.request()
      .input('TransactionID', sql.Int, txId)
      .query('SELECT * FROM dbo.TransactionTaxes WHERE TransactionID = @TransactionID');

    return res.json({
      message: `Tính thuế thành công cho TransactionID: ${txId}.`,
      data: results.recordset
    });
  } catch (err) {
    console.error(`[POST /taxes/calculate/transaction] (ID: ${txId}) error:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ', details: err.message });
  }
});

/**
 * API 3: Kích hoạt tính thuế cho MỘT Hóa đơn
 * (Dùng cho Tab 1: InvoiceTaxCalculator)
 */
app.post('/taxes/calculate/invoice/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  if (!invoiceId || isNaN(parseInt(invoiceId))) {
    return res.status(400).json({ error: 'Thiếu hoặc invoiceId không hợp lệ.' });
  }
  const invId = parseInt(invoiceId);
  try {
    const pool = req.pool; // Sử dụng pool từ middleware

    // 1. Gọi "bộ não" SQL (đã nâng cấp)
    const spResult = await pool.request()
      .input('InvoiceID', sql.Int, invId)
      .execute('dbo.sp_CalculateTaxesForInvoice');

    const transactionsProcessed = spResult.recordset[0].TransactionsProcessed;

    // 2. Lấy kết quả tóm tắt và chi tiết
    const [summaryResult, detailsResult] = await Promise.all([
      // Lấy tóm tắt
      pool.request()
        .input('InvoiceID', sql.Int, invId)
        .query(`
                    SELECT it.*, tt.Name AS TaxTypeName, tt.DefaultDirection AS TaxDirection
                    FROM dbo.InvoiceTaxes it
                    JOIN dbo.TaxTypes tt ON it.TaxTypeID = tt.Id
                    WHERE it.InvoiceID = @InvoiceID
                `),
      // Lấy chi tiết
      pool.request()
        .input('InvoiceID', sql.Int, invId)
        .query(`
                    SELECT 
                        tt.TransactionID, tt.BaseAmount, tt.AppliedRate, tt.TaxAmount, 
                        tx.description AS TransactionDescription,
                        t.Name AS TaxTypeName, t.DefaultDirection AS TaxDirection
                     FROM dbo.TransactionTaxes tt
                    JOIN dbo.Transactions tx ON tt.TransactionID = tx.Id
                    JOIN dbo.TaxTypes t ON tt.TaxTypeID = t.Id
                    WHERE tx.invoiceId = @InvoiceID
                `)
    ]);

    // 3. Gói kết quả trả về
    const report = {
      invoiceId: invId,
      transactionsProcessed: transactionsProcessed,
      summary: summaryResult.recordset,
      details: detailsResult.recordset
    };

    return res.json({
      message: `Tính thuế thành công cho InvoiceID: ${invId}.`,
      data: report
    });
  } catch (err) {
    console.error(`[POST /taxes/calculate/invoice] (ID: ${invId}) error:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ', details: err.message });
  }
});

/**
 * API 4: Lấy Báo Cáo VAT (Input/Output/Net)
 * (Dùng cho Tab 2: VatReport)
 */
app.get('/taxes/report/vat', async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
    return res.status(400).json({ error: 'Thiếu hoặc (month, year) không hợp lệ.' });
  }

  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const report = await getVatReport(pool, sql, parseInt(month), parseInt(year));

    return res.json({
      message: `Lấy báo cáo VAT thành công cho ${month}/${year}.`,
      data: report
    });
  } catch (err) {
    console.error(`[GET /taxes/report/vat] (Tháng: ${month}/${year}) error:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ', details: err.message });
  }
});

/**
 * API 5: Lấy Báo Cáo Thuế Phải Nộp Nhà Nước
 * LOGIC ĐÚNG: Tách biệt 2 loại báo cáo:
 * 1. Báo cáo VAT: VAT_OUTPUT - VAT_INPUT (có thể bù trừ)
 * 2. Báo cáo Thuế Thu Hộ: VAT_RENTAL + PIT_RENTAL (không thể bù trừ với VAT_INPUT)
 */
app.get('/taxes/report/payable', async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
    return res.status(400).json({ error: 'Thiếu hoặc (month, year) không hợp lệ.' });
  }

  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const reportRequest = pool.request();
    const result = await reportRequest
      .input('Month', sql.Int, parseInt(month))
      .input('Year', sql.Int, parseInt(year))
      .query(`
                SELECT 
                    tt.Id AS TaxTypeID,
                    tt.Code AS TaxTypeCode,
                    tt.Name AS TaxTypeName,
                    tt.DefaultDirection,
                    ISNULL(SUM(CASE WHEN MONTH(t.[date]) = @Month AND YEAR(t.[date]) = @Year THEN ttx.TaxAmount ELSE 0 END), 0) AS TotalTaxAmount,
                    COUNT(DISTINCT CASE WHEN MONTH(t.[date]) = @Month AND YEAR(t.[date]) = @Year THEN ttx.TransactionID ELSE NULL END) AS TransactionCount
                FROM dbo.TaxTypes tt
                LEFT JOIN dbo.TransactionTaxes ttx ON tt.Id = ttx.TaxTypeID
                LEFT JOIN dbo.Transactions t ON ttx.TransactionID = t.Id
                WHERE tt.IsActive = 1
                GROUP BY tt.Id, tt.Code, tt.Name, tt.DefaultDirection
                HAVING ISNULL(SUM(CASE WHEN MONTH(t.[date]) = @Month AND YEAR(t.[date]) = @Year THEN ttx.TaxAmount ELSE 0 END), 0) > 0
                ORDER BY tt.DefaultDirection DESC, tt.Code ASC
            `);

    // TÁCH BIỆT THEO LOẠI THUẾ:
    // 1. VAT (TaxTypeID 1, 2): Có thể bù trừ giữa OUTPUT và INPUT
    const vatOutput = result.recordset.find(t => t.TaxTypeCode === 'VAT_OUTPUT');
    const vatInput = result.recordset.find(t => t.TaxTypeCode === 'VAT_INPUT');
    const vatOutputAmount = vatOutput ? parseFloat(vatOutput.TotalTaxAmount || 0) : 0;
    const vatInputAmount = vatInput ? parseFloat(vatInput.TotalTaxAmount || 0) : 0;
    const vatNet = vatOutputAmount - vatInputAmount; // VAT có thể bù trừ

    // 2. Thuế Thu Hộ (TaxTypeID 4, 5): VAT_RENTAL và PIT_RENTAL - KHÔNG thể bù trừ với VAT_INPUT
    const vatRental = result.recordset.find(t => t.TaxTypeCode === 'VAT_RENTAL');
    const pitRental = result.recordset.find(t => t.TaxTypeCode === 'PIT_RENTAL');
    const vatRentalAmount = vatRental ? parseFloat(vatRental.TotalTaxAmount || 0) : 0;
    const pitRentalAmount = pitRental ? parseFloat(pitRental.TotalTaxAmount || 0) : 0;
    const withholdingTaxTotal = vatRentalAmount + pitRentalAmount; // Thuế thu hộ phải nộp

    // 3. Các loại thuế khác (OUTPUT khác VAT và Thuế Thu Hộ)
    const otherOutputTaxes = result.recordset.filter(t =>
      t.DefaultDirection === 'OUTPUT'
      && t.TaxTypeCode !== 'VAT_OUTPUT'
      && t.TaxTypeCode !== 'VAT_RENTAL'
      && t.TaxTypeCode !== 'PIT_RENTAL'
    );
    const otherOutputTotal = otherOutputTaxes.reduce((sum, t) => sum + parseFloat(t.TotalTaxAmount || 0), 0);

    // 4. Tổng kết: VAT Net + Thuế Thu Hộ + Các thuế khác
    const totalNetPayable = vatNet + withholdingTaxTotal + otherOutputTotal;

    // Đảm bảo luôn trả về cấu trúc đầy đủ, ngay cả khi không có dữ liệu

    return res.json({
      message: `Lấy báo cáo thuế phải nộp thành công cho ${month}/${year}.`,
      data: {
        month: parseInt(month),
        year: parseInt(year),
        // Báo cáo VAT (có thể bù trừ)
        vatReport: {
          output: vatOutputAmount,
          input: vatInputAmount,
          net: vatNet,
          details: [
            vatOutput ? {
              taxTypeId: vatOutput.TaxTypeID,
              taxTypeCode: vatOutput.TaxTypeCode,
              taxTypeName: vatOutput.TaxTypeName,
              totalAmount: vatOutputAmount,
              transactionCount: vatOutput.TransactionCount
            } : null,
            vatInput ? {
              taxTypeId: vatInput.TaxTypeID,
              taxTypeCode: vatInput.TaxTypeCode,
              taxTypeName: vatInput.TaxTypeName,
              totalAmount: vatInputAmount,
              transactionCount: vatInput.TransactionCount
            } : null
          ].filter(Boolean)
        },
        // Báo cáo Thuế Thu Hộ (không thể bù trừ)
        withholdingTaxReport: {
          total: withholdingTaxTotal,
          details: [
            vatRental ? {
              taxTypeId: vatRental.TaxTypeID,
              taxTypeCode: vatRental.TaxTypeCode,
              taxTypeName: vatRental.TaxTypeName,
              totalAmount: vatRentalAmount,
              transactionCount: vatRental.TransactionCount
            } : null,
            pitRental ? {
              taxTypeId: pitRental.TaxTypeID,
              taxTypeCode: pitRental.TaxTypeCode,
              taxTypeName: pitRental.TaxTypeName,
              totalAmount: pitRentalAmount,
              transactionCount: pitRental.TransactionCount
            } : null
          ].filter(Boolean)
        },
        // Các loại thuế khác
        otherTaxes: {
          total: otherOutputTotal,
          details: otherOutputTaxes.map(t => ({
            taxTypeId: t.TaxTypeID,
            taxTypeCode: t.TaxTypeCode,
            taxTypeName: t.TaxTypeName,
            totalAmount: parseFloat(t.TotalTaxAmount || 0),
            transactionCount: t.TransactionCount
          }))
        },
        // Tổng kết cuối cùng
        totalNetPayable: totalNetPayable
      }
    });
  } catch (err) {
    console.error(`[GET /taxes/report/payable] (Tháng: ${month}/${year}) error:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ', details: err.message });
  }
});

/**
 * API 6: Lấy Báo Cáo Kê Khai Thuế Tổng Hợp (Đã sửa logic - Dùng Stored Procedure)
 * (Dùng cho Tab 3 "Thuế Phải Nộp Nhà Nước")
 * Phương pháp mới: Sử dụng Stored Procedure để đơn giản hóa và tối ưu hiệu suất
 */
app.get('/taxes/report/comprehensive', async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
    return res.status(400).json({ error: 'Thiếu hoặc (month, year) không hợp lệ.' });
  }

  try {
    const pool = req.pool; // Sử dụng pool từ middleware

    // 1. Gọi "bộ não" SQL mới (Stored Procedure)
    let result;
    try {
      result = await pool.request()
        .input('Month', sql.Int, parseInt(month))
        .input('Year', sql.Int, parseInt(year))
        .execute('dbo.sp_GetComprehensiveTaxReport');
    } catch (spError) {
      // Nếu SP chưa tồn tại, fallback về query trực tiếp
      console.warn(`[GET /taxes/report/comprehensive] SP not found, using direct query:`, spError.message);

      // Fallback: Query trực tiếp từ TransactionTaxes
      const fallbackResult = await pool.request()
        .input('Month', sql.Int, parseInt(month))
        .input('Year', sql.Int, parseInt(year))
        .query(`
                    SELECT
                        ISNULL(SUM(CASE WHEN types.Code = 'VAT_OUTPUT' THEN taxes.TaxAmount ELSE 0 END), 0) AS TotalVatOutput,
                        ISNULL(SUM(CASE WHEN types.Code = 'VAT_INPUT' THEN taxes.TaxAmount ELSE 0 END), 0) AS TotalVatInput,
                        ISNULL(SUM(CASE WHEN types.Code = 'VAT_RENTAL' THEN taxes.TaxAmount ELSE 0 END), 0) AS TotalVatRental,
                        ISNULL(SUM(CASE WHEN types.Code = 'PIT_RENTAL' THEN taxes.TaxAmount ELSE 0 END), 0) AS TotalPitRental
                    FROM 
                        dbo.TransactionTaxes AS taxes
                    JOIN 
                        dbo.Transactions AS trans ON taxes.TransactionID = trans.Id
                    JOIN 
                        dbo.TaxTypes AS types ON taxes.TaxTypeID = types.Id
                    WHERE 
                        MONTH(trans.[date]) = @Month AND YEAR(trans.[date]) = @Year
                `);

      result = { recordset: fallbackResult.recordset };
    }

    if (!result.recordset || result.recordset.length === 0) {
      // Trả về dữ liệu mặc định nếu không có dữ liệu
      const emptyReport = {
        month: parseInt(month),
        year: parseInt(year),
        outputDetails: [],
        inputDetails: [],
        totalPayable: 0,
        totalRefundable: 0,
        totalInput: 0,
        vatReport: {
          output: 0,
          input: 0,
          net: 0,
          details: []
        },
        withholdingTaxReport: {
          total: 0,
          details: []
        },
        otherTaxes: {
          total: 0,
          details: []
        },
        totalNetPayable: 0
      };
      return res.json({
        message: `Lấy báo cáo tổng hợp thành công cho ${month}/${year} (không có dữ liệu).`,
        data: emptyReport
      });
    }

    const rawData = result.recordset[0];
    // rawData sẽ là: { TotalVatOutput, TotalVatInput, TotalVatRental, TotalPitRental }

    // 2. [LOGIC NGHIỆP VỤ ĐÚNG]

    // --- Trò chơi 1: Tính toán VAT ---
    const totalVatOutput = parseFloat(rawData.TotalVatOutput || 0);
    const totalVatInput = parseFloat(rawData.TotalVatInput || 0);
    const netVAT = totalVatOutput - totalVatInput;

    // Tiền VAT phải nộp (nếu > 0)
    const vatPayable = (netVAT > 0) ? netVAT : 0;
    // Tiền VAT được hoàn/khấu trừ (nếu < 0)
    const vatRefundable = (netVAT < 0) ? Math.abs(netVAT) : 0;

    // --- Trò chơi 2: Tính Thuế Thu Hộ ---
    const totalVatRental = parseFloat(rawData.TotalVatRental || 0);
    const totalPitRental = parseFloat(rawData.TotalPitRental || 0);
    const totalWithholding = totalVatRental + totalPitRental;

    // --- Kết quả cuối cùng ---

    // Tổng tiền phải nộp cho nhà nước = (Thuế thu hộ) + (VAT phải nộp nếu có)
    const finalTotalPayable = totalWithholding + vatPayable;

    // 3. Gói dữ liệu trả về cho Frontend (tương thích với cấu trúc cũ)
    const report = {
      month: parseInt(month),
      year: parseInt(year),

      // Dữ liệu chi tiết cho 2 bảng (OUTPUT và INPUT)
      outputDetails: [
        { type: 'Thuế GTGT Đầu ra', code: 'VAT_OUTPUT', amount: totalVatOutput },
        { type: 'Thuế GTGT (Cho thuê khoán)', code: 'VAT_RENTAL', amount: totalVatRental },
        { type: 'Thuế TNCN (Cho thuê khoán)', code: 'PIT_RENTAL', amount: totalPitRental }
      ].filter(item => item.amount > 0), // Chỉ hiển thị các loại có số tiền > 0

      inputDetails: [
        { type: 'Thuế GTGT Đầu vào', code: 'VAT_INPUT', amount: totalVatInput }
      ].filter(item => item.amount > 0), // Chỉ hiển thị các loại có số tiền > 0

      // Dữ liệu cho các thẻ tổng kết
      totalPayable: finalTotalPayable,  // Thẻ ĐỎ (Tổng Phải Nộp)
      totalRefundable: vatRefundable,   // Thẻ XANH LÁ (Thuế Được Hoàn)
      totalInput: totalVatInput,         // Thẻ XANH DƯƠNG (Tổng Được Khấu Trừ)

      // Tương thích với cấu trúc cũ (để frontend có thể dùng cả 2 API)
      vatReport: {
        output: totalVatOutput,
        input: totalVatInput,
        net: netVAT,
        details: [
          totalVatOutput > 0 ? {
            taxTypeId: 1, // Giả định VAT_OUTPUT có ID = 1
            taxTypeCode: 'VAT_OUTPUT',
            taxTypeName: 'Thuế GTGT Đầu ra',
            totalAmount: totalVatOutput,
            transactionCount: 0 // SP không trả về số lượng, có thể query thêm nếu cần
          } : null,
          totalVatInput > 0 ? {
            taxTypeId: 2, // Giả định VAT_INPUT có ID = 2
            taxTypeCode: 'VAT_INPUT',
            taxTypeName: 'Thuế GTGT Đầu vào',
            totalAmount: totalVatInput,
            transactionCount: 0
          } : null
        ].filter(Boolean)
      },
      withholdingTaxReport: {
        total: totalWithholding,
        details: [
          totalVatRental > 0 ? {
            taxTypeId: 4, // Giả định VAT_RENTAL có ID = 4
            taxTypeCode: 'VAT_RENTAL',
            taxTypeName: 'Thuế GTGT (Cho thuê khoán)',
            totalAmount: totalVatRental,
            transactionCount: 0
          } : null,
          totalPitRental > 0 ? {
            taxTypeId: 5, // Giả định PIT_RENTAL có ID = 5
            taxTypeCode: 'PIT_RENTAL',
            taxTypeName: 'Thuế TNCN (Cho thuê khoán)',
            totalAmount: totalPitRental,
            transactionCount: 0
          } : null
        ].filter(Boolean)
      },
      otherTaxes: {
        total: 0,
        details: []
      },
      totalNetPayable: finalTotalPayable
    };

    return res.json({
      message: `Lấy báo cáo tổng hợp thành công cho ${month}/${year}.`,
      data: report
    });
  } catch (err) {
    console.error(`[GET /taxes/report/comprehensive] (Tháng: ${month}/${year}) error:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ', details: err.message });
  }
});

// ===== CRUD: News =====
app.get('/news', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(n.Id AS INT) AS id,
        ISNULL(n.title, '') AS title,
        ISNULL(n.content, '') AS content,
        ISNULL(n.category, '') AS category,
        ISNULL(n.status, 'draft') AS status,
        CAST(n.authorId AS BIGINT) AS authorId,
        ISNULL(u.fullName, '') AS author,
        CAST(n.buildingId AS INT) AS buildingId,
        ISNULL(b.name, '') AS buildingName,
        ISNULL(n.sendDate, GETDATE()) AS sendDate,
        ISNULL(n.publishedDate, NULL) AS publishedDate,
        ISNULL(n.images, '[]') AS images,
        ISNULL(n.createdAt, GETDATE()) AS createdAt,
        ISNULL(n.updatedAt, NULL) AS updatedAt
      FROM dbo.News n
      LEFT JOIN dbo.Users u ON n.authorId = u.Id
      LEFT JOIN dbo.Buildings b ON n.buildingId = b.Id
      ORDER BY n.Id DESC
    `);
    // Parse images JSON if it's a string
    const news = rs.recordset.map(item => ({
      ...item,
      images: typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || [])
    }));
    return res.json(news);
  } catch (err) {
    console.error('[GET news] error:', err);
    return res.json([]); // Return empty array instead of error
  }
});

app.get('/news/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          CAST(n.Id AS INT) AS id,
          ISNULL(n.title, '') AS title,
          ISNULL(n.content, '') AS content,
          ISNULL(n.category, '') AS category,
          ISNULL(n.status, 'draft') AS status,
          CAST(n.authorId AS BIGINT) AS authorId,
          ISNULL(u.fullName, '') AS author,
          CAST(n.buildingId AS INT) AS buildingId,
          ISNULL(b.name, '') AS buildingName,
          ISNULL(n.sendDate, GETDATE()) AS sendDate,
          ISNULL(n.publishedDate, NULL) AS publishedDate,
          ISNULL(n.images, '[]') AS images,
          ISNULL(n.createdAt, GETDATE()) AS createdAt,
          ISNULL(n.updatedAt, NULL) AS updatedAt
        FROM dbo.News n
        LEFT JOIN dbo.Users u ON n.authorId = u.Id
        LEFT JOIN dbo.Buildings b ON n.buildingId = b.Id
        WHERE n.Id = @id
      `);
    const item = checkRecordExists(rs.recordset, 'tin tức'); // Sử dụng helper
    item.images = typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []);
    return res.json(item);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[GET news/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy tin tức' });
  }
});

app.post('/news', async (req, res) => {
  try {
    const { title, content, category, status, authorId, buildingId, sendDate, publishedDate, images } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const nextId = await getNextId('dbo.News', pool.request());
    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('category', sql.NVarChar, category || 'Tin tức')
      .input('status', sql.NVarChar, status || 'draft')
      .input('authorId', sql.BigInt, authorId || null)
      .input('buildingId', sql.Int, buildingId || null)
      .input('sendDate', sql.DateTime2, sendDate ? new Date(sendDate) : new Date())
      .input('publishedDate', sql.DateTime2, publishedDate ? new Date(publishedDate) : null)
      .input('images', sql.NVarChar, JSON.stringify(images || []))
      .query(`INSERT INTO dbo.News (Id, title, content, category, status, authorId, buildingId, sendDate, publishedDate, images, createdAt)
              OUTPUT INSERTED.Id, INSERTED.title, INSERTED.content, INSERTED.category, INSERTED.status, 
                     INSERTED.authorId, INSERTED.buildingId, INSERTED.sendDate, INSERTED.publishedDate, INSERTED.images, INSERTED.createdAt
              VALUES (@Id, @title, @content, @category, @status, @authorId, @buildingId, @sendDate, @publishedDate, @images, GETDATE())`);
    const item = rs.recordset[0];
    // Get author and building names
    if (item.authorId) {
      const userRs = await pool.request().input('id', sql.BigInt, item.authorId).query('SELECT fullName FROM dbo.Users WHERE Id = @id');
      item.author = userRs.recordset[0]?.fullName || '';
    } else {
      item.author = '';
    }
    if (item.buildingId) {
      const buildingRs = await pool.request().input('id', sql.Int, item.buildingId).query('SELECT name FROM dbo.Buildings WHERE Id = @id');
      item.buildingName = buildingRs.recordset[0]?.name || '';
    } else {
      item.buildingName = '';
    }
    item.images = typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []);
    return res.status(201).json(item);
  } catch (err) {
    console.error('[POST news] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo tin tức' });
  }
});

app.put('/news/:id', parseId(), async (req, res) => {
  try {
    const id = req.parsedId; // Sử dụng ID từ middleware
    const { title, content, category, status, authorId, buildingId, sendDate, publishedDate, images } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('category', sql.NVarChar, category)
      .input('status', sql.NVarChar, status)
      .input('authorId', sql.BigInt, authorId || null)
      .input('buildingId', sql.Int, buildingId || null)
      .input('sendDate', sql.DateTime2, sendDate ? new Date(sendDate) : null)
      .input('publishedDate', sql.DateTime2, publishedDate ? new Date(publishedDate) : null)
      .input('images', sql.NVarChar, JSON.stringify(images || []))
      .query(`UPDATE dbo.News SET 
                title = @title,
                content = @content,
                category = @category,
                status = @status,
                authorId = @authorId,
                buildingId = @buildingId,
                sendDate = @sendDate,
                publishedDate = @publishedDate,
                images = @images,
                updatedAt = GETDATE()
              OUTPUT INSERTED.Id, INSERTED.title, INSERTED.content, INSERTED.category, INSERTED.status,
                     INSERTED.authorId, INSERTED.buildingId, INSERTED.sendDate, INSERTED.publishedDate, INSERTED.images, INSERTED.updatedAt
              WHERE Id = @id`);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy tin tức' });
    const item = rs.recordset[0];
    // Get author and building names
    if (item.authorId) {
      const userRs = await pool.request().input('userId', sql.BigInt, item.authorId).query('SELECT fullName FROM dbo.Users WHERE Id = @userId');
      item.author = userRs.recordset[0]?.fullName || '';
    } else {
      item.author = '';
    }
    if (item.buildingId) {
      const buildingRs = await pool.request().input('buildingId', sql.Int, item.buildingId).query('SELECT name FROM dbo.Buildings WHERE Id = @buildingId');
      item.buildingName = buildingRs.recordset[0]?.name || '';
    } else {
      item.buildingName = '';
    }
    item.images = typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []);
    return res.json(item);
  } catch (err) {
    console.error('[PUT news/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật tin tức' });
  }
});

app.delete('/news/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.News WHERE Id = @id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE news/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa tin tức' });
  }
});

//  CRUD: Posts 
// 1. GET ALL POSTS
app.get('/posts', async (req, res) => {
  try {
    const pool = req.pool;
    const rs = await pool.request().query(`
      SELECT 
        CAST(p.Id AS INT) AS id,
        ISNULL(p.title, '') AS title,
        ISNULL(p.content, '') AS content,
        CAST(p.senderId AS BIGINT) AS senderId, -- senderId có thể là User hoặc Customer
        
        -- LOGIC TÌM TÊN NGƯỜI GỬI (Ưu tiên Users/BQL, sau đó đến Customers)
        COALESCE(u.fullName, c.name, N'Không rõ') AS senderName,
        
        -- Xác định vai trò để hiển thị (Tùy chọn)
        CASE 
            WHEN u.Id IS NOT NULL THEN 'Manager'
            WHEN c.Id IS NOT NULL THEN 'Resident'
            ELSE 'Unknown'
        END AS senderRole,

        CAST(p.apartmentId AS INT) AS apartmentId,
        ISNULL(a.name, '') AS apartmentName,
        ISNULL(p.topic, '') AS topic,
        ISNULL(p.status, 'pending') AS status,
        ISNULL(p.imageUrl, '') AS imageUrl,
        ISNULL(p.createdAt, GETDATE()) AS createdAt,
        ISNULL(p.updatedAt, NULL) AS updatedAt
      FROM dbo.Posts p
      LEFT JOIN dbo.Users u ON p.senderId = u.Id      -- Link với bảng Admin
      LEFT JOIN dbo.Customers c ON p.senderId = c.Id  -- Link với bảng Cư dân
      LEFT JOIN dbo.Apartments a ON p.apartmentId = a.Id
      ORDER BY p.Id DESC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET posts] error:', err);
    return res.json([]);
  }
});

// 2. GET POST BY ID
app.get('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool;
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          CAST(p.Id AS INT) AS id,
          ISNULL(p.title, '') AS title,
          ISNULL(p.content, '') AS content,
          CAST(p.senderId AS BIGINT) AS senderId,
          
          -- LOGIC TÌM TÊN
          COALESCE(u.fullName, c.name, N'Không rõ') AS senderName,

          CAST(p.apartmentId AS INT) AS apartmentId,
          ISNULL(a.name, '') AS apartmentName,
          ISNULL(p.topic, '') AS topic,
          ISNULL(p.status, 'pending') AS status,
          ISNULL(p.imageUrl, '') AS imageUrl,
          ISNULL(p.createdAt, GETDATE()) AS createdAt,
          ISNULL(p.updatedAt, NULL) AS updatedAt
        FROM dbo.Posts p
        LEFT JOIN dbo.Users u ON p.senderId = u.Id
        LEFT JOIN dbo.Customers c ON p.senderId = c.Id
        LEFT JOIN dbo.Apartments a ON p.apartmentId = a.Id
        WHERE p.Id = @id
      `);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[GET posts/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy bài viết' });
  }
});

// 3. POST (CREATE) POST
app.post('/posts', async (req, res) => {
  try {
    const { title, content, senderId, apartmentId, topic, status, imageUrl } = req.body || {};
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Tiêu đề không được để trống' });
    }

    const pool = req.pool;
    const nextId = await getNextId('dbo.Posts', pool.request());
    const finalImageUrl = imageUrl || '';

    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('title', sql.NVarChar(500), title.trim())
      .input('content', sql.NVarChar(sql.MAX), content || '')
      .input('senderId', sql.BigInt, senderId || null) // Lưu ID người gửi
      .input('apartmentId', sql.Int, apartmentId || null)
      .input('topic', sql.NVarChar(100), topic || '')
      .input('status', sql.NVarChar(50), status || 'pending')
      .input('imageUrl', sql.NVarChar(sql.MAX), finalImageUrl)
      .query(`
        INSERT INTO dbo.Posts (Id, title, content, senderId, apartmentId, topic, status, imageUrl, createdAt)
        OUTPUT INSERTED.Id, INSERTED.title
        VALUES (@Id, @title, @content, @senderId, @apartmentId, @topic, @status, @imageUrl, GETDATE())
      `);

    return res.status(201).json({ success: true, message: "Tạo thành công", id: nextId });
  } catch (err) {
    console.error('[POST posts] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo bài viết: ' + err.message });
  }
});

// 4. PUT (UPDATE) POST
app.put('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, content, senderId, apartmentId, topic, status, imageUrl } = req.body || {};
    
    const pool = req.pool;
    await pool.request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('senderId', sql.BigInt, senderId || null) // Update cả senderId nếu cần
      .input('apartmentId', sql.Int, apartmentId || null)
      .input('topic', sql.NVarChar, topic)
      .input('status', sql.NVarChar, status)
      .input('imageUrl', sql.NVarChar, imageUrl)
      .query(`
        UPDATE dbo.Posts SET 
            title = @title,
            content = @content,
            senderId = @senderId,
            apartmentId = @apartmentId,
            topic = @topic,
            status = @status,
            imageUrl = @imageUrl,
            updatedAt = GETDATE()
        WHERE Id = @id
      `);
    
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[PUT posts/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật bài viết' });
  }
});

// DELETE (Giữ nguyên code của bạn)
app.delete('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Posts WHERE Id = @id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE posts/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa bài viết' });
  }
});

// ===== CRUD: Comments =====
app.get('/comments', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(c.Id AS INT) AS id,
        ISNULL(c.title, '') AS title,
        ISNULL(c.content, '') AS content,
        CAST(c.creatorId AS INT) AS creatorId,
        ISNULL(cust.name, '') AS creator,
        CAST(c.apartmentId AS INT) AS apartmentId,
        ISNULL(a.name, '') AS apartmentName,
        ISNULL(c.type, '') AS type,
        ISNULL(c.status, 'pending') AS status,
        ISNULL(c.feedbacks, '[]') AS feedbacks,
        ISNULL(c.isDeletedByAdmin, 0) AS isDeletedByAdmin,
        ISNULL(c.createdAt, GETDATE()) AS createdAt,
        ISNULL(c.updatedAt, NULL) AS updatedAt
      FROM dbo.Comments c
      LEFT JOIN dbo.Customers cust ON c.creatorId = cust.Id
      LEFT JOIN dbo.Apartments a ON c.apartmentId = a.Id
      ORDER BY c.Id DESC
    `);
    const comments = rs.recordset.map(item => ({
      ...item,
      feedbacks: typeof item.feedbacks === 'string' ? JSON.parse(item.feedbacks || '[]') : (item.feedbacks || [])
    }));
    return res.json(comments);
  } catch (err) {
    console.error('[GET comments] error:', err);
    return res.json([]);
  }
});

app.get('/comments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          CAST(c.Id AS INT) AS id,
          ISNULL(c.title, '') AS title,
          ISNULL(c.content, '') AS content,
          CAST(c.creatorId AS INT) AS creatorId,
          ISNULL(cust.name, '') AS creator,
          CAST(c.apartmentId AS INT) AS apartmentId,
          ISNULL(a.name, '') AS apartmentName,
          ISNULL(c.type, '') AS type,
          ISNULL(c.status, 'pending') AS status,
          ISNULL(c.feedbacks, '[]') AS feedbacks,
          ISNULL(c.isDeletedByAdmin, 0) AS isDeletedByAdmin,
          ISNULL(c.createdAt, GETDATE()) AS createdAt,
          ISNULL(c.updatedAt, NULL) AS updatedAt
        FROM dbo.Comments c
        LEFT JOIN dbo.Customers cust ON c.creatorId = cust.Id
        LEFT JOIN dbo.Apartments a ON c.apartmentId = a.Id
        WHERE c.Id = @id
      `);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy góp ý' });
    const item = rs.recordset[0];
    item.feedbacks = typeof item.feedbacks === 'string' ? JSON.parse(item.feedbacks || '[]') : (item.feedbacks || []);
    return res.json(item);
  } catch (err) {
    console.error('[GET comments/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy góp ý' });
  }
});

app.post('/comments', async (req, res) => {
  try {
    const { title, content, creatorId, apartmentId, type, status, feedbacks } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const nextId = await getNextId('dbo.Comments', pool.request());
    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('creatorId', sql.Int, creatorId || null)
      .input('apartmentId', sql.Int, apartmentId || null)
      .input('type', sql.NVarChar, type || '')
      .input('status', sql.NVarChar, status || 'pending')
      .input('feedbacks', sql.NVarChar, JSON.stringify(feedbacks || []))
      .query(`INSERT INTO dbo.Comments (Id, title, content, creatorId, apartmentId, type, status, feedbacks, createdAt)
              OUTPUT INSERTED.Id, INSERTED.title, INSERTED.content, INSERTED.creatorId, INSERTED.apartmentId, INSERTED.type, INSERTED.status, INSERTED.feedbacks, INSERTED.isDeletedByAdmin, INSERTED.createdAt, INSERTED.updatedAt
              VALUES (@Id, @title, @content, @creatorId, @apartmentId, @type, @status, @feedbacks, GETDATE())`);
    const item = rs.recordset[0];
    // Get creator and apartment names
    if (item.creatorId) {
      const customerRs = await pool.request().input('id', sql.Int, item.creatorId).query('SELECT name FROM dbo.Customers WHERE Id = @id');
      item.creator = customerRs.recordset[0]?.name || '';
    } else {
      item.creator = '';
    }
    if (item.apartmentId) {
      const apartmentRs = await pool.request().input('id', sql.Int, item.apartmentId).query('SELECT name FROM dbo.Apartments WHERE Id = @id');
      item.apartmentName = apartmentRs.recordset[0]?.name || '';
    } else {
      item.apartmentName = '';
    }
    item.feedbacks = typeof item.feedbacks === 'string' ? JSON.parse(item.feedbacks || '[]') : (item.feedbacks || []);
    return res.status(201).json(item);
  } catch (err) {
    console.error('[POST comments] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo góp ý' });
  }
});

app.put('/comments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    const updateFields = [];
    const request = pool.request().input('id', sql.Int, id);

    if (req.body.title !== undefined) {
      updateFields.push('title = @title');
      request.input('title', sql.NVarChar, req.body.title);
    }
    if (req.body.content !== undefined) {
      updateFields.push('content = @content');
      request.input('content', sql.NVarChar, req.body.content);
    }
    if (req.body.creatorId !== undefined) {
      updateFields.push('creatorId = @creatorId');
      request.input('creatorId', sql.Int, req.body.creatorId || null);
    }
    if (req.body.apartmentId !== undefined) {
      updateFields.push('apartmentId = @apartmentId');
      request.input('apartmentId', sql.Int, req.body.apartmentId || null);
    }
    if (req.body.status !== undefined) {
      updateFields.push('status = @status');
      request.input('status', sql.NVarChar, req.body.status);
    }
    if (req.body.isDeletedByAdmin !== undefined) {
      updateFields.push('isDeletedByAdmin = @isDeletedByAdmin');
      request.input('isDeletedByAdmin', sql.Bit, req.body.isDeletedByAdmin ? 1 : 0);
    }
    if (req.body.feedbacks !== undefined) {
      updateFields.push('feedbacks = @feedbacks');
      request.input('feedbacks', sql.NVarChar, JSON.stringify(req.body.feedbacks || []));
    }

    updateFields.push('updatedAt = GETDATE()');

    const rs = await request.query(`UPDATE dbo.Comments SET ${updateFields.join(', ')}
              OUTPUT INSERTED.Id, INSERTED.title, INSERTED.content, INSERTED.creatorId, INSERTED.apartmentId, INSERTED.type, INSERTED.status, INSERTED.feedbacks, INSERTED.isDeletedByAdmin, INSERTED.createdAt, INSERTED.updatedAt
              WHERE Id = @id`);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy góp ý' });
    const item = rs.recordset[0];
    // Get creator and apartment names
    if (item.creatorId) {
      const customerRs = await pool.request().input('creatorId', sql.Int, item.creatorId).query('SELECT name FROM dbo.Customers WHERE Id = @creatorId');
      item.creator = customerRs.recordset[0]?.name || '';
    } else {
      item.creator = '';
    }
    if (item.apartmentId) {
      const apartmentRs = await pool.request().input('apartmentId', sql.Int, item.apartmentId).query('SELECT name FROM dbo.Apartments WHERE Id = @apartmentId');
      item.apartmentName = apartmentRs.recordset[0]?.name || '';
    } else {
      item.apartmentName = '';
    }
    item.feedbacks = typeof item.feedbacks === 'string' ? JSON.parse(item.feedbacks || '[]') : (item.feedbacks || []);
    return res.json(item);
  } catch (err) {
    console.error('[PUT comments/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật góp ý' });
  }
});

app.delete('/comments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Comments WHERE Id = @id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE comments/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa góp ý' });
  }
});

// ===== CRUD: Notifications =====
app.get('/notifications', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    const privilegedRoles = ['admin', 'manager'];
    const canViewSecurityAlerts = currentUser && privilegedRoles.includes(currentUser.role);
    const whereClause = canViewSecurityAlerts ? '' : "WHERE ISNULL(n.type, 'Chung') <> 'SECURITY_ALERT'";

    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(n.Id AS INT) AS id,
        ISNULL(n.title, '') AS title,
        ISNULL(n.content, '') AS content,
        ISNULL(n.type, 'Chung') AS type,
        CAST(n.senderId AS BIGINT) AS senderId,
        ISNULL(u.fullName, '') AS sender,
        CAST(n.buildingId AS INT) AS buildingId,
        ISNULL(b.name, '') AS buildingName,
        ISNULL(n.images, '[]') AS images,
        ISNULL(n.sendDate, GETDATE()) AS sendDate,
        ISNULL(n.isActive, 1) AS isActive,
        ISNULL(n.editedToId, NULL) AS editedToId,
        ISNULL(n.createdAt, GETDATE()) AS createdAt,
        ISNULL(n.updatedAt, NULL) AS updatedAt
      FROM dbo.Notifications n
      LEFT JOIN dbo.Users u ON n.senderId = u.Id
      LEFT JOIN dbo.Buildings b ON n.buildingId = b.Id
      ${whereClause}
      ORDER BY n.Id DESC
    `);
    console.log(`[GET notifications] Tổng số thông báo từ DB: ${rs.recordset.length}`);

    const notifications = rs.recordset.map(item => {
      let parsedImages = [];
      try {
        if (typeof item.images === 'string' && item.images.trim()) {
          // Thử parse JSON, nếu lỗi thì dùng mảng rỗng
          parsedImages = JSON.parse(item.images);
          // Đảm bảo parsedImages là mảng
          if (!Array.isArray(parsedImages)) {
            console.warn(`[GET notifications] Notification ${item.id}: images không phải là mảng, đang chuyển thành mảng rỗng`);
            parsedImages = [];
          } else {
            console.log(`[GET notifications] Notification ${item.id} (${item.title}): Parse images thành công, số lượng ảnh: ${parsedImages.length}`);
          }
        } else if (Array.isArray(item.images)) {
          parsedImages = item.images;
        }
      } catch (parseError) {
        console.error(`[GET notifications] Lỗi parse images cho notification ${item.id} (${item.title}):`, parseError.message);
        console.error(`[GET notifications] Độ dài string images: ${typeof item.images === 'string' ? item.images.length : 'N/A'}`);
        // Nếu parse lỗi, dùng mảng rỗng thay vì làm crash toàn bộ
        parsedImages = [];
      }

      return {
        ...item,
        images: parsedImages
      };
    });

    console.log(`[GET notifications] Số thông báo sau khi parse: ${notifications.length}`);
    console.log(`[GET notifications] Danh sách ID: ${notifications.map(n => n.id).join(', ')}`);

    return res.json(notifications);
  } catch (err) {
    console.error('[GET notifications] error:', err);
    return res.json([]);
  }
});

app.get('/notifications/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          CAST(n.Id AS INT) AS id,
          ISNULL(n.title, '') AS title,
          ISNULL(n.content, '') AS content,
          ISNULL(n.type, 'Chung') AS type,
          CAST(n.senderId AS BIGINT) AS senderId,
          ISNULL(u.fullName, '') AS sender,
          CAST(n.buildingId AS INT) AS buildingId,
          ISNULL(b.name, '') AS buildingName,
          ISNULL(n.images, '[]') AS images,
          ISNULL(n.sendDate, GETDATE()) AS sendDate,
          ISNULL(n.isActive, 1) AS isActive,
          ISNULL(n.editedToId, NULL) AS editedToId,
          ISNULL(n.createdAt, GETDATE()) AS createdAt,
          ISNULL(n.updatedAt, NULL) AS updatedAt
        FROM dbo.Notifications n
        LEFT JOIN dbo.Users u ON n.senderId = u.Id
        LEFT JOIN dbo.Buildings b ON n.buildingId = b.Id
        WHERE n.Id = @id
      `);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
    const item = rs.recordset[0];

    // Xử lý parse images an toàn
    let parsedImages = [];
    try {
      if (typeof item.images === 'string' && item.images.trim()) {
        parsedImages = JSON.parse(item.images);
        if (!Array.isArray(parsedImages)) {
          parsedImages = [];
        }
      } else if (Array.isArray(item.images)) {
        parsedImages = item.images;
      }
    } catch (parseError) {
      console.warn(`[GET notifications/:id] Lỗi parse images cho notification ${item.id}:`, parseError.message);
      parsedImages = [];
    }

    item.images = parsedImages;
    return res.json(item);
  } catch (err) {
    console.error('[GET notifications/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy thông báo' });
  }
});

app.post('/notifications', async (req, res) => {
  try {
    const { title, content, type, senderId, buildingId, images, sendDate, isActive } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const nextId = await getNextId('dbo.Notifications', pool.request());
    const rs = await pool.request()
      .input('Id', sql.Int, nextId)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('type', sql.NVarChar, type || 'Chung')
      .input('senderId', sql.BigInt, senderId || null)
      .input('buildingId', sql.Int, buildingId || null)
      .input('images', sql.NVarChar, JSON.stringify(images || []))
      .input('sendDate', sql.DateTime2, sendDate ? new Date(sendDate) : new Date())
      .input('isActive', sql.Bit, isActive !== false ? 1 : 0)
      .query(`INSERT INTO dbo.Notifications (Id, title, content, type, senderId, buildingId, images, sendDate, isActive, createdAt)
              OUTPUT INSERTED.Id, INSERTED.title, INSERTED.content, INSERTED.type, INSERTED.senderId, INSERTED.buildingId, INSERTED.images, INSERTED.sendDate, INSERTED.isActive, INSERTED.editedToId, INSERTED.createdAt, INSERTED.updatedAt
              VALUES (@Id, @title, @content, @type, @senderId, @buildingId, @images, @sendDate, @isActive, GETDATE())`);
    const item = rs.recordset[0];
    // Get sender and building names
    if (item.senderId) {
      const userRs = await pool.request().input('id', sql.BigInt, item.senderId).query('SELECT fullName FROM dbo.Users WHERE Id = @id');
      item.sender = userRs.recordset[0]?.fullName || '';
    } else {
      item.sender = '';
    }
    if (item.buildingId) {
      const buildingRs = await pool.request().input('id', sql.Int, item.buildingId).query('SELECT name FROM dbo.Buildings WHERE Id = @id');
      item.buildingName = buildingRs.recordset[0]?.name || '';
    } else {
      item.buildingName = '';
    }

    // Xử lý parse images an toàn
    let parsedImages = [];
    try {
      if (typeof item.images === 'string' && item.images.trim()) {
        parsedImages = JSON.parse(item.images);
        if (!Array.isArray(parsedImages)) {
          parsedImages = [];
        }
      } else if (Array.isArray(item.images)) {
        parsedImages = item.images;
      }
    } catch (parseError) {
      console.warn(`[POST notifications] Lỗi parse images cho notification ${item.id}:`, parseError.message);
      parsedImages = [];
    }
    item.images = parsedImages;
    return res.status(201).json(item);
  } catch (err) {
    console.error('[POST notifications] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo thông báo' });
  }
});

app.put('/notifications/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, content, type, senderId, buildingId, images, sendDate, isActive, editedToId, previousNotificationId } = req.body || {};
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('type', sql.NVarChar, type)
      .input('senderId', sql.BigInt, senderId || null)
      .input('buildingId', sql.Int, buildingId || null)
      .input('images', sql.NVarChar, JSON.stringify(images || []))
      .input('sendDate', sql.DateTime2, sendDate ? new Date(sendDate) : null)
      .input('isActive', sql.Bit, isActive !== false ? 1 : 0)
      .input('editedToId', sql.Int, editedToId || previousNotificationId || null)
      .query(`UPDATE dbo.Notifications SET 
                title = @title,
                content = @content,
                type = @type,
                senderId = @senderId,
                buildingId = @buildingId,
                images = @images,
                sendDate = @sendDate,
                isActive = @isActive,
                editedToId = @editedToId,
                updatedAt = GETDATE()
              OUTPUT INSERTED.Id, INSERTED.title, INSERTED.content, INSERTED.type, INSERTED.senderId, INSERTED.buildingId, INSERTED.images, INSERTED.sendDate, INSERTED.isActive, INSERTED.editedToId, INSERTED.createdAt, INSERTED.updatedAt
              WHERE Id = @id`);
    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
    const item = rs.recordset[0];
    // Get sender and building names
    if (item.senderId) {
      const userRs = await pool.request().input('senderId', sql.BigInt, item.senderId).query('SELECT fullName FROM dbo.Users WHERE Id = @senderId');
      item.sender = userRs.recordset[0]?.fullName || '';
    } else {
      item.sender = '';
    }
    if (item.buildingId) {
      const buildingRs = await pool.request().input('buildingId', sql.Int, item.buildingId).query('SELECT name FROM dbo.Buildings WHERE Id = @buildingId');
      item.buildingName = buildingRs.recordset[0]?.name || '';
    } else {
      item.buildingName = '';
    }
    // Xử lý parse images an toàn
    let parsedImages = [];
    try {
      if (typeof item.images === 'string' && item.images.trim()) {
        parsedImages = JSON.parse(item.images);
        if (!Array.isArray(parsedImages)) {
          parsedImages = [];
        }
      } else if (Array.isArray(item.images)) {
        parsedImages = item.images;
      }
    } catch (parseError) {
      console.warn(`[PUT notifications/:id] Lỗi parse images cho notification ${item.id}:`, parseError.message);
      parsedImages = [];
    }
    item.images = parsedImages;
    return res.json(item);
  } catch (err) {
    console.error('[PUT notifications/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật thông báo' });
  }
});

app.delete('/notifications/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool; // Sử dụng pool từ middleware
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Notifications WHERE Id = @id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE notifications/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa thông báo' });
  }
});

// ===== CRUD: Votes =====
// Get all votes with total eligible voters calculation
app.get('/votes', async (req, res) => {
  try {
    const pool = req.pool;
    const rs = await pool.request().query(`
      SELECT 
        CAST(v.Id AS INT) AS Id,
        ISNULL(v.Title, '') AS Title,
        ISNULL(v.StartDate, GETDATE()) AS StartDate,
        ISNULL(v.EndDate, GETDATE()) AS EndDate,
        CAST(v.CreatedById AS BIGINT) AS CreatedById,
        ISNULL(u.fullName, '') AS CreatedBy,
        CAST(v.buildingId AS INT) AS buildingId,
        ISNULL(b.name, '') AS buildingName,
        ISNULL(v.createdAt, GETDATE()) AS createdAt,
        ISNULL(v.updatedAt, NULL) AS updatedAt,
        (
            SELECT COUNT(c.Id)
            FROM dbo.Customers c
            INNER JOIN dbo.Apartments a ON a.customerId = c.Id 
            WHERE 
                (v.buildingId IS NULL) 
                OR 
                (a.buildingId = v.buildingId)
        ) AS totalEligible

      FROM dbo.Votes v
      LEFT JOIN dbo.Users u ON v.CreatedById = u.Id
      LEFT JOIN dbo.Buildings b ON v.buildingId = b.Id
      ORDER BY v.Id DESC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET votes] error:', err);
    return res.json([]);
  }
});

// Get vote by ID with total eligible voters calculation
app.get('/votes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool;

    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          CAST(v.Id AS INT) AS Id,
          ISNULL(v.Title, '') AS Title,
          ISNULL(v.StartDate, GETDATE()) AS StartDate,
          ISNULL(v.EndDate, GETDATE()) AS EndDate,
          CAST(v.CreatedById AS BIGINT) AS CreatedById,
          ISNULL(u.fullName, '') AS CreatedBy,
          CAST(v.buildingId AS INT) AS buildingId,
          ISNULL(b.name, '') AS buildingName,

          -- LOGIC ĐẾM CỬ TRI CHUẨN (Dựa trên Apartments)
          (
            SELECT COUNT(c.Id)
            FROM dbo.Customers c
            INNER JOIN dbo.Apartments a ON a.customerId = c.Id 
            WHERE 
                (v.buildingId IS NULL) -- Nếu vote toàn khu
                OR 
                (a.buildingId = v.buildingId) -- Nếu vote theo tòa
          ) AS totalEligible,

          ISNULL(v.createdAt, GETDATE()) AS createdAt,
          ISNULL(v.updatedAt, NULL) AS updatedAt
        FROM dbo.Votes v
        LEFT JOIN dbo.Users u ON v.CreatedById = u.Id
        LEFT JOIN dbo.Buildings b ON v.buildingId = b.Id
        WHERE v.Id = @id
      `);

    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy biểu quyết' });
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error('[GET votes/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi lấy biểu quyết: ' + err.message });
  }
});

// ===== API POST VOTES =====
app.post('/votes', async (req, res) => {
  try {
    const {
      Title, StartDate, EndDate, CreatedById, buildingId,
      isDemo, demoData
    } = req.body || {};

    const pool = req.pool;
    const transaction = new sql.Transaction(pool);

    // Bắt đầu transaction
    await transaction.begin();

    try {
      // 1. Insert Biểu quyết (Votes)
      const nextVoteId = await getNextId('dbo.Votes', transaction.request()); 

      const insertVoteRequest = transaction.request();
      const voteResult = await insertVoteRequest
        .input('Id', sql.Int, nextVoteId)
        .input('Title', sql.NVarChar, Title)
        .input('StartDate', sql.DateTime2, StartDate ? new Date(StartDate) : new Date())
        .input('EndDate', sql.DateTime2, EndDate ? new Date(EndDate) : new Date())
        .input('CreatedById', sql.BigInt, CreatedById || null)
        .input('buildingId', sql.Int, buildingId || null)
        .query(`
          INSERT INTO dbo.Votes (Id, Title, StartDate, EndDate, CreatedById, buildingId, createdAt)
          OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.StartDate, INSERTED.EndDate, INSERTED.CreatedById, INSERTED.buildingId
          VALUES (@Id, @Title, @StartDate, @EndDate, @CreatedById, @buildingId, GETDATE())
        `);

      const newVote = voteResult.recordset[0];
      const newVoteId = newVote.Id;

      // 2. Xử lý Demo Mode
      if (isDemo && demoData) {
        const { agree, disagree } = demoData;
        
        // A. Lấy ID lớn nhất hiện tại của bảng VoteResults để tự tăng
        const maxIdRes = await transaction.request().query("SELECT ISNULL(MAX(Id), 0) AS MaxId FROM dbo.VoteResults");
        let currentResultId = maxIdRes.recordset[0].MaxId + 1; 

        // B. Lấy danh sách ID cư dân chuẩn xác (JOIN Apartments)
        let residentQuery = `
            SELECT c.Id 
            FROM dbo.Customers c
            INNER JOIN dbo.Apartments a ON c.Id = a.customerId
            WHERE (@buildingId IS NULL OR a.buildingId = @buildingId)
        `;

        const residentsRs = await transaction.request()
          .input('buildingId', sql.Int, buildingId || null)
          .query(residentQuery);

        const residentIds = residentsRs.recordset.map(r => r.Id);

        const getRandomResidentId = () => {
          if (residentIds.length === 0) return null;
          return residentIds[Math.floor(Math.random() * residentIds.length)];
        };

        // C. Tạo phiếu Đồng ý
        for (let i = 0; i < parseInt(agree); i++) {
          const rId = getRandomResidentId();
          await transaction.request()
            .input('Id', sql.Int, currentResultId++) // Cung cấp ID thủ công
            .input('VoteId', sql.Int, newVoteId)
            .input('choice', sql.NVarChar, 'Đồng ý')
            .input('ResidentId', sql.Int, rId)
            .query(`INSERT INTO dbo.VoteResults (Id, VoteId, UserId, ResidentId, choice, createdAt) VALUES (@Id, @VoteId, NULL, @ResidentId, @choice, GETDATE())`);
        }

        // D. Tạo phiếu Không đồng ý
        for (let i = 0; i < parseInt(disagree); i++) {
          const rId = getRandomResidentId();
          await transaction.request()
            .input('Id', sql.Int, currentResultId++) // Cung cấp ID thủ công
            .input('VoteId', sql.Int, newVoteId)
            .input('choice', sql.NVarChar, 'Không đồng ý')
            .input('ResidentId', sql.Int, rId)
            .query(`INSERT INTO dbo.VoteResults (Id, VoteId, UserId, ResidentId, choice, createdAt) VALUES (@Id, @VoteId, NULL, @ResidentId, @choice, GETDATE())`);
        }
      }

      // Commit transaction
      await transaction.commit();

      return res.status(201).json({ success: true, message: 'Tạo biểu quyết thành công', data: newVote });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }

  } catch (err) {
    console.error('[POST votes] error:', err);
    return res.status(500).json({ message: 'Lỗi tạo biểu quyết: ' + err.message });
  }
});

// =====  API PUT VOTES =====
app.put('/votes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { Title, StartDate, EndDate, CreatedById, buildingId } = req.body || {};

    const pool = req.pool;
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('Title', sql.NVarChar, Title)
      .input('StartDate', sql.DateTime2, StartDate ? new Date(StartDate) : null)
      .input('EndDate', sql.DateTime2, EndDate ? new Date(EndDate) : null)
      .input('CreatedById', sql.BigInt, CreatedById || null)
      .input('buildingId', sql.Int, buildingId || null)
      .query(`
          UPDATE dbo.Votes SET 
            Title = @Title,
            StartDate = @StartDate,
            EndDate = @EndDate,
            CreatedById = @CreatedById,
            buildingId = @buildingId,
            updatedAt = GETDATE()
          OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.StartDate, INSERTED.EndDate, INSERTED.CreatedById, INSERTED.buildingId, INSERTED.createdAt, INSERTED.updatedAt
          WHERE Id = @id
      `);

    if (!rs.recordset.length) return res.status(404).json({ message: 'Không tìm thấy biểu quyết' });

    const item = rs.recordset[0];

    // Lấy tên User
    if (item.CreatedById) {
      const userRs = await pool.request().input('CreatedById', sql.BigInt, item.CreatedById).query('SELECT fullName FROM dbo.Users WHERE Id = @CreatedById');
      item.CreatedBy = userRs.recordset[0]?.fullName || '';
    } else {
      item.CreatedBy = '';
    }

    // Lấy tên Building
    if (item.buildingId) {
      const buildingRs = await pool.request().input('buildingId', sql.Int, item.buildingId).query('SELECT name FROM dbo.Buildings WHERE Id = @buildingId');
      item.buildingName = buildingRs.recordset[0]?.name || '';
    } else {
      item.buildingName = '';
    }

    return res.json(item);
  } catch (err) {
    console.error('[PUT votes/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật biểu quyết' });
  }
});

app.delete('/votes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = req.pool;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Votes WHERE Id = @id');
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE votes/:id] error:', err);
    return res.status(500).json({ message: 'Lỗi xóa biểu quyết' });
  }
});

// ===== CRUD: VoteResults =====
app.get('/vote-results', async (req, res) => {
  try {
    const pool = req.pool; // Sử dụng pool từ middleware
    const rs = await pool.request().query(`
      SELECT 
        CAST(vr.Id AS INT) AS id,
        CAST(vr.VoteId AS INT) AS VoteId,
        ISNULL(v.Title, '') AS voteTitle,
        CAST(vr.UserId AS BIGINT) AS UserId,
        ISNULL(u.fullName, '') AS userName,
        CAST(vr.ResidentId AS INT) AS ResidentId,
        ISNULL(c.name, '') AS residentName,
        ISNULL(vr.choice, '') AS choice,
        ISNULL(vr.createdAt, GETDATE()) AS createdAt
      FROM dbo.VoteResults vr
      LEFT JOIN dbo.Votes v ON vr.VoteId = v.Id
      LEFT JOIN dbo.Users u ON vr.UserId = u.Id
      LEFT JOIN dbo.Customers c ON vr.ResidentId = c.Id
      ORDER BY vr.createdAt DESC
    `);
    return res.json(rs.recordset);
  } catch (err) {
    console.error('[GET vote-results] error:', err);
    return res.json([]);
  }
});

// Start server (port align with frontend sql default 3002)
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✓ SQL Server API đang chạy tại http://localhost:${PORT}`);
});


