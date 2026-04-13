import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Xử lý query parameters khi component mount
  useEffect(() => {
    const expired = searchParams.get('expired');
    const redirectPath = searchParams.get('redirect');
    
    if (expired === 'true') {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    
    // Lưu redirect path để sử dụng sau khi login thành công
    if (redirectPath) {
      sessionStorage.setItem('loginRedirect', redirectPath);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('[Login] Starting login process...');
      
      // Validate inputs
      if (!email || !password) {
        throw new Error('Vui lòng nhập đầy đủ thông tin');
      }

      console.log('[Login] Calling login function...');
      // Login
      const success = await login(email, password);
      console.log('[Login] Login result:', success);
      
      if (success) {
        // Kiểm tra xem có redirect path được lưu từ query parameter không
        const savedRedirect = sessionStorage.getItem('loginRedirect');
        if (savedRedirect) {
          sessionStorage.removeItem('loginRedirect');
          console.log('[Login] Redirecting to saved path:', savedRedirect);
          // Nếu redirect về /my-salary, thêm query param để báo là từ login
          const redirectPath = decodeURIComponent(savedRedirect);
          if (redirectPath.includes('/my-salary')) {
            navigate(`${redirectPath}${redirectPath.includes('?') ? '&' : '?'}fromLogin=true`, { replace: true });
          } else {
            navigate(redirectPath, { replace: true });
          }
          return;
        }
        
        // Determine redirect based on user role
        const role = localStorage.getItem('userRole');
        console.log('[Login] User role from localStorage:', role);
        
        let redirectPath = '/';
        
        if (role === 'admin') {
          redirectPath = '/admin/dashboard';
        } else if (role === 'manager') {
          redirectPath = '/manager/dashboard';
        } else if (role === 'tender_manager') {
          redirectPath = '/tender/dashboard';
        } else if (role === 'media_consulting_manager') {
          redirectPath = '/media-consulting/dashboard';
        }
        
        console.log('[Login] Redirecting to:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else {
        throw new Error('Đăng nhập không thành công');
      }
    } catch (err) {
      console.error('[Login] Login error:', err);
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
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
        <div className="auth-logo" style={{display:'flex', alignItems:'center', gap:8, justifyContent:'center'}}>
          <img src="/images/logo.jpg" alt="Nhom1-Building Logo" style={{height:36}} />
          <span style={{fontWeight:700, fontSize:'1.2rem', color:'#d4a574'}}>Nhom1-Building</span>
        </div>
        
        <h2 className="auth-title">Đăng nhập</h2>
        <p className="auth-subtitle">Nhập thông tin đăng nhập của bạn để tiếp tục</p>
        
        {error && (
          <div className="alert alert-danger slide-in-right" role="alert">
            {error}
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập địa chỉ email"
              autoComplete="email"
              required
            />
          </div>
          
          <div className="mb-4">
            <div className="d-flex justify-content-between">
              <label htmlFor="password" className="form-label">Mật khẩu</label>
              <Link to="/forgot-password" className="text-primary text-decoration-none small">Quên mật khẩu?</Link>
            </div>
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              required
            />
          </div>
          
          <div className="d-grid">
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </div>
        </form>
        
        <div className="auth-footer">
          Chưa có tài khoản? <Link to="/register" className="text-primary">Đăng ký ngay</Link>
        </div>
        
        {/* Quick login options for demo */}
        <div className="mt-4 pt-3 border-top">
          <p className="text-center text-secondary small mb-3">Đăng nhập nhanh (cho demo)</p>
          <div className="d-flex flex-wrap gap-2 justify-content-center">
            <button 
              className="btn btn-sm btn-outline-secondary" 
              onClick={() => {
                setEmail('an.nguyen@example.com');
                setPassword('P@ss123');
              }}
            >
              Admin
            </button>
            <button 
              className="btn btn-sm btn-outline-secondary" 
              onClick={() => {
                setEmail('binh.tran@example.com');
                setPassword('P@ss123');
              }}
            >
              Quản lý
            </button>
            <button 
              className="btn btn-sm btn-outline-secondary" 
              onClick={() => {
                setEmail('dung.pham@example.com');
                setPassword('P@ss123');
              }}
            >
              Quản lý đấu thầu
            </button>
            <button 
              className="btn btn-sm btn-outline-secondary" 
              onClick={() => {
                setEmail('media.consulting@example.com');
                setPassword('P@ss123');
              }}
            >
              Media Consulting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 