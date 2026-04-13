import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const NotificationDetails = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previousVersions, setPreviousVersions] = useState([]);
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    fetchNotification();
  }, [id]);

  // Đóng modal khi nhấn ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && zoomedImage) {
        setZoomedImage(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [zoomedImage]);

  const fetchNotification = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/notifications/${id}`);
      setNotification(response);
      
      // Fetch previous versions if any
      if (response.editedToId) {
        try {
          const allNotifications = await callApi('/notifications');
          const getAllPreviousVersions = (currentId) => {
            const previous = allNotifications.find(n => n.editedToId === currentId);
            if (!previous) return [];
            return [...getAllPreviousVersions(previous.id), previous];
          };
          const prevVersions = getAllPreviousVersions(id)
            .sort((a, b) => new Date(b.sendDate) - new Date(a.sendDate));
          setPreviousVersions(prevVersions);
        } catch (error) {
          console.error('Error fetching previous versions:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching notification:', error);
      toast.error('Không tìm thấy thông báo');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="alert alert-warning">
        Không tìm thấy thông báo
      </div>
    );
  }

  const hasEditHistory = previousVersions.length > 0;

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title mb-0">Chi tiết Thông Báo</h3>
        </div>
        <div className="card-body">
          {hasEditHistory && (
            <div className="alert alert-info">
              <i className="fas fa-edit me-2"></i>
              Đã chỉnh sửa
            </div>
          )}
          <div className="mb-3">
            <h4>Tiêu đề</h4>
            <p className="fs-5">{notification.title}</p>
          </div>
          <div className="mb-3">
            <h4>Nội dung</h4>
            <p>{notification.content}</p>
          </div>
          <div className="mb-3">
            <p><strong>Loại:</strong> {notification.type}</p>
            <p>
              <strong>Ngày tạo:</strong>{' '}
              {new Date(notification.createdAt).toLocaleString('vi-VN')}
            </p>
            <p>
              <strong>Ngày gửi:</strong>{' '}
              {new Date(notification.sendDate).toLocaleString('vi-VN')}
            </p>
            <p>
              <strong>Người gửi:</strong>{' '}
              {notification.sender}
            </p>
          </div>
          <div className="mb-3">
            <h4>Hình ảnh</h4>
            <div className="d-flex flex-wrap gap-2">
              {notification.images && notification.images.length > 0 ? (
                notification.images.map((img, index) => (
                  <img 
                    key={index} 
                    src={img} 
                    alt={`Ảnh ${index + 1}`} 
                    className="img-thumbnail" 
                    style={{ 
                      maxWidth: '200px', 
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease'
                    }}
                    onClick={() => setZoomedImage(img)}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  />
                ))
              ) : (
                <p className="text-muted">Không có hình ảnh.</p>
              )}
            </div>
          </div>
          {hasEditHistory && (
            <div className="mb-3">
              <h4>
                <i className="fas fa-history me-2"></i>
                Thông báo trước đó
              </h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {previousVersions.map((prevNotification, index) => (
                  <div
                    key={prevNotification.id}
                    className="card mb-2"
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.location.href = `${basePath}/notifications/${prevNotification.id}`}
                  >
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-danger">Phiên bản {previousVersions.length - index}</span>
                        <span className="text-muted">
                          {new Date(prevNotification.sendDate).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <strong>Tiêu đề:</strong> {prevNotification.title.length > 60
                        ? `${prevNotification.title.substring(0, 60)}...`
                        : prevNotification.title}
                      <br />
                      <strong>Loại:</strong> {prevNotification.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3">
            <Link to={`${basePath}/notifications`} className="btn btn-secondary">
              <i className="fas fa-arrow-left me-2"></i>
              Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            zIndex: 1050,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            cursor: 'pointer'
          }}
          onClick={() => setZoomedImage(null)}
        >
          <div 
            className="position-relative" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="img-fluid rounded shadow-lg"
              style={{
                maxHeight: '90vh',
                maxWidth: '90vw',
                objectFit: 'contain'
              }}
            />
            <button
              className="btn btn-light position-absolute top-0 end-0 m-2"
              onClick={() => setZoomedImage(null)}
              style={{
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#dc3545'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDetails;

