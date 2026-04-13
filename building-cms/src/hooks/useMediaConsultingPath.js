import { useLocation } from 'react-router-dom';

/**
 * Custom hook to get the correct base path for media consulting routes
 * Returns '/admin/media-consulting' if current path starts with '/admin/media-consulting'
 * Otherwise returns '/media-consulting'
 */

const useMediaConsultingPath = () => {
  const location = useLocation();
  
  // Check if current path is under /admin/media-consulting
  const isAdminRoute = location.pathname.startsWith('/admin/media-consulting');
  
  return isAdminRoute ? '/admin/media-consulting' : '/media-consulting';
};

export default useMediaConsultingPath;

