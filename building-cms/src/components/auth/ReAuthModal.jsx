import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faEnvelope, faKey, faTimes } from '@fortawesome/free-solid-svg-icons';
import './ReAuthModal.css';

const ReAuthModal = ({ isOpen, onSuccess, onClose }) => {
  const { login, user, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill email từ user hiện tại nếu có
  useEffect(() => {
    if (isOpen && user?.email) {
      setEmail(user.email);
    }
  }, [isOpen, user]);

  // Reset form khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setIsLoading(true);
    try {
      // Lưu token và userRole hiện tại để restore sau
      const currentToken = sessionStorage.getItem('token') || localStorage.getItem('token');
      const currentUserRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
      
      // Gọi API login để verify password
      // Sử dụng axios trực tiếp để tránh interceptor tự động lưu token
      const axios = (await import('axios')).default;
      const axiosClient = (await import('../../apis/axiosClient')).default;
      const baseURL = axiosClient.defaults.baseURL;
      
      const response = await axios.post(`${baseURL}/auth/login`, { email, password }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.token) {
        // Verify thành công - restore token và userRole cũ (không thay đổi session)
        if (currentToken) {
          // Restore lại token cũ ngay lập tức
          sessionStorage.setItem('token', currentToken);
          localStorage.setItem('token', currentToken);
          if (currentUserRole) {
            sessionStorage.setItem('userRole', currentUserRole);
            localStorage.setItem('userRole', currentUserRole);
          }
          console.log('[ReAuthModal] Password verified, restored original session');
        }
        // Gọi onSuccess để lưu timestamp
        onSuccess();
      } else {
        setError('Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err) {
      console.error('[ReAuthModal] Login error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="reauth-modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="reauth-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="reauth-modal-header">
          <div className="reauth-modal-icon">
            <FontAwesomeIcon icon={faLock} />
          </div>
          <h3>Xác thực danh tính</h3>
          {/* Không hiển thị nút đóng - user phải xác thực để tiếp tục */}
        </div>
        
        <div className="reauth-modal-body">
          <p className="reauth-modal-description">
            Để bảo mật thông tin lương, vui lòng đăng nhập lại để xác thực danh tính của bạn.
          </p>
          
          {error && (
            <div className="reauth-modal-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="reauth-modal-form">
            <div className="reauth-form-group">
              <label htmlFor="reauth-email">
                <FontAwesomeIcon icon={faEnvelope} className="reauth-input-icon" />
                Email
              </label>
              <input
                type="email"
                id="reauth-email"
                className="reauth-form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email của bạn"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>
            
            <div className="reauth-form-group">
              <label htmlFor="reauth-password">
                <FontAwesomeIcon icon={faKey} className="reauth-input-icon" />
                Mật khẩu
              </label>
              <input
                type="password"
                id="reauth-password"
                className="reauth-form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="reauth-modal-actions">
              <button
                type="submit"
                className="reauth-btn-submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Đang xác thực...
                  </>
                ) : (
                  'Xác thực'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReAuthModal;

