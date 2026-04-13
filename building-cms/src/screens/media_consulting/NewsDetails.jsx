import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../hooks/useMediaConsultingPath';

const NewsDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = useMediaConsultingPath();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [mainImage, setMainImage] = useState(null);

  useEffect(() => {
    fetchNews();
  }, [id]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/news/${id}`);
      setNews(response);
      if (response.images && response.images.length > 0) {
        setMainImage(response.images[0]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error('Không tìm thấy tin tức');
      navigate(`${basePath}/news`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tin tức này?')) {
      try {
        await callApi(`/news/${id}`, null, 'delete');
        toast.success('Xóa tin tức thành công!');
        navigate(`${basePath}/news`, {
          state: { message: 'Xóa tin tức thành công!' }
        });
      } catch (error) {
        console.error('Error deleting news:', error);
        toast.error('Không thể xóa tin tức');
      }
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

  if (!news) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning text-center">
          <i className="fas fa-exclamation-triangle me-2"></i>
          Không tìm thấy tin tức
        </div>
        <div className="text-center">
          <Link to={`${basePath}/news`} className="btn btn-primary">
            <i className="fas fa-arrow-left me-2"></i>Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="card shadow-lg border-0">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h3 className="mb-0">
            <i className="fas fa-newspaper me-2"></i>Chi tiết tin tức
          </h3>
          <div className="d-flex gap-2 align-items-center">
            <Link to={`${basePath}/news/edit/${id}`} className="btn btn-warning btn-sm" style={{ minWidth: '80px', textAlign: 'center' }}>
              <i className="fas fa-edit me-1"></i>Sửa
            </Link>
            <button onClick={handleDelete} className="btn btn-danger btn-sm" style={{ minWidth: '80px', textAlign: 'center' }}>
              <i className="fas fa-trash-alt me-1"></i>Xóa
            </button>
          </div>
        </div>
        
        <div className="card-body">
          <div className="row">
            <div className="col-md-8">
              <h4 className="text-primary mb-3">{news.title}</h4>
              
              <div className="mb-3">
                <div className="d-flex flex-wrap gap-3 mb-3">
                  <span className="badge bg-info">
                    <i className="fas fa-folder me-1"></i>{news.category || 'Chưa phân loại'}
                  </span>
                  <span className={`badge ${
                    news.status === 'published' ? 'bg-success' : 
                    news.status === 'draft' ? 'bg-warning' : 'bg-secondary'
                  }`}>
                    <i className="fas fa-info-circle me-1"></i>{news.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                  </span>
                </div>
                <p className="text-muted">
                  <i className="fas fa-user me-1"></i>Tác giả: {news.author || 'Chưa có'}
                </p>
                <p className="text-muted">
                  <i className="far fa-calendar me-1"></i>Ngày tạo: {
                    news.createdAt ? new Date(news.createdAt).toLocaleString('vi-VN') : 'Chưa có'
                  }
                </p>
                {news.publishedDate && (
                  <p className="text-muted">
                    <i className="far fa-calendar-check me-1"></i>Ngày xuất bản: {
                      new Date(news.publishedDate).toLocaleString('vi-VN')
                    }
                  </p>
                )}
              </div>

              <div className="mb-4">
                <h5 className="text-primary">Nội dung:</h5>
                <div className="border rounded p-3 bg-light" 
                  style={{minHeight: '200px'}}
                  dangerouslySetInnerHTML={{__html: news.content}}
                />
              </div>
            </div>

            <div className="col-md-4">
              {news.images && news.images.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-primary mb-3">Hình ảnh:</h5>
                  <img
                    src={mainImage}
                    alt="Ảnh chính"
                    className="img-fluid rounded shadow-sm mb-3"
                    style={{cursor: 'pointer', maxHeight: '300px', width: '100%', objectFit: 'cover'}}
                    onClick={() => setFullScreenImage(mainImage)}
                  />
                  <div className="d-flex flex-wrap gap-2">
                    {news.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Ảnh ${idx + 1}`}
                        className={`img-thumbnail ${mainImage === img ? 'border-primary' : ''}`}
                        style={{
                          height: '60px',
                          width: '60px',
                          objectFit: 'cover',
                          cursor: 'pointer',
                          borderWidth: mainImage === img ? '2px' : '1px'
                        }}
                        onClick={() => setMainImage(img)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card-footer">
          <Link to={`${basePath}/news`} className="btn btn-secondary">
            <i className="fas fa-arrow-left me-2"></i>Quay lại danh sách
          </Link>
        </div>
      </div>

      {fullScreenImage && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center"
          style={{zIndex: 1050}}
          onClick={() => setFullScreenImage(null)}
        >
          <div className="position-relative" onClick={e => e.stopPropagation()}>
            <img
              src={fullScreenImage}
              alt="Full screen"
              className="img-fluid rounded shadow"
              style={{maxHeight: '90vh', maxWidth: '90vw'}}
            />
            <button
              className="btn btn-light position-absolute top-0 end-0 m-2"
              onClick={() => setFullScreenImage(null)}
              style={{borderRadius: '50%'}}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsDetails;
