import axios from 'axios'
import queryString from "query-string";

// CHỌN LOẠI SERVER Ở ĐÂY:
// - Dùng JSON Server: http://localhost:3003
// - Dùng SQL Server: http://localhost:3002
const SERVER_TYPE = 'sql'; // Sử dụng SQL Server để lấy dữ liệu thật

// Tìm cổng trong localStorage nếu có (được cập nhật từ console)
function getServerPort() {
    // Mặc định cổng theo loại server
    const defaultPort = SERVER_TYPE === 'json' ? 3003 : 3002;
    
    // Thử đọc cổng từ localStorage
    const savedPort = localStorage.getItem(`${SERVER_TYPE}_server_port`);
    
    if (savedPort) {
        console.log(`[API] Sử dụng cổng ${savedPort} từ localStorage`);
        return parseInt(savedPort);
    }
    
    return defaultPort;
}

// Cấu hình baseURL theo loại server và cổng
const port = getServerPort();
const baseURL = `http://localhost:${port}`;

console.log(`[API] Sử dụng ${SERVER_TYPE.toUpperCase()} server tại ${baseURL}`);

// Hiển thị cảnh báo nếu có vấn đề kết nối
const showConnectionWarning = () => {
    if (typeof document !== 'undefined') {
        const existingWarning = document.getElementById('api-port-warning');
        if (!existingWarning) {
            const warningDiv = document.createElement('div');
            warningDiv.id = 'api-port-warning';
            warningDiv.style.position = 'fixed';
            warningDiv.style.top = '0';
            warningDiv.style.left = '0';
            warningDiv.style.right = '0';
            warningDiv.style.backgroundColor = '#f8d7da';
            warningDiv.style.color = '#721c24';
            warningDiv.style.padding = '10px';
            warningDiv.style.textAlign = 'center';
            warningDiv.style.zIndex = '9999';
            warningDiv.style.fontWeight = 'bold';
            
            const closeButton = document.createElement('button');
            closeButton.textContent = '×';
            closeButton.style.float = 'right';
            closeButton.style.background = 'none';
            closeButton.style.border = 'none';
            closeButton.style.fontSize = '20px';
            closeButton.style.cursor = 'pointer';
            closeButton.onclick = function() {
                document.body.removeChild(warningDiv);
            };
            
            const message = document.createElement('span');
            const correctKey = `${SERVER_TYPE}_server_port`;
            const defaultPort = SERVER_TYPE === 'json' ? 3003 : 3002;
            const altPort = SERVER_TYPE === 'json' ? 3002 : 3003;
            message.innerHTML = `⚠️ Không thể kết nối đến API server. Vui lòng kiểm tra:<br/>
                1. Server đang chạy (${SERVER_TYPE === 'json' ? 'npm run server' : 'npm run sql-server'})<br/>
                2. Port đúng (hiện đang kết nối đến port ${port})<br/>
                <a href="#" onclick="localStorage.setItem('${correctKey}', '${defaultPort}'); window.location.reload();" style="color: #721c24; text-decoration: underline;">Dùng cổng mặc định ${defaultPort}</a>
                &nbsp;|&nbsp;
                <a href="#" onclick="localStorage.setItem('${correctKey}', '${altPort}'); window.location.reload();" style="color: #721c24; text-decoration: underline;">Thử cổng ${altPort}</a>`;
            
            warningDiv.appendChild(closeButton);
            warningDiv.appendChild(message);
            document.body.appendChild(warningDiv);
        }
    }
};

// Thêm lắng nghe console log để tự động cập nhật cổng
if (typeof window !== 'undefined') {
    // Phát hiện message từ server về việc đổi cổng
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        // Gọi hàm log gốc
        originalConsoleLog.apply(console, args);
        
        // Kiểm tra xem log có chứa thông tin về cổng mới không
        if (args.length > 0 && typeof args[0] === 'string') {
            const logMessage = args[0];
            
            // Tìm mẫu "Server đang chạy trên cổng XXX"
            const portMatch = logMessage.match(/cổng (\d+)/);
            if (portMatch && portMatch[1]) {
                const newPort = portMatch[1];
                originalConsoleLog(`[API] Đã phát hiện cổng server mới: ${newPort}`);
                
                // Lưu cổng mới vào localStorage
                if (logMessage.includes('JSON Server')) {
                    localStorage.setItem('json_server_port', newPort);
                } else if (logMessage.includes('SQL Server')) {
                    localStorage.setItem('sql_server_port', newPort);
                }
                
                // Reload trang để áp dụng cổng mới
                if ((SERVER_TYPE === 'json' && logMessage.includes('JSON Server')) || 
                    (SERVER_TYPE === 'sql' && logMessage.includes('SQL Server'))) {
                    originalConsoleLog('[API] Reloading page to use new port');
                    window.location.reload();
                }
            }
        }
    };
}

