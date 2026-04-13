import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  // ⚠️ Removed unused icons to reduce bundle and fix eslint warnings
  faChartLine, faFileInvoice, 
  faExchangeAlt, faChartBar, 
  // faBuilding, 
  faUsers, faHouseUser, faFolder, 
  // faClipboardList, 
  faFileContract, faHardHat, faEnvelopeOpenText,
  faAngleLeft, faAngleRight, faUser, faSignOutAlt, faDollarSign,
  faPercent,           // ← Thuế (%)
  // Media Consulting icons
  faNewspaper, faFileAlt, faBell, faComments, faVoteYea,
  faMoneyBillWave,    // ← Tính lương
} from '@fortawesome/free-solid-svg-icons';

// Icon component for menu items
const Icon = ({ icon }) => <span className="menu-icon"><FontAwesomeIcon icon={icon} /></span>;

const MainLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef();
  
  // Toggle sidebar on mobile
  const toggleMobileSidebar = () => {
    setMobileOpen(!mobileOpen);
  };
  
  // Toggle sidebar collapse state
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
    localStorage.setItem('sidebarCollapsed', !sidebarCollapsed);
  };
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user || !user.fullName) return 'U';
    const nameParts = user.fullName.split(' ');
    if (nameParts.length > 1) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    return nameParts[0][0].toUpperCase();
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // Check if menu item is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  
  // Update document title based on current route and user role
  useEffect(() => {
    const baseTitle = 'Nhom1-Building';
    
    // Get current page label from menu items
    const menuItems = getMenuItems();
    const currentMenuItem = menuItems.find(item => {
      return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    });
    const pageLabel = currentMenuItem?.label || 'Dashboard';
    
    // Set document title
    document.title = `${pageLabel} - ${baseTitle}`;
  }, [location.pathname, user]);

  // Load sidebar collapsed state from localStorage and initialize Bootstrap components
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setSidebarCollapsed(savedState === 'true');
    }
    // Close mobile sidebar when changing routes
    setMobileOpen(false);

    // Close sidebar on mobile when clicking outside
    const handleClickOutside = (event) => {
      if (mobileOpen && !event.target.closest('.sidebar') && !event.target.closest('.mobile-toggle')) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    // Initialize Bootstrap dropdowns if available
    if (typeof window !== 'undefined' && typeof window.bootstrap !== 'undefined') {
      const dropdownElementList = document.querySelectorAll('.dropdown-toggle');
      // eslint-disable-next-line no-unused-vars
      const dropdownList = [...dropdownElementList].map(dropdownToggleEl => new window.bootstrap.Dropdown(dropdownToggleEl));
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [location.pathname, mobileOpen]);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Determine menu items based on user role
  const getMenuItems = () => {
    if (!user) return [];
    const items = [];
    
    // Admin menu
    if (user.role === 'admin') {
      items.push(
        { path: '/admin/dashboard', label: 'Tổng quan', icon: faChartLine },
        { path: '/admin/categories', label: 'Danh mục', icon: faFolder }
      );
      
      // Tax menu items - only for admin
      items.push(
        { path: '/admin/tax/dashboard', label: 'Dashboard Thuế', icon: faPercent },
      );
      
      // Media Consulting menu items - only for admin
      items.push(
        { path: '/admin/media-consulting/dashboard', label: 'Dashboard Media', icon: faChartLine },
        { path: '/admin/media-consulting/news', label: 'Quản lý Tin tức', icon: faNewspaper },
        { path: '/admin/media-consulting/posts', label: 'Quản lý Bài viết', icon: faFileAlt },
        { path: '/admin/media-consulting/notifications', label: 'Quản lý Thông báo', icon: faBell },
        { path: '/admin/media-consulting/comments', label: 'Quản lý Góp ý', icon: faComments },
        { path: '/admin/media-consulting/votes', label: 'Quản lý Biểu quyết', icon: faVoteYea },
      );
    }
    
    // Manager menu
    if (user.role === 'manager' || user.role === 'admin') {
      if (user.role !== 'admin') {
        items.push({ path: '/manager/dashboard', label: 'Dashboard', icon: faChartLine });
      }
      items.push(
        { path: '/manager/transactions', label: 'Giao dịch', icon: faExchangeAlt },
        { path: '/manager/invoices', label: 'Quản lý hóa đơn', icon: faFileInvoice },
        { path: '/manager/reports', label: 'Báo cáo', icon: faChartBar },
        { path: '/manager/residents', label: 'Cư dân', icon: faUsers },
        // { path: '/manager/buildings', label: 'Tòa nhà', icon: faBuilding },
        { path: '/manager/apartments', label: 'Căn hộ', icon: faHouseUser }
      );
    }
    
    // Tính lương - chỉ dành cho Admin (vì admin tính lương cho tất cả nhân viên, kể cả manager)
    if (user.role === 'admin') {
      items.push(
        { path: '/admin/salary', label: 'Tính lương', icon: faMoneyBillWave }
      );
    }
    
    // Tender Manager menu
    if (user.role === 'tender_manager' || user.role === 'admin') {
      items.push(
        { path: '/tender/dashboard', label: 'Tổng quan đấu thầu', icon: faChartLine },
        { path: '/tender/tenders', label: 'Gói thầu', icon: faFileContract },
        { path: '/tender/contractors', label: 'Nhà thầu', icon: faHardHat },
        { path: '/tender/bids', label: 'Hồ sơ dự thầu', icon: faEnvelopeOpenText }
      );
    }
    
    return items;
  }; 

  return (
    <div className="app-container">
      {/* Mobile toggle button */}
      <button 
        className="mobile-toggle d-md-none btn btn-primary position-fixed"
        style={{ bottom: '20px', right: '20px', zIndex: 1050, borderRadius: '50%', width: '50px', height: '50px' }}
        onClick={toggleMobileSidebar}
      >
        <FontAwesomeIcon icon={faAngleRight} />
      </button>
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo" style={{display:'flex', alignItems:'center', gap:10}}>
            <img src="/images/logo.jpg" alt="Nhom1-Building Logo" style={{height:36}} />
            {!sidebarCollapsed && (
              <span style={{fontWeight:700, fontSize:'1.0rem', verticalAlign:'middle'}}>Nhom1-Building</span>
            )}
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <FontAwesomeIcon icon={sidebarCollapsed ? faAngleRight : faAngleLeft} />
          </button>
        </div>
        <div className="sidebar-menu">
          {getMenuItems().map((item, index) => (
            <Link 
              key={index} 
              to={item.path} 
              className={`menu-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <Icon icon={item.icon} />
              <span className="menu-text">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
      {/* Main content area */}
      <div className={`content-wrapper ${sidebarCollapsed ? 'content-wrapper-expanded' : ''}`}>
        {/* Header */}
        <div className="app-header">
          <div className="app-title">
            {/* Dynamic page title based on current path */}
            {getMenuItems().find(item => isActive(item.path))?.label || 'Dashboard'}
          </div>
          <div className="header-actions">
            {/* User profile */}
            <div className="user-profile" ref={userDropdownRef} style={{ position: 'relative' }}>
              <button
                className="bg-transparent border-0 d-flex align-items-center"
                type="button"
                onClick={() => setShowUserDropdown((prev) => !prev)}
                style={{ cursor: 'pointer' }}
              >
                <div className="avatar">{getUserInitials()}</div>
                <div className="user-info">
                  <div className="user-name">{user?.fullName || 'Người dùng'}</div>
                  <div className="user-role">
                    {user?.role === 'admin' ? 'Quản trị viên' : 
                     user?.role === 'manager' ? 'Quản lý' : 
                     user?.role === 'tender_manager' ? 'Quản lý đấu thầu' :
                     user?.role === 'media_consulting_manager' ? 'Quản lý Truyền thông' :
                     'Người dùng'}
                  </div>
                </div>
              </button>
              {showUserDropdown && (
                <ul className="dropdown-menu dropdown-menu-end custom-avatar-dropdown show" style={{
                  display: 'block', position: 'absolute', right: 0, top: 50, minWidth: 210,
                  borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: '8px 0', marginTop: 10,
                  zIndex: 1000, background: '#fff'
                }}>
                  <li>
                    <button 
                      className="dropdown-item d-flex align-items-center gap-2" 
                      type="button"
                      onClick={() => { navigate('/profile'); setShowUserDropdown(false); }}
                    >
                      <FontAwesomeIcon icon={faUser} style={{color: '#d4a574'}} />
                      Thông tin cá nhân
                    </button>
                  </li>
                  <li>
                    <button 
                      className="dropdown-item d-flex align-items-center gap-2" 
                      type="button"
                      onClick={() => { navigate('/my-salary'); setShowUserDropdown(false); }}
                    >
                      <FontAwesomeIcon icon={faMoneyBillWave} style={{color: '#d4a574'}} />
                      Lương của tôi
                    </button>
                  </li>
                  <li>
                    <button 
                      className="dropdown-item d-flex align-items-center gap-2 logout-btn" 
                      onClick={handleLogout}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="text-danger" />
                      Đăng xuất
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
        {/* Page content */}
        <main className="fade-in">
          {children}
        </main>
      </div>
      <style jsx>{`
      .custom-avatar-dropdown { min-width: 210px; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.12); padding: 8px 0; margin-top: 10px; }
      .custom-avatar-dropdown .dropdown-item { border-radius: 8px; transition: background 0.15s, color 0.15s; font-weight: 500; padding: 10px 18px; }
      .custom-avatar-dropdown .dropdown-item:hover { background: rgba(212, 165, 116, 0.1); color: #d4a574; }
      .custom-avatar-dropdown .logout-btn:hover { background: #ffeaea; color: #d32f2f; }
      `}</style>
    </div>
  );
};

export default MainLayout;