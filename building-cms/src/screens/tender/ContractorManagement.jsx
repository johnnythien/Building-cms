import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './ContractorManagement.css';

const ContractorManagement = () => {
  const { currentUser, logout } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    taxCode: '',
    email: '',
    phone: '',
    address: '',
    representativeName: '',
    representativePosition: '',
    status: 'active'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const statusOptions = [
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Ngừng hoạt động' },
    { value: 'banned', label: 'Bị cấm' }
  ];

  // Định nghĩa hàm getStatusLabel trước khi sử dụng
  const getStatusLabel = (status) => {
    const statusObj = statusOptions.find(option => option.value === status);
    return statusObj ? statusObj.label : status;
  };

  // Lọc nhà thầu theo tìm kiếm và bộ lọc
  const filteredContractors = contractors.filter(contractor => {
    const searchFields = [
      contractor.name,
      contractor.taxCode,
      contractor.email,
      contractor.phone,
      contractor.address,
      contractor.representativeName,
      getStatusLabel(contractor.status)
    ].map(field => field?.toLowerCase() || '');

    const matchesSearch = searchTerm === '' || 
      searchFields.some(field => field.includes(searchTerm.toLowerCase()));
    
    const matchesFilter = !filterStatus || contractor.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Thêm phân trang
  const {
    currentItems: paginatedContractors,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(filteredContractors);

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    setLoading(true);
    try {
      const response = await callApi('/contractors');
      setContractors(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu nhà thầu. Vui lòng thử lại sau.');
      console.error('Error fetching contractors:', err);
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
        await callApi(`/contractors/${formData.id}`, formData, 'put');
      } else {
        await callApi('/contractors', formData, 'post');
      }
      resetForm();
      fetchContractors();
      setShowForm(false);
    } catch (err) {
      setError(isEditing 
        ? 'Không thể cập nhật nhà thầu. Vui lòng thử lại.' 
        : 'Không thể tạo nhà thầu mới. Vui lòng thử lại.');
      console.error('Error submitting contractor:', err);
    }
  };

  const handleEdit = (contractor) => {
    setFormData({
      id: contractor.id,
      name: contractor.name,
      taxCode: contractor.taxCode,
      email: contractor.email,
      phone: contractor.phone,
      address: contractor.address,
      representativeName: contractor.representativeName,
      representativePosition: contractor.representativePosition,
      status: contractor.status
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhà thầu này không?')) {
      try {
        await callApi(`/contractors/${id}`, null, 'delete');
        fetchContractors();
      } catch (err) {
        setError('Không thể xóa nhà thầu. Vui lòng thử lại.');
        console.error('Error deleting contractor:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      taxCode: '',
      email: '',
      phone: '',
      address: '',
      representativeName: '',
      representativePosition: '',
      status: 'active'
    });
    setIsEditing(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="contractor-management-content">
      <div className="page-header-wrapper mb-4">
        <PageHeader 
          title="Quản lý nhà thầu" 
          buttonText="Thêm nhà thầu mới"
          onButtonClick={() => {
            resetForm();
            setShowForm(!showForm);
        }}
        />
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {showForm && (
        <div className="contractor-form-container">
          <h2>{isEditing ? 'Cập nhật nhà thầu' : 'Thêm nhà thầu mới'}</h2>
          <form onSubmit={handleSubmit} className="contractor-form">
            <div className="form-group">
              <label htmlFor="name">Tên nhà thầu</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="taxCode">Mã số thuế</label>
                <input
                  type="text"
                  id="taxCode"
                  name="taxCode"
                  value={formData.taxCode}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Số điện thoại</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="address">Địa chỉ</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="representativeName">Người đại diện</label>
                <input
                  type="text"
                  id="representativeName"
                  name="representativeName"
                  value={formData.representativeName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="representativePosition">Chức vụ</label>
                <input
                  type="text"
                  id="representativePosition"
                  name="representativePosition"
                  value={formData.representativePosition}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="status">Trạng thái</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-buttons">
              <button type="submit" className="btn-primary">
                {isEditing ? 'Cập nhật' : 'Thêm mới'}
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="contractor-list-container">
        <h2>Danh sách nhà thầu</h2>
        
        {/* Search and Filter */}
        <div className="search-filter-container mb-3">
          <div className="search-box">
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, mã số thuế, email, số điện thoại..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          <div className="filter-box">
            <label>Lọc theo trạng thái:</label>
            <select value={filterStatus} onChange={handleFilterChange}>
              <option value="">Tất cả</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredContractors.length === 0 ? (
          <div className="no-data">Không có nhà thầu nào</div>
        ) : (
          <>
            <table className="contractor-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên nhà thầu</th>
                  <th>Mã số thuế</th>
                  <th>Người đại diện</th>
                  <th>Số điện thoại</th>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContractors.map((contractor, index) => (
                  <tr key={contractor.id}>
                    <td>{(currentPage - 1) * 8 + index + 1}</td>
                    <td>{contractor.name}</td>
                    <td>{contractor.taxCode}</td>
                    <td>{contractor.representativeName}</td>
                    <td>{contractor.phone}</td>
                    <td>{contractor.email}</td>
                    <td>
                      <span className={`status-badge ${contractor.status}`}>
                        {getStatusLabel(contractor.status)}
                      </span>
                    </td>
                    <td className="actions">
                      <button 
                        className="btn-edit" 
                        onClick={() => handleEdit(contractor)}
                        title="Chỉnh sửa"
                      >
                        <FaEdit />
                      </button>
                      <button 
                        className="btn-delete" 
                        onClick={() => handleDelete(contractor.id)}
                        title="Xóa"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredContractors.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContractorManagement;
