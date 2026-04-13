import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import callApi from '../../apis/handleApi';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './ResidentManagement.css';

const ResidentManagement = () => {
  const { currentUser, logout } = useAuth();
  const [residents, setResidents] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [residentApartments, setResidentApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', 'edit'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [showResidentModal, setShowResidentModal] = useState(false);
  // Lọc cư dân theo từ khóa tìm kiếm
  const filteredResidents = residents.filter(resident => 
    resident.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resident.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resident.phone.includes(searchTerm)
  );

  // Thêm phân trang
  const {
    currentItems: paginatedResidents,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(filteredResidents);

  useEffect(() => {
    fetchResidents();
    fetchApartments();
  }, []);

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const response = await callApi('/customers');
      setResidents(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu cư dân. Vui lòng thử lại sau.');
      console.error('Error fetching residents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApartments = async () => {
    try {
      const response = await callApi('/apartments');
      setApartments(response);
    } catch (err) {
      console.error('Error fetching apartments:', err);
    }
  };

  const fetchResidentDetails = async (residentId) => {
    setLoading(true);
    try {
      // Lọc ra những căn hộ thuộc về cư dân này
      const residentApts = apartments.filter(apt => apt.customerId === residentId);
      setResidentApartments(residentApts);
      setError('');
    } catch (err) {
      setError('Không thể tải chi tiết cư dân. Vui lòng thử lại sau.');
      console.error('Error fetching resident details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResident = async (resident) => {
    setSelectedResident(resident);
    await fetchResidentDetails(resident.id);
    setViewMode('detail');
  };

  const handleEditResident = (resident) => {
    setSelectedResident(resident);
    setFormData({
      name: resident.name,
      email: resident.email,
      phone: resident.phone,
      address: resident.address
    });
    setViewMode('edit');
  };

  const handleAddResident = () => {
    setSelectedResident(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
    setViewMode('edit');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu
    if (!formData.name || !formData.email || !formData.phone) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    
    try {
      const apiMethod = selectedResident ? 'put' : 'post';
      const endpoint = selectedResident 
        ? `/customers/${selectedResident.id}` 
        : '/customers';
      
      const response = await callApi(endpoint, formData, apiMethod);
      
      if (response) {
        // Cập nhật danh sách
        await fetchResidents();
        setViewMode('list');
        setError('');
        
        // Hiển thị thông báo thành công
        alert(selectedResident ? 'Cập nhật cư dân thành công' : 'Thêm cư dân mới thành công');
      }
    } catch (err) {
      setError('Không thể lưu dữ liệu. Vui lòng thử lại sau.');
      console.error('Error saving resident:', err);
    }
  };

  const handleDeleteResident = async (residentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa cư dân này?')) return;
    
    try {
      // Kiểm tra xem cư dân có đang sở hữu căn hộ nào không
      const residentApts = apartments.filter(apt => apt.customerId === residentId);
      
      if (residentApts.length > 0) {
        alert('Không thể xóa cư dân này vì họ đang sở hữu căn hộ. Vui lòng cập nhật thông tin căn hộ trước.');
        return;
      }
      
      await callApi(`/customers/${residentId}`, null, 'delete');
      
      // Cập nhật danh sách
      await fetchResidents();
      setViewMode('list');
      
      // Hiển thị thông báo thành công
      alert('Xóa cư dân thành công');
    } catch (err) {
      setError('Không thể xóa cư dân. Vui lòng thử lại sau.');
      console.error('Error deleting resident:', err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const backToList = () => {
    setSelectedResident(null);
    setResidentApartments([]);
    setViewMode('list');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="resident-management">
      <div className="page-header-wrapper mb-4">
        <PageHeader 
          title="Quản lý cư dân" 
          buttonText="Thêm cư dân mới"
          onButtonClick={handleAddResident}
        />
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {viewMode === 'list' && (
        <>
          {/* Search Box */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row">
                <div className="col">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm kiếm cư dân theo tên, email hoặc số điện thoại..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Residents List */}
          <div className="data-table-container">
            <div className="data-table-header">
              <h5 className="mb-0">Danh sách cư dân</h5>
            </div>
            <div className="table-responsive">
              <table className="data-table table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Địa chỉ</th>
                    <th style={{ width: '150px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResidents.length > 0 ? (
                    paginatedResidents.map((resident, index) => (
                      <tr key={resident.id}>
                        <td>{(currentPage - 1) * 8 + index + 1}</td>
                        <td>{resident.name}</td>
                        <td>{resident.email}</td>
                        <td>{resident.phone}</td>
                        <td>{resident.address}</td>
                        <td>
                          <div className="resident-actions">
                            <button
                              className="view-btn"
                              onClick={() => handleViewResident(resident)}
                              title="Xem"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </button>
                            <button
                              className="edit-btn"
                              onClick={() => handleEditResident(resident)}
                              title="Sửa"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteResident(resident.id)}
                              title="Xóa"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        <div className="empty-state-icon">👥</div>
                        <div className="empty-state-title">Chưa có cư dân nào</div>
                        <div>Thêm cư dân mới để bắt đầu quản lý</div>
                        <button
                          className="btn btn-sm btn-primary mt-3"
                          onClick={() => setShowResidentModal(true)}
                        >
                          Thêm cư dân mới
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Thêm phân trang */}
            {filteredResidents.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
              />
            )}
          </div>
        </>
      )}

      {viewMode === 'detail' && selectedResident && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Thông tin chi tiết cư dân</h5>
            <button className="btn btn-outline-secondary" onClick={backToList}>
              Quay lại danh sách
            </button>
          </div>
          <div className="card-body">
            <div className="row mb-4">
              <div className="col-md-6">
                <h6 className="text-muted mb-3">Thông tin cá nhân</h6>
                <div className="mb-2">
                  <strong>Họ tên:</strong> {selectedResident.name}
                </div>
                <div className="mb-2">
                  <strong>Email:</strong> {selectedResident.email}
                </div>
                <div className="mb-2">
                  <strong>Số điện thoại:</strong> {selectedResident.phone}
                </div>
                <div className="mb-2">
                  <strong>Địa chỉ:</strong> {selectedResident.address}
                </div>
              </div>
              <div className="col-md-6">
                <h6 className="text-muted mb-3">Căn hộ sở hữu</h6>
                {residentApartments.length > 0 ? (
                  <ul className="list-group">
                    {residentApartments.map(apt => (
                      <li key={apt.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-bold">{apt.name}</div>
                          <small>Block {apt.block}, Tầng {apt.floor}, {apt.area}m²</small>
                        </div>
                        <span className="badge bg-primary rounded-pill">{apt.rooms} phòng</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="alert alert-light">Cư dân chưa sở hữu căn hộ nào</div>
                )}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={() => handleEditResident(selectedResident)}>
                Chỉnh sửa thông tin
              </button>
              <button className="btn btn-danger" onClick={() => handleDeleteResident(selectedResident.id)}>
                Xóa cư dân
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'edit' && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{selectedResident ? 'Chỉnh sửa thông tin cư dân' : 'Thêm cư dân mới'}</h5>
            <button className="btn btn-outline-secondary" onClick={backToList}>
              Hủy
            </button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Họ tên <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email <span className="text-danger">*</span></label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Số điện thoại <span className="text-danger">*</span></label>
                  <input
                    type="tel"
                    className="form-control"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Địa chỉ</label>
                  <input
                    type="text"
                    className="form-control"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                <button type="button" className="btn btn-outline-secondary" onClick={backToList}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {selectedResident ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentManagement;