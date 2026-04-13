import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faHome, faSignOutAlt, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import './UnauthorizedScreen.css';

const UnauthorizedScreen = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (!user || !user.role) return '/';
    
    const role = user.role;
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'manager') return '/manager/dashboard';
    if (role === 'tender_manager') return '/tender/dashboard';
    if (role === 'media_consulting_manager') return '/media-consulting/dashboard';
    return '/';
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="container-fluid d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="card shadow-lg" style={{ maxWidth: '600px', width: '100%' }}>
        <div className="card-body p-5 text-center">
          <div className="mb-4">
            <FontAwesomeIcon icon={faLock} className="text-warning" style={{ fontSize: '5rem' }} />
          </div>
          <h2 className="card-title mb-3 text-warning">Không có quyền truy cập</h2>
          <p className="card-text text-muted mb-4">
            Bạn không có quyền truy cập vào trang này. Vui lòng liên hệ với quản trị viên nếu bạn cần quyền truy cập.
          </p>
          
          {user && (
            <div className="d-flex flex-column gap-2">
              <div className="alert alert-info text-start mb-3">
                <strong>Thông tin tài khoản:</strong>
                <ul className="mb-0 mt-2">
                  <li>Email: {user.email || 'N/A'}</li>
                  <li>Vai trò: {user.role || 'N/A'}</li>
                </ul>
              </div>
              
              <div className="d-flex flex-wrap gap-2 justify-content-center">
                <button 
                  className="btn btn-outline-secondary" 
                  onClick={handleGoBack}
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
                  Quay lại
                </button>
                <Link 
                  to={getDashboardPath()} 
                  className="btn btn-primary"
                >
                  <FontAwesomeIcon icon={faHome} className="me-2" />
                  Về Dashboard
                </Link>
                <button 
                  onClick={logout} 
                  className="btn btn-outline-danger"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
          
          {!user && (
            <div className="d-flex gap-2 justify-content-center">
              <Link to="/login" className="btn btn-primary">
                <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
                Đăng nhập
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedScreen; 