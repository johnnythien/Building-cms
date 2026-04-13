/**
 * Global Error Handler Utility
 * Tập trung xử lý các loại lỗi khác nhau trong hệ thống
 */

/**
 * Phân loại và xử lý lỗi từ API
 * @param {Error} error - Error object từ API call
 * @param {string} context - Context của error (tên component/function)
 * @returns {Object} - Error object đã được xử lý
 */
export const handleError = (error, context = 'Unknown') => {
  console.error(`[ErrorHandler] ${context}:`, error);

  // Lỗi từ server (có response)
  if (error.response) {
    return handleServerError(error.response, context);
  }

  // Lỗi network (không có response)
  if (error.request) {
    return handleNetworkError(error, context);
  }

  // Lỗi khác (không phải API error)
  return handleUnknownError(error, context);
};

/**
 * Xử lý lỗi từ server
 */
const handleServerError = (response, context) => {
  const status = response.status;
  const data = response.data || {};

  switch (status) {
    case 400:
      return {
        type: 'BAD_REQUEST',
        message: data.message || 'Yêu cầu không hợp lệ',
        status: 400,
        details: data
      };

    case 401:
      return {
        type: 'UNAUTHORIZED',
        message: data.message || 'Phiên đăng nhập đã hết hạn',
        status: 401,
        details: data
      };

    case 403:
      return {
        type: 'FORBIDDEN',
        message: data.message || 'Bạn không có quyền truy cập',
        status: 403,
        details: data
      };

    case 404:
      return {
        type: 'NOT_FOUND',
        message: data.message || 'Không tìm thấy tài nguyên',
        status: 404,
        details: data
      };

    case 422:
      return {
        type: 'VALIDATION_ERROR',
        message: data.message || 'Dữ liệu không hợp lệ',
        status: 422,
        validationErrors: data.errors || data.error || {},
        details: data
      };

    case 429:
      return {
        type: 'RATE_LIMIT',
        message: data.message || 'Quá nhiều requests. Vui lòng thử lại sau.',
        status: 429,
        retryAfter: response.headers['retry-after'],
        details: data
      };

    case 500:
      return {
        type: 'SERVER_ERROR',
        message: data.message || 'Lỗi máy chủ. Vui lòng thử lại sau.',
        status: 500,
        details: data
      };

    case 502:
    case 503:
    case 504:
      return {
        type: 'SERVICE_UNAVAILABLE',
        message: data.message || 'Dịch vụ tạm thời không khả dụng',
        status: status,
        details: data
      };

    default:
      return {
        type: 'SERVER_ERROR',
        message: data.message || `Lỗi server (${status})`,
        status: status,
        details: data
      };
  }
};

/**
 * Xử lý lỗi network
 */
const handleNetworkError = (error, context) => {
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      message: 'Request timeout. Vui lòng thử lại sau.',
      code: 'TIMEOUT',
      details: error
    };
  }

  if (error.message.includes('Network Error') || !error.response) {
    return {
      type: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
      code: 'NETWORK_ERROR',
      details: error
    };
  }

  return {
    type: 'NETWORK_ERROR',
    message: 'Lỗi kết nối mạng',
    code: error.code || 'UNKNOWN',
    details: error
  };
};

/**
 * Xử lý lỗi không xác định
 */
const handleUnknownError = (error, context) => {
  return {
    type: 'UNKNOWN_ERROR',
    message: error.message || 'Đã xảy ra lỗi không xác định',
    code: error.code || 'UNKNOWN',
    details: error
  };
};

/**
 * Xử lý SQL errors từ backend
 * @param {Error} error - SQL error object
 * @returns {Object} - User-friendly error message
 */
export const handleSQLError = (error) => {
  if (!error || !error.number) {
    return {
      message: 'Lỗi database. Vui lòng thử lại sau.',
      code: 'SQL_ERROR'
    };
  }

  const errorNumber = error.number;
  const errorMessage = error.message || '';

  // Foreign Key Constraint (547)
  if (errorNumber === 547) {
    return {
      message: 'Không thể thực hiện thao tác này vì dữ liệu đang được sử dụng ở nơi khác.',
      code: 'FOREIGN_KEY_CONSTRAINT',
      userFriendly: true
    };
  }

  // Duplicate Key (2627, 2601)
  if (errorNumber === 2627 || errorNumber === 2601) {
    const field = extractFieldFromError(errorMessage);
    return {
      message: field 
        ? `${field} đã tồn tại. Vui lòng chọn giá trị khác.`
        : 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.',
      code: 'DUPLICATE_KEY',
      userFriendly: true
    };
  }

  // Check Constraint (547)
  if (errorNumber === 547 && errorMessage.includes('CHECK')) {
    return {
      message: 'Dữ liệu không đáp ứng yêu cầu. Vui lòng kiểm tra lại.',
      code: 'CHECK_CONSTRAINT',
      userFriendly: true
    };
  }

  // Null Constraint (515)
  if (errorNumber === 515) {
    return {
      message: 'Vui lòng điền đầy đủ thông tin bắt buộc.',
      code: 'NULL_CONSTRAINT',
      userFriendly: true
    };
  }

  // Default: Return technical error (only in development)
  return {
    message: process.env.NODE_ENV === 'development' 
      ? `SQL Error ${errorNumber}: ${errorMessage}`
      : 'Lỗi database. Vui lòng thử lại sau.',
    code: `SQL_${errorNumber}`,
    userFriendly: false
  };
};

/**
 * Trích xuất tên field từ SQL error message
 */
const extractFieldFromError = (errorMessage) => {
  // Pattern: "Violation of UNIQUE KEY constraint 'IX_Users_Email'. Cannot insert duplicate key..."
  const match = errorMessage.match(/constraint ['"]([^'"]+)['"]/i);
  if (match) {
    const constraintName = match[1];
    // Extract field name from constraint (e.g., "IX_Users_Email" -> "Email")
    const fieldMatch = constraintName.match(/_([A-Z][a-zA-Z]+)$/);
    if (fieldMatch) {
      return fieldMatch[1];
    }
  }
  return null;
};

/**
 * Format error message để hiển thị cho user
 */
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.validationErrors) {
    // Format validation errors
    const errors = Object.entries(error.validationErrors)
      .map(([field, message]) => `${field}: ${message}`)
      .join(', ');
    return errors || 'Dữ liệu không hợp lệ';
  }

  return 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
};

/**
 * Kiểm tra xem error có thể retry được không
 */
export const isRetryableError = (error) => {
  if (!error) return false;

  // Network errors có thể retry
  if (error.type === 'NETWORK_ERROR' || error.type === 'TIMEOUT') {
    return true;
  }

  // Server errors 5xx có thể retry
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Rate limit có thể retry sau một thời gian
  if (error.type === 'RATE_LIMIT') {
    return true;
  }

  return false;
};

export default {
  handleError,
  handleSQLError,
  formatErrorMessage,
  isRetryableError
};