const axiosClient = axios.create({
    baseURL,
    timeout: 30000, // 30 seconds timeout
    paramsSerializer: (params) => queryString.stringify(params),
})

axiosClient.interceptors.request.use(async (config) => {
    // Ưu tiên lấy token từ sessionStorage (token riêng của tab này)
    // Nếu không có, lấy từ localStorage (token chung)
    let token = sessionStorage.getItem('token');
    if (!token) {
        token = localStorage.getItem('token');
    }
    
    if (token) {
        console.log(`[API Request] Sử dụng token: ${token.substring(0, 10)}...`);
    } else {
        console.log('[API Request] Không có token');
    }
    
    config.headers = {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...config.headers
    };
    
    // Log đầy đủ thông tin request để debug
    console.log('[API Request Details]', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.data
    });

    return config;
});

axiosClient.interceptors.response.use(
    (res) => {
        console.log(`[API Response] ${res.config.url}:`, res.status, res.data);

        // Lưu token khi login/register vào cả sessionStorage và localStorage
        if (res.data?.token && (res.config.url.includes('/auth/login') || res.config.url.includes('/auth/register'))) {
            sessionStorage.setItem('token', res.data.token);
            localStorage.setItem('token', res.data.token);
            console.log(`[Token saved] ${res.data.token.substring(0, 10)}...`);
        }

        // Chuẩn hóa payload: hỗ trợ cả JSON phẳng và dạng { success, message, data }
        if (res.status >= 200 && res.status < 300) {
            let payload = res.data;
            if (payload && typeof payload === 'object' && 'data' in payload && (Array.isArray(payload.data) || typeof payload.data === 'object')) {
                // Nếu là dạng wrapper và không phải auth token object
                payload = payload.data;
            }
            return payload;
        }
        return Promise.reject(res.data);
    },
    (error) => {
        console.error('[API Error]', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            code: error.code
        });

        // Xử lý 401 Unauthorized - Auto logout và redirect
        if (error.response?.status === 401) {
            console.warn('[API] 401 Unauthorized - Token expired or invalid');
            
            // Clear authentication data
            sessionStorage.removeItem('token');
            localStorage.removeItem('token');
            sessionStorage.removeItem('userRole');
            localStorage.removeItem('userRole');
            
            // Redirect to login if not already there
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                const currentPath = window.location.pathname + window.location.search;
                window.location.href = `/login?expired=true&redirect=${encodeURIComponent(currentPath)}`;
            }
            
            return Promise.reject({ 
                message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
                code: 'UNAUTHORIZED',
                status: 401
            });
        }

        // Xử lý 403 Forbidden - Redirect đến trang unauthorized
        if (error.response?.status === 403) {
            console.warn('[API] 403 Forbidden - User does not have permission');
            
            // Redirect to unauthorized page if not already there
            if (typeof window !== 'undefined' && window.location.pathname !== '/unauthorized') {
                window.location.href = '/unauthorized';
            }
            
            return Promise.reject({ 
                message: 'Bạn không có quyền truy cập tài nguyên này.',
                code: 'FORBIDDEN',
                status: 403
            });
        }

        // Xử lý 422 Unprocessable Entity - Validation errors
        if (error.response?.status === 422) {
            console.warn('[API] 422 Validation Error');
            const validationErrors = error.response?.data?.errors || error.response?.data?.error || {};
            const errorMessage = error.response?.data?.message || 'Dữ liệu không hợp lệ';
            
            return Promise.reject({ 
                message: errorMessage,
                code: 'VALIDATION_ERROR',
                status: 422,
                validationErrors: validationErrors
            });
        }

        // Xử lý timeout errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            console.error('[API] Request timeout');
            return Promise.reject({ 
                message: 'Request timeout. Vui lòng thử lại sau.',
                code: 'TIMEOUT',
                status: 408
            });
        }

        // Kiểm tra lỗi kết nối và hiển thị cảnh báo
        if (!error.response || error.message.includes('Network Error')) {
            showConnectionWarning();
            return Promise.reject({ 
                message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
                code: 'NETWORK_ERROR'
            });
        }
        
        const { response } = error;
        const serverMsg = response?.data?.message || response?.data?.error || response?.statusText;
        return Promise.reject({ 
            message: serverMsg || 'Lỗi kết nối đến máy chủ',
            code: `HTTP_${response.status}`,
            status: response.status
        });
    }
);

export default axiosClient;
