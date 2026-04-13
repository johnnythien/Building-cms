import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../hooks/useMediaConsultingPath';

const NewsUpdateForm = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [news, setNews] = useState({
    title: '',
    content: '',
    category: 'Tin tức',
    status: 'draft',
    images: [],
    sendDate: '',
    publishedDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNews();
  }, [id]);

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
      toast.error('Không tìm thấy tin tức!');
      navigate(`${basePath}/news`);
    } finally {
      setLoading(false);
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

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    const base64Promises = files.map(file => toBase64(file));
    const base64Images = await Promise.all(base64Promises);
    setNews(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
  };

  const handleRemoveImage = (index) => {
    setNews(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updatedNews = {
        ...news,
        id,
        author: user?.fullName || user?.email || 'Không rõ',
        sendDate: news.sendDate ? new Date(news.sendDate).toISOString() : new Date().toISOString(),
        publishedDate: news.publishedDate ? new Date(news.publishedDate).toISOString() : null,
        updatedAt: new Date().toISOString(),
      };

      await callApi(`/news/${id}`, updatedNews, 'put');
      toast.success('Cập nhật tin tức thành công!');
      
      setTimeout(() => {
        navigate(`${basePath}/news`, {
          state: { successMessage: 'Cập nhật tin tức thành công!' },
        });
      }, 1000);
    } catch (error) {
      console.error('Error updating news:', error);
      toast.error('Không thể cập nhật tin tức');
    } finally {
      setSaving(false);
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

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title">Cập nhật Tin Tức</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Tiêu đề *</label>
              <input
                value={news.title}
                onChange={(e) => setNews({...news, title: e.target.value})}
                required
                className="form-control"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Nội dung *</label>
              <textarea
                value={news.content}
                onChange={(e) => setNews({...news, content: e.target.value})}
                required
                className="form-control"
                rows="5"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Loại tin tức</label>
              <select
                value={news.category}
                onChange={(e) => setNews({...news, category: e.target.value})}
                className="form-select"
              >
                <option value="Sự kiện">Sự kiện</option>
                <option value="Thông báo">Thông báo</option>
                <option value="Bảo trì">Bảo trì</option>
                <option value="Tin tức">Tin tức</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Trạng thái</label>
              <select
                value={news.status}
                onChange={(e) => setNews({...news, status: e.target.value})}
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
                multiple
                onChange={handleImageChange}
                className="form-control"
                accept="image/*"
              />
              <div className="d-flex flex-wrap gap-2 mt-2">
                {news.images.map((img, index) => (
                  <div key={index} className="position-relative">
                    <img
                      src={img}
                      alt={`img-${index}`}
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger position-absolute top-0 end-0"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onClick={() => handleRemoveImage(index)}
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
                type="datetime-local"
                value={news.sendDate}
                onChange={(e) => setNews({...news, sendDate: e.target.value})}
                className="form-control"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Ngày xuất bản</label>
              <input
                type="datetime-local"
                value={news.publishedDate}
                onChange={(e) => setNews({...news, publishedDate: e.target.value})}
                className="form-control"
              />
            </div>

            <div className="d-flex justify-content-end">
              <Link to={`${basePath}/news`} className="btn btn-secondary me-2">
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

export default NewsUpdateForm;
