import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'manager' // Default role
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Basic Info, Step 2: Role and Complete
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStepOne = (e) => {
    e.preventDefault();
    setError('');

    // Validate first step
    if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    // Password validation
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    // Move to second step
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('[Register] Starting registration process...');
      console.log('[Register] Form data:', formData);
      
      // Register user
      const success = await register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });
      
      console.log('[Register] Registration result:', success);

      if (success) {
        // Redirect to appropriate dashboard based on role
        let redirectPath = '/';
        
        if (formData.role === 'admin') {
          redirectPath = '/admin/dashboard';
        } else if (formData.role === 'manager') {
          redirectPath = '/manager/dashboard';
        } else if (formData.role === 'tender_manager') {
          redirectPath = '/tender/dashboard';
        } else if (formData.role === 'media_consulting_manager') {
          redirectPath = '/media-consulting/dashboard';
        }
        
        console.log('[Register] Redirecting to:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else {
        throw new Error('Đăng ký không thành công');
      }
    } catch (err) {
      console.error('[Register] Registration error:', err);
      setError(err.message || 'Đăng ký không thành công. Vui lòng thử lại.');
      // Go back to first step if there's an error
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on current step
  const renderStep = () => {
    if (step === 1) {
      return (
        <form onSubmit={handleStepOne}>
          <div className="mb-3">
            <label htmlFor="fullName" className="form-label">Họ và tên</label>
            <input
              type="text"
              className="form-control"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Nhập họ và tên"
              required
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Nhập địa chỉ email"
              required
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Mật khẩu</label>
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="confirmPassword" className="form-label">Xác nhận mật khẩu</label>
            <input
              type="password"
              className="form-control"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Nhập lại mật khẩu"
              required
            />
          </div>
          
          <div className="d-grid">
            <button type="submit" className="btn btn-primary">
              Tiếp tục
            </button>
          </div>
        </form>
      );
    } else {
      return (
        <form onSubmit={handleSubmit}>
          <div className="text-center mb-4">
            <div className="user-info-summary">
              <div className="avatar mx-auto mb-3" style={{ width: '60px', height: '60px', fontSize: '1.5rem' }}>
                {formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <h5 className="mb-1">{formData.fullName}</h5>
              <p className="text-secondary mb-3">{formData.email}</p>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="form-label">Chọn vai trò</label>
            <div className="role-options">
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="radio"
                  name="role"
                  id="roleManager"
                  value="manager"
                  checked={formData.role === 'manager'}
                  onChange={handleChange}
                />
                <label className="form-check-label d-flex align-items-center" htmlFor="roleManager">
                  <span className="role-icon me-2">👨‍💼</span>
                  <div>
                    <div className="fw-bold">Quản lý</div>
                    <div className="small text-secondary">Quản lý giao dịch, hóa đơn và báo cáo</div>
                  </div>
                </label>
              </div>
              
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="radio"
                  name="role"
                  id="roleTender"
                  value="tender_manager"
                  checked={formData.role === 'tender_manager'}
                  onChange={handleChange}
                />
                <label className="form-check-label d-flex align-items-center" htmlFor="roleTender">
                  <span className="role-icon me-2">📋</span>
                  <div>
                    <div className="fw-bold">Quản lý đấu thầu</div>
                    <div className="small text-secondary">Quản lý gói thầu và nhà thầu</div>
                  </div>
                </label>
              </div>
              
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="radio"
                  name="role"
                  id="roleAdmin"
                  value="admin"
                  checked={formData.role === 'admin'}
                  onChange={handleChange}
                />
                <label className="form-check-label d-flex align-items-center" htmlFor="roleAdmin">
                  <span className="role-icon me-2">👑</span>
                  <div>
                    <div className="fw-bold">Quản trị viên</div>
                    <div className="small text-secondary">Quyền quản trị toàn bộ hệ thống</div>
                  </div>
                </label>
              </div>
              
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="radio"
                  name="role"
                  id="roleMediaConsulting"
                  value="media_consulting_manager"
                  checked={formData.role === 'media_consulting_manager'}
                  onChange={handleChange}
                />
                <label className="form-check-label d-flex align-items-center" htmlFor="roleMediaConsulting">
                  <span className="role-icon me-2">📢</span>
                  <div>
                    <div className="fw-bold">Quản lý Truyền thông - Tư vấn</div>
                    <div className="small text-secondary">Quản lý tin tức, bài viết, thông báo, góp ý và biểu quyết</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
          
          <div className="d-grid gap-2">
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Đang xử lý...
                </span>
              ) : (
                'Hoàn tất đăng ký'
              )}
            </button>
            
            <button 
              type="button" 
              className="btn btn-outline-secondary" 
              onClick={() => setStep(1)}
            >
              Quay lại
            </button>
          </div>
        </form>
      );
    }
  };

  return (
    <div 
      className="auth-container"
      style={{
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          filter: 'brightness(1) contrast(1)'
        }}
      >
        <source src="/videos/VideoLogin.mp4" type="video/mp4" />
      </video>
      <div className="auth-card slide-up" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-logo">
          <img src="/images/logo.jpg" alt="Nhom1-Building Logo" style={{height:48}} />
        </div>
        
        <h2 className="auth-title">Đăng ký tài khoản</h2>
        <p className="auth-subtitle">
          {step === 1 
            ? 'Tạo tài khoản để bắt đầu quản lý dự án của bạn' 
            : 'Chọn vai trò phù hợp với bạn'}
        </p>
        
        {/* Progress indicator */}
        <div className="d-flex justify-content-center mb-4">
          <div className="step-progress">
            <div className={`step-item ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className="step-connector"></div>
            <div className={`step-item ${step >= 2 ? 'active' : ''}`}>2</div>
          </div>
        </div>
        
        {error && (
          <div className="alert alert-danger slide-in-right" role="alert">
            {error}
          </div>
        )}
        
        <div className="auth-form">
          {renderStep()}
        </div>
        
        <div className="auth-footer">
          Đã có tài khoản? <Link to="/login" className="text-primary">Đăng nhập</Link>
        </div>
      </div>
      
      <style jsx="true">{`
        .role-options {
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        
        .form-check {
          padding: 12px 15px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          margin-left: 0;
          transition: var(--transition);
        }
        
        .form-check:hover {
          background-color: var(--bg-light);
        }
        
        .form-check-input:checked ~ .form-check-label {
          color: var(--primary-color);
        }
        
        .form-check-input:checked ~ .form-check-label .text-secondary {
          color: var(--primary-color) !important;
          opacity: 0.8;
        }
        
        .step-progress {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .step-item {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background-color: var(--bg-light);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          z-index: 1;
        }
        
        .step-item.active {
          background-color: var(--primary-color);
          color: white;
        }
        
        .step-connector {
          height: 2px;
          background-color: var(--border-color);
          flex-grow: 1;
          margin: 0 10px;
        }
      `}</style>
    </div>
  );
};

export default Register; 