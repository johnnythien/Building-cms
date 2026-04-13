import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../apis/axiosClient';

// Create context
const AuthContext = createContext();

// Custom hook để sử dụng AuthContext
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Khởi tạo user state từ localStorage nếu có
    const storedRole = localStorage.getItem('userRole');
    const token = localStorage.getItem('token');
    if (token && storedRole) {
      return { role: storedRole };
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Debug Effect
  useEffect(() => {
    console.log('=== Auth State Changed ===');
    console.log('User:', user);
    console.log('Loading:', loading);
    console.log('Token:', localStorage.getItem('token'));
    console.log('Stored Role:', localStorage.getItem('userRole'));
    console.log('========================');
  }, [user, loading]);

  // Kiểm tra trạng thái xác thực khi component mount
  useEffect(() => {
    // Ưu tiên lấy token từ sessionStorage (token riêng của tab này)
    // Nếu không có, lấy từ localStorage (token chung)
    let token = sessionStorage.getItem('token');
    if (!token) {
      token = localStorage.getItem('token');
      // Nếu có token từ localStorage, copy sang sessionStorage để tab này có token riêng
      if (token) {
        sessionStorage.setItem('token', token);
      }
    }
    
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }

    // Lắng nghe thay đổi localStorage từ các tab khác
    // Nhưng không tự động cập nhật state, vì mỗi tab nên có user riêng
    const handleStorageChange = (e) => {
      // Chỉ xử lý khi token hoặc userRole thay đổi
      if (e.key === 'token' || e.key === 'userRole') {
        console.log('[AuthContext] Storage changed in another tab:', e.key, e.newValue);
        
        // Không tự động cập nhật state khi tab khác thay đổi
        // Mỗi tab giữ user riêng của nó
        console.log('[AuthContext] Ignoring storage change from another tab to maintain tab isolation');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Hàm lấy thông tin người dùng từ API
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      console.log('[AuthContext] Fetching user profile...');
      
      // Lấy token từ sessionStorage (token riêng của tab này)
      let currentToken = sessionStorage.getItem('token');
      if (!currentToken) {
        currentToken = localStorage.getItem('token');
        if (currentToken) {
          // Copy token từ localStorage sang sessionStorage
          sessionStorage.setItem('token', currentToken);
        }
      }
      
      if (!currentToken) {
        setLoading(false);
        return;
      }
      
      const response = await axiosClient.get('/auth/me');
      console.log('[AuthContext] User profile response:', response);
      
      // Kiểm tra xem token có thay đổi không (từ tab khác)
      const tokenAfterFetch = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (tokenAfterFetch !== currentToken) {
        console.log('[AuthContext] Token changed during fetch, aborting update');
        setLoading(false);
        return;
      }
      
      // Chỉ cập nhật sessionStorage và localStorage nếu response hợp lệ
      if (response && response.role) {
        // Lưu role vào cả sessionStorage và localStorage
        const oldRole = sessionStorage.getItem('userRole');
        if (oldRole !== response.role) {
          sessionStorage.setItem('userRole', response.role);
          localStorage.setItem('userRole', response.role);
        }
      }
      
      // Cập nhật state
      setUser(response);
      console.log('[AuthContext] User profile loaded successfully');
    } catch (err) {
      console.error('[AuthContext] Error fetching user profile:', err);
      // Nếu lỗi, giữ lại role từ sessionStorage hoặc localStorage
      const storedRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
      if (storedRole) {
        setUser({ role: storedRole });
        console.log('[AuthContext] Using stored role:', storedRole);
      } else {
        setUser(null);
        // Chỉ xóa token nếu thực sự không hợp lệ
        const currentToken = sessionStorage.getItem('token') || localStorage.getItem('token');
        if (currentToken && err.response?.status === 401) {
          sessionStorage.removeItem('token');
          localStorage.removeItem('token');
          console.log('[AuthContext] Token invalid, clearing auth state');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Hàm đăng nhập
  const login = async (email, password) => {
    try {
      console.log('[AuthContext] Login attempt:', { email });
      setLoading(true);
      setError(null);
      
      const response = await axiosClient.post('/auth/login', { email, password });
      console.log('[AuthContext] Login response:', response);
      
      if (response && response.token) {
        // Lưu token vào cả localStorage (để chia sẻ) và sessionStorage (để mỗi tab có token riêng)
        localStorage.setItem('token', response.token);
        sessionStorage.setItem('token', response.token);
        if (response.role) {
          localStorage.setItem('userRole', response.role);
          sessionStorage.setItem('userRole', response.role);
        }
        setUser(response);
        console.log('[AuthContext] Login successful, user set:', response);
        return true;
      } else {
        console.log('[AuthContext] Login failed - no token in response');
        setError('Đăng nhập không thành công - không có token');
        return false;
      }
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      const errorMessage = err.message || err.response?.data?.message || 'Đăng nhập không thành công.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Hàm đăng ký
  const register = async (userData) => {
    try {
      console.log('[AuthContext] Register attempt:', userData);
      setLoading(true);
      setError(null);
      
      // Gọi API đăng ký
      const response = await axiosClient.post('/auth/register', userData);
      console.log('[AuthContext] Register response:', response);
      
      // Lưu token nếu có
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        sessionStorage.setItem('token', response.token);
        
        // Lưu role vào cả localStorage và sessionStorage
        if (response.role) {
          localStorage.setItem('userRole', response.role);
          sessionStorage.setItem('userRole', response.role);
        }
        
        // Lưu thông tin người dùng vào state
        setUser(response);
        console.log('[AuthContext] Register successful, user set:', response);
        
        return true;
      } else {
        console.log('[AuthContext] Register failed - no token in response');
        setError('Đăng ký không thành công - không có token');
        return false;
      }
    } catch (err) {
      console.error('[AuthContext] Register error:', err);
      const errorMessage = err.message || err.response?.data?.message || 'Đăng ký không thành công.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Hàm đăng xuất
  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userRole');
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    setUser(null);
    navigate('/');
  };

  // Hàm cập nhật thông tin người dùng
  const updateProfile = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      let endpoint = '/users/profile';
      let requestData = userData;
      
      // Kiểm tra nếu là yêu cầu đổi mật khẩu
      if (userData.currentPassword && userData.newPassword) {
        endpoint = '/users/change-password';
        requestData = {
          currentPassword: userData.currentPassword,
          newPassword: userData.newPassword
        };
      }
      
      // Gọi API cập nhật thông tin
      const response = await axiosClient.put(endpoint, requestData);
      
      // Cập nhật thông tin người dùng trong state nếu không phải đổi mật khẩu
      if (!userData.currentPassword) {
        setUser(prevUser => ({
          ...prevUser,
          fullName: response.fullName || prevUser.fullName,
          email: response.email || prevUser.email,
          phone: response.phone || prevUser.phone
        }));
      }
      
      return response;
    } catch (err) {
      console.error('Update profile error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Cập nhật không thành công.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Value object để cung cấp cho context
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 