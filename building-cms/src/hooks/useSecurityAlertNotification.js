import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import callApi from '../apis/handleApi';

/**
 * Hook để polling và hiển thị SECURITY_ALERT notifications ở tất cả các trang
 * Chỉ dành cho admin và manager
 * 
 * Logic:
 * - Polling mỗi 10 giây (giảm từ 30s để phản hồi nhanh hơn)
 * - Lọc trùng lặp bằng Set lưu các ID đã hiển thị trong từng tab
 * - Lắng nghe localStorage event để trigger việc check ngay lập tức khi tab khác phát hiện cảnh báo
 * - Chỉ hiển thị thông báo mới (chưa từng hiển thị trong tab hiện tại)
 * - Hoạt động ngay cả khi user chưa được load đầy đủ (dựa vào role lưu trong storage)
 */
export const useSecurityAlertNotification = () => {
  const { user, loading: authLoading } = useAuth();
  const displayedIdsRef = useRef(new Set());
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    // Lấy role từ user hoặc localStorage (fallback)
    const getUserRole = () => {
      if (user?.role) {
        return user.role;
      }
      // Fallback: lấy từ localStorage nếu user chưa được load
      const storedRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
      return storedRole;
    };

    const userRole = getUserRole();
    const privilegedRoles = ['admin', 'manager'];
    
    // Chỉ polling nếu role là admin hoặc manager
    // Không cần đợi authLoading vì có thể lấy role từ localStorage
    if (!userRole || !privilegedRoles.includes(userRole)) {
      console.log('[Security Alert] Skipping polling - user role:', userRole);
      return;
    }

    console.log('[Security Alert] Starting polling for role:', userRole);

    // Hàm check và hiển thị security alerts mới
    const checkSecurityAlerts = async () => {
      try {
        console.log('[Security Alert] Polling notifications...');
        const response = await callApi('/notifications');
        const notifications = Array.isArray(response) ? response : [];
        
        console.log('[Security Alert] Total notifications:', notifications.length);

        // Lọc chỉ lấy SECURITY_ALERT và active
        const securityAlerts = notifications.filter(n => {
          const isSecurityAlert = n.type === 'SECURITY_ALERT';
          const isActive = n.isActive !== false;
          return isSecurityAlert && isActive;
        });
        
        console.log('[Security Alert] Security alerts found:', securityAlerts.length);
        console.log('[Security Alert] Alert IDs:', securityAlerts.map(a => a.id));

        // Lọc ra các alert chưa từng hiển thị (theo từng tab)
        const newAlerts = securityAlerts.filter(alert => {
          const alertId = alert.id || alert.Id; // Hỗ trợ cả id và Id
          const hasDisplayed = displayedIdsRef.current.has(alertId);
          if (!hasDisplayed) {
            console.log('[Security Alert] New alert found:', alertId, alert.title);
          }
          return !hasDisplayed;
        });

        console.log('[Security Alert] New alerts to display:', newAlerts.length);

        // Hiển thị toast cho mỗi alert mới và đánh dấu đã hiển thị
        newAlerts.forEach(alert => {
          const alertId = alert.id || alert.Id; // Hỗ trợ cả id và Id
          
          // Kiểm tra lại để tránh hiển thị trùng (race condition)
          if (displayedIdsRef.current.has(alertId)) {
            console.log('[Security Alert] Alert already displayed, skipping:', alertId);
            return;
          }

          const message = `${alert.title || 'Cảnh báo an ninh'}\n${alert.content || ''}`;
          
          console.log('[Security Alert] Displaying toast for alert:', alertId);
          
          // Hiển thị toast với toastId để tránh duplicate
          toast.warning(message, {
            toastId: `security-alert-${alertId}`, // Unique ID để tránh duplicate
            position: "top-right",
            autoClose: 10000, // 10 giây
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            style: {
              backgroundColor: '#fff3cd',
              color: '#856404',
              border: '2px solid #ffc107',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'pre-line',
              maxWidth: '500px'
            }
          });

          // Đánh dấu đã hiển thị
          displayedIdsRef.current.add(alertId);
          console.log('[Security Alert] Marked alert as displayed:', alertId);
        });

        // Cleanup: Xóa các ID cũ (giữ lại tối đa 1000 ID gần nhất trong tab này)
        if (displayedIdsRef.current.size > 1000) {
          const idsArray = Array.from(displayedIdsRef.current);
          const recentIds = idsArray.slice(-1000);
          displayedIdsRef.current = new Set(recentIds);
        }
      } catch (error) {
        // Silent fail để không làm phiền user
        console.warn('[Security Alert Polling] Error:', error);
      }
    };

    // Lắng nghe thay đổi localStorage từ các tab khác để trigger check ngay
    const handleStorageChange = (e) => {
      if (e.key === 'newSecurityAlertTrigger') {
        console.log('[Security Alert] New alert trigger detected, checking immediately');
        checkSecurityAlerts();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check ngay lập tức khi mount (sau 1 giây để đảm bảo app đã sẵn sàng)
    const initialTimeout = setTimeout(() => {
      checkSecurityAlerts();
    }, 1000);

    // Polling mỗi 10 giây (giảm từ 30s để phản hồi nhanh hơn)
    pollingIntervalRef.current = setInterval(checkSecurityAlerts, 10000);

    // Cleanup
    return () => {
      console.log('[Security Alert] Cleaning up polling interval and listeners');
      clearTimeout(initialTimeout);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, authLoading]); // Thêm authLoading vào dependencies

  return null; // Hook không render gì
};

export default useSecurityAlertNotification;
