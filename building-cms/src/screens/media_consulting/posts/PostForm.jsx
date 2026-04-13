import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faSave, faTimes, faImage } from '@fortawesome/free-solid-svg-icons';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';
import '../MediaConsulting.css';

const topicOptions = [
  { value: '', label: '-- Chọn chủ đề bài viết --' },
  { value: 'news', label: 'Tin tức' },
  { value: 'event', label: 'Sự kiện' },
  { value: 'promotion', label: 'Khuyến mãi' },
  { value: 'announcement', label: 'Thông báo' },
  { value: 'feedback', label: 'Phản ánh' },
];

const statusOptions = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
];

export default function PostForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = useMediaConsultingPath();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('pending'); // Luôn mặc định "Chờ duyệt" cho Resident
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [senderName, setSenderName] = useState(user?.fullName || user?.email || '');

  useEffect(() => {
    if (isEdit && id) {
      fetchPost();
    }
  }, [id, isEdit]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/posts/${id}`);
      setTitle(response.title || '');
      setContent(response.content || '');
      setTopic(response.topic || '');
      setStatus(response.status || 'pending');
      setSenderName(response.senderName || user?.fullName || user?.email || '');
      if (response.imageUrl) {
        setPreviewUrl(response.imageUrl);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      toast.error('Không thể tải bài viết');
      navigate(`${basePath}/posts`);
    } finally {
      setLoading(false);
    }
  };

  const onImageChange = e => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ hỗ trợ hình ảnh JPEG hoặc PNG!');
      e.target.value = ''; // Clear input
      return;
    }

    // Validate file size (5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File không được vượt quá 5MB. Vui lòng chọn file nhỏ hơn.');
      e.target.value = ''; // Clear input
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.onerror = () => {
      toast.error('Có lỗi xảy ra khi đọc file. Vui lòng thử lại.');
      e.target.value = ''; // Clear input
      setImageFile(null);
      setPreviewUrl('');
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async e => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề bài viết');
      return;
    }
    if (!topic) {
      toast.error('Vui lòng chọn chủ đề bài viết');
      return;
    }
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = previewUrl || '';
      if (imageFile) {
        const reader = new FileReader();
        imageUrl = await new Promise((resolve, reject) => {
          reader.onerror = reject;
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(imageFile);
        });
      }

      const postData = {
        title: title.trim(),
        content: content.trim(),
        senderName: senderName.trim() || user?.fullName || user?.email || 'Không rõ',        
        senderId: user?.Id || user?.id, 
        topic: topic,
        status: status, 
        imageUrl: imageUrl || '',
      };

      console.log('Submitting post data:', postData);

      if (isEdit) {
        await callApi(`/posts/${id}`, postData, 'put');
        toast.success('Cập nhật bài viết thành công!');
      } else {
        const response = await callApi('/posts', postData, 'post');
        console.log('Post created:', response);
        toast.success('Tạo bài viết thành công!');
      }

      navigate(`${basePath}/posts`);
    } catch (error) {
      console.error('Error saving post:', error);

      // Xử lý 422 Validation Errors
      if (error.code === 'VALIDATION_ERROR' && error.validationErrors) {
        const validationErrors = error.validationErrors;
        const fieldErrors = Object.entries(validationErrors)
          .map(([field, message]) => `${field}: ${message}`)
          .join(', ');
        toast.error(`Dữ liệu không hợp lệ: ${fieldErrors}`);
        return;
      }

      const errorMessage = error?.response?.data?.message || error?.message || 'Có lỗi xảy ra';
      toast.error(isEdit ? `Không thể cập nhật bài viết: ${errorMessage}` : `Không thể tạo bài viết: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className="mc-spinner">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 mc-fade-in">
      <div className="mc-form-card">
        <div className="mc-form-card-header">
          <FontAwesomeIcon icon={faFileAlt} />
          {isEdit ? 'Sửa bài viết' : 'Thêm bài viết'}
        </div>
        <div className="mc-form-card-body">
          <form onSubmit={onSubmit}>
            <div className="mb-4">
              <label htmlFor="title" className="mc-form-label">Tiêu đề *</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="mc-form-input"
                placeholder="Nhập tiêu đề bài viết"
              />
            </div>

            <div className="mb-4">
              <label className="mc-form-label">Tên người gửi:</label>
              <input
                type="text"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                className="mc-form-input"
                placeholder="Nhập tên người gửi"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="topic" className="mc-form-label">Chủ đề bài viết *</label>
              <select
                id="topic"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                required
                className="mc-form-select"
              >
                {topicOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="content" className="mc-form-label">Nội dung *</label>
              <textarea
                id="content"
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                className="mc-form-textarea"
                placeholder="Nhập nội dung bài viết"
                rows="10"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="status" className="mc-form-label">Trạng thái</label>
              <select
                id="status"
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="mc-form-select"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="image" className="mc-form-label">Ảnh đại diện:</label>
              <div className="mc-form-file-input">
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="image" style={{ cursor: 'pointer', display: 'block' }}>
                  <FontAwesomeIcon icon={faImage} size="2x" style={{ color: '#9ca3af', marginBottom: '8px' }} />
                  <div style={{ color: '#6b7280' }}>Nhấn để chọn ảnh</div>
                </label>
              </div>
              {previewUrl && (
                <div className="mt-3">
                  <img src={previewUrl} alt="Ảnh xem trước" style={{ maxHeight: '260px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                </div>
              )}
            </div>

            <div className="mc-form-actions">
              <Link to={`${basePath}/posts`} className="mc-btn mc-btn-secondary">
                Quay lại
              </Link>
              <button
                type="submit"
                className="mc-btn mc-btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} />
                    {isEdit ? 'Cập nhật' : 'Tạo mới'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

