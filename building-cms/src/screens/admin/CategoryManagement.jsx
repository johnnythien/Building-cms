import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import './CategoryManagement.css';
import PageHeader from '../../components/layout/PageHeader';

const CategoryManagement = () => {
  const { logout } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: 'income', // 'income' hoặc 'expense'
    description: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await callApi('/categories');
      setCategories(response);
      setError('');
    } catch (err) {
      setError('Không thể tải danh mục. Vui lòng thử lại sau.');
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (isEditing) {
        // Cập nhật danh mục
        await callApi(`/categories/${formData.id}`, formData, 'put');
      } else {
        // Tạo danh mục mới
        await callApi('/categories', formData, 'post');
      }
      
      // Reset form và tải lại danh sách
      resetForm();
      fetchCategories();
    } catch (err) {
      setError(isEditing 
        ? 'Không thể cập nhật danh mục. Vui lòng thử lại.' 
        : 'Không thể tạo danh mục mới. Vui lòng thử lại.');
      console.error('Error submitting category:', err);
    }
  };

  const handleEdit = (category) => {
    setFormData({
      id: category.id,
      name: category.name,
      type: category.type,
      description: category.description || ''
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa danh mục này không?')) {
      try {
        await callApi(`/categories/${id}`, null, 'delete');
        fetchCategories();
      } catch (err) {
        setError('Không thể xóa danh mục. Vui lòng thử lại.');
        console.error('Error deleting category:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      type: 'income',
      description: ''
    });
    setIsEditing(false);
  };

  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div className="category-management-content">
        <div className="page-header-wrapper mb-4">
          <PageHeader 
            title="Quản lý danh mục thu chi" 
            hideButton={true}
          />
        </div>

        <div className="search-bar mb-4">
          <input
            type="text"
            placeholder="Tìm kiếm danh mục..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="category-container">
          <div className="category-form-container">
            <h2>{isEditing ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}</h2>
            <form onSubmit={handleSubmit} className="category-form">
              <div className="form-group">
                <label htmlFor="name">Tên danh mục</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="type">Loại danh mục</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                >
                  <option value="income">Thu</option>
                  <option value="expense">Chi</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="description">Mô tả</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                />
              </div>

              <div className="form-buttons">
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Cập nhật' : 'Thêm mới'}
                </button>
                {isEditing && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={resetForm}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="category-list-container">
            <h2>Danh sách danh mục</h2>
            {filteredCategories.length === 0 ? (
              <div className="no-data">Không có danh mục nào</div>
            ) : (
              <table className="category-table">
                <thead>
                  <tr>
                    <th>Tên danh mục</th>
                    <th>Loại</th>
                    <th>Mô tả</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map(category => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>
                        <span className={`category-type ${category.type}`}>
                          {category.type === 'income' ? 'Thu' : 'Chi'}
                        </span>
                      </td>
                      <td>{category.description || '—'}</td>
                      <td className="actions">
                        <button 
                          className="btn-edit" 
                          onClick={() => handleEdit(category)}
                          title="Sửa"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button 
                          className="btn-delete" 
                          onClick={() => handleDelete(category.id)}
                          title="Xóa"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CategoryManagement;