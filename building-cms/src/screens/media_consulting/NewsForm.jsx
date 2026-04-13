import React, { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../hooks/useMediaConsultingPath';

const NewsForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = useMediaConsultingPath();

  const [news, setNews] = useState({
    title: '',
    content: '',
    category: 'Tin tức',
    status: 'draft',
    images: [],
    sendDate: '',
    publishedDate: '',
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isEdit && id) {
      fetchNews();
    }
  }, [id, isEdit]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/news/${id}`);
      setNews({
        title: response.title || '',
        content: response.content || '',
        category: response.category || 'Tin tức',
        status: response.status || 'draft',
        images: response.images || [],
        sendDate: response.sendDate ? new Date(response.sendDate).toISOString().slice(0, 16) : '',
        publishedDate: response.publishedDate ? new Date(response.publishedDate).toISOString().slice(0, 16) : '',
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error('Không thể tải tin tức');
      navigate(`${basePath}/news`);
    } finally {
      setLoading(false);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate số lượng (tối đa 10 ảnh)
    const MAX_IMAGES = 10;
    if (news.images.length + files.length > MAX_IMAGES) {
      toast.error(`Bạn chỉ có thể tải lên tối đa ${MAX_IMAGES} hình ảnh!`);
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const invalidTypes = files.filter(file => !validTypes.includes(file.type));
    if (invalidTypes.length > 0) {
      toast.error('Chỉ hỗ trợ hình ảnh JPEG hoặc PNG!');
      return;
    }

    // Validate file size (5MB per file)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(`Một hoặc nhiều file vượt quá 5MB. Vui lòng chọn file nhỏ hơn.`);
      return;
    }

    // Validate total size (50MB total)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
    if (totalSize > MAX_TOTAL_SIZE) {
      toast.error('Tổng kích thước các file không được vượt quá 50MB!');
      return;
    }

    try {
      const base64Images = await Promise.all(files.map(toBase64));
      setNews((prev) => ({
        ...prev,
        images: [...prev.images, ...base64Images]
      }));
      toast.success('Tải hình ảnh thành công!');
    } catch (error) {
      console.error('Error converting images to base64:', error);
      toast.error('Có lỗi xảy ra khi xử lý hình ảnh. Vui lòng thử lại.');
    }
  };

  const handleImageRemove = (index) => {
    setNews((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNews((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newsData = {
        ...news,
        author: user?.fullName || user?.email || 'Không rõ',
        sendDate: news.sendDate ? new Date(news.sendDate).toISOString() : new Date().toISOString(),
        publishedDate: news.publishedDate ? new Date(news.publishedDate).toISOString() : null,
      };

      if (isEdit) {
        await callApi(`/news/${id}`, newsData, 'put');
        toast.success('Cập nhật tin tức thành công!');
      } else {
        await callApi('/news', newsData, 'post');
        toast.success('Tạo tin tức thành công!');
      }

      navigate(`${basePath}/news`, {
        state: { successMessage: isEdit ? 'Cập nhật tin tức thành công!' : 'Thêm tin tức thành công!' }
      });
    } catch (error) {
      console.error('Error saving news:', error);
      toast.error(isEdit ? 'Không thể cập nhật tin tức' : 'Không thể tạo tin tức');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-primary text-white">
        <h3 className="card-title text-lg font-semibold">{isEdit ? 'Cập nhật Tin Tức' : 'Tạo Tin Tức'}</h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Tiêu đề *</label>
            <input
              name="title"
              value={news.title}
              onChange={handleChange}
              required
              className="form-control"
              placeholder="Nhập tiêu đề"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Nội dung *</label>
            <textarea
              name="content"
              value={news.content}
              onChange={handleChange}
              required
              className="form-control"
              placeholder="Nhập nội dung"
              rows="5"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Loại tin tức</label>
            <select
              name="category"
              value={news.category}
              onChange={handleChange}
              className="form-select"
            >
              <option value="Sự kiện">Sự kiện</option>
              <option value="Thông báo">Thông báo</option>
              <option value="Bảo trì">Bảo trì</option>
              <option value="Tin tức">Tin tức</option>
              <option value="Khuyến mãi">Khuyến mãi</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Trạng thái</label>
            <select
              name="status"
              value={news.status}
              onChange={handleChange}
              className="form-select"
            >
              <option value="draft">Nháp</option>
              <option value="published">Đã xuất bản</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Hình ảnh</label>
            <input
              type="file"
              onChange={handleImageUpload}
              className="form-control"
              multiple
              accept="image/*"
            />
            <div className="d-flex flex-wrap gap-2 mt-2">
              {news.images.map((img, idx) => (
                <div key={idx} className="position-relative">
                  <img
                    src={img}
                    alt={`preview-${idx}`}
                    style={{
                      width: '100px',
                      height: '100px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleImageRemove(idx)}
                    className="btn btn-sm btn-danger position-absolute top-0 end-0"
                    style={{ transform: 'translate(50%, -50%)' }}
                    title="Xóa ảnh"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Ngày gửi</label>
            <input
              name="sendDate"
              type="datetime-local"
              value={news.sendDate}
              onChange={handleChange}
              className="form-control"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Ngày xuất bản</label>
            <input
              name="publishedDate"
              type="datetime-local"
              value={news.publishedDate}
              onChange={handleChange}
              className="form-control"
            />
          </div>

          <div className="d-flex justify-content-end">
            <Link to={`${basePath}/news`} className="btn btn-secondary me-2">
              <i className="fas fa-arrow-left me-1"></i> Quay lại
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Đang lưu...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-1"></i> {isEdit ? 'Cập nhật' : 'Tạo'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewsForm;
