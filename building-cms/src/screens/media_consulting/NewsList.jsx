import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNewspaper, faPlus, faTrash, faEye, faEdit, faImage } from '@fortawesome/free-solid-svg-icons';
import useMediaConsultingPath from '../../hooks/useMediaConsultingPath';
import './MediaConsulting.css';

const NewsList = () => {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [filterCategory, setFilterCategory] = useState('Tất cả');
  const [filterStatus, setFilterStatus] = useState('Tất cả');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [editingNews, setEditingNews] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useMediaConsultingPath();

  useEffect(() => {
    fetchNews();
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  }, [location.state]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await callApi('/news');
      setNewsList(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error('Không thể tải danh sách tin tức');
      setNewsList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa tin tức này không?')) return;
    try {
      await callApi(`/news/${id}`, null, 'delete');
      setNewsList(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      toast.success('Xóa tin tức thành công!');
    } catch (error) {
      console.error('Error deleting news:', error);
      toast.error('Không thể xóa tin tức');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} tin tức đã chọn không?`)) return;
    try {
      await Promise.all(selectedIds.map(id => callApi(`/news/${id}`, null, 'delete')));
      setNewsList(prev => prev.filter(n => !selectedIds.includes(n.id)));
      setSelectedIds([]);
      toast.success('Đã xóa các tin tức được chọn!');
    } catch (error) {
      console.error('Error bulk deleting news:', error);
      toast.error('Không thể xóa một số tin tức');
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

  const handleImageUpload = async (e) => {
    if (!editingNews) return;
    
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate số lượng (tối đa 10 ảnh)
    const MAX_IMAGES = 10;
    const currentImages = Array.isArray(editingNews.images) ? editingNews.images : [];
    if (currentImages.length + files.length > MAX_IMAGES) {
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
      setEditingNews(prev => ({
        ...prev,
        images: [...(Array.isArray(prev.images) ? prev.images : []), ...base64Images]
      }));
      toast.success('Tải hình ảnh thành công!');
    } catch (error) {
      console.error('Error converting images to base64:', error);
      toast.error('Có lỗi xảy ra khi xử lý hình ảnh. Vui lòng thử lại.');
    }
  };

  const handleRemoveImage = (index) => {
    if (!editingNews) return;
    setEditingNews(prev => ({
      ...prev,
      images: (Array.isArray(prev.images) ? prev.images : []).filter((_, i) => i !== index)
    }));
  };

  const handleEdit = (news) => {
    setEditingNews({ 
      ...news,
      images: Array.isArray(news.images) ? [...news.images] : []
    });
  };

  const handleSaveEdit = async () => {
    if (!editingNews.title || !editingNews.content) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    try {
      await callApi(`/news/${editingNews.id}`, editingNews, 'put');
      setNewsList(prev => prev.map(n => n.id === editingNews.id ? editingNews : n));
      setEditingNews(null);
      toast.success('Cập nhật tin tức thành công!');
    } catch (error) {
      console.error('Error updating news:', error);
      toast.error('Không thể cập nhật tin tức');
    }
  };

  const handleCancelEdit = () => {
    setEditingNews(null);
  };

  const toggleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? filteredNews.map(n => n.id) : []);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const categories = ['Tất cả', ...Array.from(new Set(newsList.map(n => n.category).filter(Boolean)))];
  const statuses = ['Tất cả', 'published', 'draft'];

  const filteredNews = newsList.filter(news =>
    (filterCategory === 'Tất cả' || news.category === filterCategory) &&
    (filterStatus === 'Tất cả' || news.status === filterStatus) &&
    (news.title?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (searchDate ? new Date(news.sendDate).toLocaleDateString('vi-VN') === new Date(searchDate).toLocaleDateString('vi-VN') : true)
  );

  if (loading) {
    return (
      <div className="mc-spinner">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mc-news-list-container mc-fade-in">
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show border-0 shadow-sm" style={{ borderRadius: '12px' }} role="alert">
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {/* Page Header */}
      <div className="mc-page-header">
        <h1 className="mc-page-title" style={{margin: 0, color: '#2a3f54', fontSize: '1.75rem', fontWeight: 600}}>
          Danh sách Tin Tức
        </h1>
        <div className="mc-btn-group">
          <Link to={`${basePath}/news/create`} className="mc-btn mc-btn-primary">
            <FontAwesomeIcon icon={faPlus} />
            Tạo mới
          </Link>
          {selectedIds.length > 0 && (
            <button onClick={handleBulkDelete} className="mc-btn mc-btn-danger">
              <FontAwesomeIcon icon={faTrash} />
              Xóa {selectedIds.length} tin
            </button>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <div className="mc-filter-section">
        <div className="mc-filter-row">
          <input
            type="text"
            className="mc-form-control"
            placeholder="Tìm kiếm theo tiêu đề..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="mc-form-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            className="mc-form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status === 'Tất cả' ? 'Tất cả' : status === 'published' ? 'Đã xuất bản' : 'Nháp'}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="mc-form-control"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
          />
        </div>
      </div>

      {filteredNews.length === 0 ? (
        <div className="mc-empty-container">
          <div className="mc-empty-icon">
            <FontAwesomeIcon icon={faNewspaper} />
          </div>
          <div className="mc-empty-title">Không có tin tức nào</div>
          <div className="mc-empty-text">Chưa có tin tức phù hợp với bộ lọc của bạn</div>
        </div>
      ) : (
        <div className="mc-data-card">
          <div className="mc-table-wrapper">
            <table className="mc-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={selectedIds.length === filteredNews.length && filteredNews.length > 0}
                  />
                </th>
                <th>Tiêu đề</th>
                <th>Loại</th>
                <th>Ngày gửi</th>
                <th>Trạng thái</th>
                <th>Hình ảnh</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredNews.map(news => (
                <React.Fragment key={news.id}>
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(news.id)}
                        onChange={() => toggleSelect(news.id)}
                      />
                    </td>
                    <td>
                      {editingNews?.id === news.id ? (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editingNews.title}
                          onChange={(e) => setEditingNews({...editingNews, title: e.target.value})}
                        />
                      ) : (
                        news.title?.length > 15 ? `${news.title.substring(0, 15)}...` : news.title
                      )}
                    </td>
                    <td>
                      {editingNews?.id === news.id ? (
                        <select
                          className="form-select form-select-sm"
                          value={editingNews.category}
                          onChange={(e) => setEditingNews({...editingNews, category: e.target.value})}
                        >
                          {categories.filter(cat => cat !== 'Tất cả').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        news.category
                      )}
                    </td>
                    <td>
                      {editingNews?.id === news.id ? (
                        <input
                          type="datetime-local"
                          className="form-control form-control-sm"
                          value={editingNews.sendDate ? new Date(editingNews.sendDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setEditingNews({...editingNews, sendDate: e.target.value})}
                        />
                      ) : (
                        news.sendDate ? new Date(news.sendDate).toLocaleString('vi-VN') : 'N/A'
                      )}
                    </td>
                    <td>
                      {editingNews?.id === news.id ? (
                        <select
                          className="form-select form-select-sm"
                          value={editingNews.status}
                          onChange={(e) => setEditingNews({...editingNews, status: e.target.value})}
                        >
                          <option value="published">Đã xuất bản</option>
                          <option value="draft">Nháp</option>
                        </select>
                      ) : (
                        news.status === 'published' ? 'Đã xuất bản' : 'Nháp'
                      )}
                    </td>
                    <td>
                      {Array.isArray(news.images) && news.images.length > 0 ? (
                        <img
                          src={news.images[0]}
                          alt="thumbnail"
                          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                        />
                      ) : (
                        <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FontAwesomeIcon icon={faImage} />
                          Không có
                        </span>
                      )}
                    </td>
                    <td>
                      {editingNews?.id === news.id ? (
                        <div className="mc-action-buttons">
                          <button onClick={handleSaveEdit} className="mc-btn mc-btn-success mc-btn-sm">
                            <FontAwesomeIcon icon={faEdit} />
                            Lưu
                          </button>
                          <button onClick={handleCancelEdit} className="mc-btn mc-btn-secondary mc-btn-sm">
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="mc-action-buttons">
                          <button onClick={() => handleEdit(news)} className="mc-btn-icon mc-btn-icon-edit" title="Sửa">
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <Link to={`${basePath}/news/${news.id}`} className="mc-btn-icon mc-btn-icon-view" title="Xem">
                            <FontAwesomeIcon icon={faEye} />
                          </Link>
                          <button onClick={() => handleDelete(news.id)} className="mc-btn-icon mc-btn-icon-delete" title="Xóa">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editingNews?.id === news.id && (
                    <tr>
                      <td colSpan="7" style={{ padding: '20px', backgroundColor: '#f8f9fa' }}>
                        <div style={{ marginBottom: '15px' }}>
                          <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                            <FontAwesomeIcon icon={faImage} style={{ marginRight: '8px' }} />
                            Hình ảnh (Tối đa 10 ảnh, mỗi ảnh tối đa 5MB)
                          </label>
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/jpg"
                            onChange={handleImageUpload}
                            className="form-control form-control-sm"
                            style={{ marginBottom: '10px' }}
                          />
                          {Array.isArray(editingNews.images) && editingNews.images.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                              {editingNews.images.map((img, index) => (
                                <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                                  <img
                                    src={img}
                                    alt={`img-${index}`}
                                    style={{ 
                                      width: '100px', 
                                      height: '100px', 
                                      objectFit: 'cover', 
                                      borderRadius: '8px',
                                      border: '2px solid #dee2e6',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    style={{ 
                                      position: 'absolute', 
                                      top: '-8px', 
                                      right: '-8px',
                                      borderRadius: '50%',
                                      width: '24px',
                                      height: '24px',
                                      padding: '0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      lineHeight: '1'
                                    }}
                                    onClick={() => handleRemoveImage(index)}
                                    title="Xóa ảnh"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                            Nội dung
                          </label>
                          <textarea
                            className="form-control form-control-sm"
                            value={editingNews.content || ''}
                            onChange={(e) => setEditingNews({...editingNews, content: e.target.value})}
                            rows="4"
                            style={{ marginBottom: '10px' }}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsList;
