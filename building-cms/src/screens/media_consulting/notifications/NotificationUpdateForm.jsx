import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const notificationTypes = [
  'Chung',
  'Khẩn Cấp',
  'Sự kiện',
  'Bảo trì',
  'Vệ sinh',
  'Thanh toán phí',
  'An ninh',
  'Cuộc họp',
  'Cảnh báo thời tiết',
  'Giới thiệu dịch vụ',
  'Mất đồ / Tìm đồ',
];

const NotificationUpdateForm = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('Chung');
  const [images, setImages] = useState([]);
  const [sendDate, setSendDate] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState({});

  useEffect(() => {
    fetchNotification();
  }, [id]);

  const fetchNotification = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/notifications/${id}`);
      setTitle(response.title || '');
      setContent(response.content || '');
      setType(response.type || 'Chung');
      setImages(response.images || []);
      setSendDate(response.sendDate ? new Date(response.sendDate).toISOString().slice(0, 16) : '');
      setInitialData({
        title: response.title || '',
        content: response.content || '',
        type: response.type || 'Chung',
        images: response.images || [],
        sendDate: response.sendDate ? new Date(response.sendDate).toISOString().slice(0, 16) : '',
      });
    } catch (error) {
      console.error('Error fetching notification:', error);
      toast.error('Không tìm thấy thông báo!');
      navigate(`${basePath}/notifications`);
    } finally {
      setLoading(false);
    }
  };

  const countVietnameseWords = (text) => {
    if (!text.trim()) return 0;
    const words = text.trim().split(/\s+/);
    return words.length;
  };

  const validateForm = () => {
    const newErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Tiêu đề không được để trống';
    } else if (title.length > 100) {
      newErrors.title = 'Tiêu đề không được vượt quá 100 ký tự';
    }
    const wordCount = countVietnameseWords(content);
    if (!content.trim()) {
      newErrors.content = 'Nội dung không được để trống';
    } else if (wordCount > 1000) {
      newErrors.content = 'Nội dung không được vượt quá 1000 chữ';
    }
    if (!sendDate) {
      newErrors.sendDate = 'Ngày gửi không được để trống';
    } else {
      const selectedDate = new Date(sendDate);
      const today = new Date();
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.sendDate = 'Ngày gửi không được là quá khứ';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = async (e) => {
    const uploadedImages = Array.from(e.target.files);
    
    // Validate số lượng
    if (images.length + uploadedImages.length > 5) {
      toast.error('Bạn chỉ có thể tải lên tối đa 5 hình ảnh!');
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png'];
    const invalidTypes = uploadedImages.filter(file => !validTypes.includes(file.type));
    if (invalidTypes.length > 0) {
      toast.error('Chỉ hỗ trợ hình ảnh JPEG hoặc PNG!');
      return;
    }
    
    // Validate file size (5MB per file)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = uploadedImages.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(`Một hoặc nhiều file vượt quá 5MB. Vui lòng chọn file nhỏ hơn.`);
      return;
    }
    
    // Validate total size (20MB total)
    const totalSize = uploadedImages.reduce((sum, file) => sum + file.size, 0);
    const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB
    if (totalSize > MAX_TOTAL_SIZE) {
      toast.error('Tổng kích thước các file không được vượt quá 20MB!');
      return;
    }
    
    try {
      const base64Promises = uploadedImages.map(file => toBase64(file));
      const base64Images = await Promise.all(base64Promises);
      setImages([...images, ...base64Images]);
      toast.success('Tải hình ảnh thành công!');
    } catch (error) {
      console.error('Error converting images to base64:', error);
      toast.error('Có lỗi xảy ra khi xử lý hình ảnh. Vui lòng thử lại.');
    }
  };

  const toBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, index) => index !== indexToRemove));
    toast.info('Đã xóa hình ảnh!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Vui lòng kiểm tra lại thông tin nhập!');
      return;
    }
    setSaving(true);
    try {
      const newNotification = {
        title,
        content,
        type,
        images,
        sender: user?.fullName || user?.email || 'Không rõ',
        createdAt: new Date().toISOString(),
        sendDate: new Date(sendDate).toISOString(),
        isActive: true,
        isEdited: true,
        previousNotificationId: id
      };

      await callApi(`/notifications/${id}`, newNotification, 'put');
      toast.success('Chỉnh sửa thông báo thành công!');
      setTimeout(() => {
        navigate(`${basePath}/notifications`, {
          state: { successMessage: 'Chỉnh sửa thông báo thành công!' }
        });
      }, 1000);
    } catch (error) {
      console.error('Error updating notification:', error);
      toast.error('Không thể cập nhật thông báo');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTitle(initialData.title);
    setContent(initialData.content);
    setType(initialData.type);
    setImages(initialData.images);
    setSendDate(initialData.sendDate);
    setErrors({});
    toast.info('Đã đặt lại dữ liệu form!');
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

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title">
            <i className="fas fa-edit me-2"></i> Cập nhật Thông Báo
          </h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">
                Tiêu đề <span className="text-danger">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề thông báo"
                className={`form-control ${errors.title ? 'is-invalid' : ''}`}
                maxLength={100}
              />
              {errors.title && <div className="invalid-feedback">{errors.title}</div>}
              <small className="form-text text-muted">{title.length}/100 ký tự</small>
            </div>
            <div className="mb-3">
              <label className="form-label">
                Nội dung <span className="text-danger">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung thông báo"
                className={`form-control ${errors.content ? 'is-invalid' : ''}`}
                rows="6"
              />
              {errors.content && <div className="invalid-feedback">{errors.content}</div>}
              <small className="form-text text-muted">{countVietnameseWords(content)}/1000 chữ</small>
            </div>
            <div className="mb-3">
              <label className="form-label">Loại thông báo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="form-select"
              >
                {notificationTypes.map(typeOption => (
                  <option key={typeOption} value={typeOption}>
                    {typeOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Hình ảnh (tối đa 5)</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png"
                onChange={handleImageUpload}
                className="form-control"
              />
              <div className="d-flex flex-wrap gap-2 mt-2">
                {images.map((img, index) => (
                  <div key={index} className="position-relative">
                    <img
                      src={img}
                      alt={`Hình ${index + 1}`}
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="btn btn-sm btn-danger position-absolute top-0 end-0"
                      style={{ transform: 'translate(50%, -50%)' }}
                      title="Xóa hình ảnh"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {images.length > 0 && (
                <small className="form-text text-muted">Đã chọn {images.length}/5 hình ảnh</small>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">
                Ngày gửi <span className="text-danger">*</span>
              </label>
              <input
                type="datetime-local"
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
                className={`form-control ${errors.sendDate ? 'is-invalid' : ''}`}
              />
              {errors.sendDate && <div className="invalid-feedback">{errors.sendDate}</div>}
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary"
              >
                <i className="fas fa-undo me-1"></i> Đặt lại
              </button>
              <Link to={`${basePath}/notifications`} className="btn btn-secondary">
                <i className="fas fa-arrow-left me-1"></i> Quay lại
              </Link>
              <button type="submit" className="btn btn-warning" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-1"></i> Cập nhật
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NotificationUpdateForm;

