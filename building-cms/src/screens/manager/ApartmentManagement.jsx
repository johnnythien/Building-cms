import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEdit, faUserEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './ApartmentManagement.css';

const ApartmentManagement = () => {
  const { currentUser, logout } = useAuth();
  const [apartments, setApartments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', 'edit', 'assign'
  const [formData, setFormData] = useState({
    name: '',
    floor: '',
    buildingId: '',
    area: '',
    rooms: '',
    customerId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBlock, setFilterBlock] = useState('');
  const [error, setError] = useState('');
  const [maxFloor, setMaxFloor] = useState(0);

  const getResidentName = (customerId) => {
    if (!customerId) return 'Trống';
    const resident = residents.find(r => r.id === customerId);
    return resident ? resident.name : 'Không xác định';
  };

  const getBuildingName = (buildingId) => {
    if (!buildingId) return '';
    const building = buildings.find(b => b.id === Number(buildingId));
    return building ? building.name : `Tòa nhà ${buildingId}`;
  };

  // Lọc căn hộ theo tìm kiếm và bộ lọc
  const filteredApartments = apartments.filter(apartment => {
    const searchFields = [
      apartment.name,
      apartment.floor?.toString(),
      apartment.area?.toString(),
      apartment.rooms?.toString(),
      getResidentName(apartment.customerId),
      getBuildingName(apartment.buildingId)
    ].map(field => field?.toLowerCase() || '');

    const matchesSearch = searchTerm === '' || 
      searchFields.some(field => field.includes(searchTerm.toLowerCase()));
    
    const matchesFilter = !filterBlock || String(apartment.buildingId) === filterBlock;
    
    return matchesSearch && matchesFilter;
  });

  // Thêm phân trang
  const {
    currentItems: paginatedApartments,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(filteredApartments);

  useEffect(() => {
    fetchApartments();
    fetchResidents();
    fetchBuildings();
  }, []);

  const fetchApartments = async () => {
    setLoading(true);
    try {
      const response = await callApi('/apartments');
      setApartments(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu căn hộ. Vui lòng thử lại sau.');
      console.error('Error fetching apartments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const response = await callApi('/customers');
      setResidents(response);
    } catch (err) {
      console.error('Error fetching residents:', err);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await callApi('/buildings');
      setBuildings(response);
    } catch (err) {
      console.error('Error fetching buildings:', err);
    }
  };

  const handleViewApartment = (apartment) => {
    setSelectedApartment(apartment);
    setViewMode('detail');
  };

  const handleEditApartment = (apartment) => {
    setSelectedApartment(apartment);
    setFormData({
      name: apartment.name,
      floor: apartment.floor,
      buildingId: apartment.buildingId || '',
      area: apartment.area,
      rooms: apartment.rooms,
      customerId: apartment.customerId || ''
    });
    setViewMode('edit');
  };

  const handleAddApartment = async () => {
    setSelectedApartment(null);
    setFormData({
      name: '',
      floor: '',
      buildingId: '',
      area: '',
      rooms: '',
      customerId: ''
    });
    await fetchBuildings();
    setViewMode('edit');
  };

  const handleAssignResident = (apartment) => {
    setSelectedApartment(apartment);
    setFormData({
      ...apartment,
      customerId: apartment.customerId || ''
    });
    setViewMode('assign');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'buildingId') {
      const building = buildings.find(b => b.id === Number(value));
      setMaxFloor(building ? building.floors : 0);
      setFormData(prev => ({ ...prev, floor: '' })); // reset tầng khi đổi tòa nhà
    }
  };

  useEffect(() => {
    if (formData.buildingId) {
      const building = buildings.find(b => b.id === Number(formData.buildingId));
      setMaxFloor(building ? building.floors : 0);
    } else {
      setMaxFloor(0);
    }
  }, [formData.buildingId, buildings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu
    if (!formData.name || !formData.floor || !formData.buildingId || !formData.area || !formData.rooms) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    
    try {
      const apiMethod = selectedApartment ? 'put' : 'post';
      const endpoint = selectedApartment 
        ? `/apartments/${selectedApartment.id}` 
        : '/apartments';
      
      const response = await callApi(endpoint, formData, apiMethod);
      
      if (response) {
        // Cập nhật danh sách
        await fetchApartments();
        setViewMode('list');
        setError('');
        
        // Hiển thị thông báo thành công
        alert(selectedApartment ? 'Cập nhật căn hộ thành công' : 'Thêm căn hộ mới thành công');
      }
    } catch (err) {
      setError('Không thể lưu dữ liệu. Vui lòng thử lại sau.');
      console.error('Error saving apartment:', err);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedApartment) return;
    
    try {
      const updatedApartment = {
        ...selectedApartment,
        customerId: formData.customerId ? Number(formData.customerId) : null
      };
      
      const response = await callApi(`/apartments/${selectedApartment.id}`, updatedApartment, 'put');
      
      if (response) {
        // Cập nhật danh sách
        await fetchApartments();
        setViewMode('list');
        setError('');
        
        // Hiển thị thông báo thành công
        alert(formData.customerId 
          ? 'Gán cư dân vào căn hộ thành công' 
          : 'Đã xóa cư dân khỏi căn hộ');
      }
    } catch (err) {
      setError('Không thể gán cư dân. Vui lòng thử lại sau.');
      console.error('Error assigning resident:', err);
    }
  };

  const handleDeleteApartment = async (apartmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa căn hộ này?')) return;
    
    try {
      await callApi(`/apartments/${apartmentId}`, null, 'delete');
      
      // Cập nhật danh sách
      await fetchApartments();
      setViewMode('list');
      
      // Hiển thị thông báo thành công
      alert('Xóa căn hộ thành công');
    } catch (err) {
      setError('Không thể xóa căn hộ. Vui lòng thử lại sau.');
      console.error('Error deleting apartment:', err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (e) => {
    setFilterBlock(e.target.value);
    setCurrentPage(1);
  };

  const backToList = () => {
    setSelectedApartment(null);
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
    <>
      <div className="apartment-management">
        <div className="page-header-wrapper mb-4">
          <PageHeader 
            title="Quản lý căn hộ" 
            buttonText="Thêm căn hộ mới"
            onButtonClick={handleAddApartment}
          />
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {viewMode === 'list' && (
          <div className="apartment-list-view">
            <div className="search-filter-container mb-3">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo mã căn hộ, tầng, diện tích, số phòng, cư dân..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
              
              <div className="filter-box">
                <label>Lọc theo tòa nhà:</label>
                <select value={filterBlock} onChange={handleFilterChange}>
                  <option value="">Tất cả</option>
                  {buildings.map(building => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="data-table-container">
              <div className="data-table-header">
                <h5 className="mb-0">Danh sách căn hộ</h5>
              </div>
              <div className="table-responsive">
                <table className="data-table table align-middle">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã căn hộ</th>
                      <th>Tòa nhà</th>
                      <th>Tầng</th>
                      <th>Diện tích (m²)</th>
                      <th>Số phòng</th>
                      <th>Cư dân</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedApartments.length > 0 ? (
                      paginatedApartments.map((apartment, index) => (
                        <tr key={apartment.id}>
                          <td>{(currentPage - 1) * 8 + index + 1}</td>
                          <td>{apartment.name}</td>
                          <td>{getBuildingName(apartment.buildingId)}</td>
                          <td>{apartment.floor}</td>
                          <td>{apartment.area} m²</td>
                          <td>{apartment.rooms}</td>
                          <td>{getResidentName(apartment.customerId)}</td>
                          <td>
                            <span className="apartment-actions">
                              <button className="view-btn" onClick={() => handleViewApartment(apartment)}>
                                <FontAwesomeIcon icon={faEye} />
                              </button>
                              <button className="edit-btn" onClick={() => handleEditApartment(apartment)}>
                                <FontAwesomeIcon icon={faEdit} />
                              </button>
                              <button 
                                className="assign-btn" 
                                onClick={() => handleAssignResident(apartment)}
                              >
                                <FontAwesomeIcon icon={faUserEdit} />
                              </button>
                              <button className="delete-btn" onClick={() => handleDeleteApartment(apartment.id)}>
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center py-4">
                          <div className="empty-state-icon">🏠</div>
                          <div className="empty-state-title">Chưa có căn hộ nào</div>
                          <div>Thêm căn hộ mới để bắt đầu quản lý</div>
                          <button
                            className="btn btn-sm btn-primary mt-3"
                            onClick={() => setViewMode('edit')}
                          >
                            Thêm căn hộ mới
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredApartments.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={totalItems}
                />
              )}
            </div>
          </div>
        )}
        
        {viewMode === 'detail' && selectedApartment && (
          <div className="apartment-detail-view">
            <div className="section-header">
              <button className="back-btn" onClick={backToList}>Quay lại danh sách</button>
              <h2>Chi tiết căn hộ: {selectedApartment.name}</h2>
            </div>
            
            <div className="apartment-info">
              <div className="info-card">
                <h3>Thông tin căn hộ</h3>
                <p><strong>Mã căn hộ:</strong> {selectedApartment.name}</p>
                <p><strong>Tòa nhà:</strong> {getBuildingName(selectedApartment.buildingId)}</p>
                <p><strong>Tầng:</strong> {selectedApartment.floor}</p>
                <p><strong>Diện tích:</strong> {selectedApartment.area} m²</p>
                <p><strong>Số phòng:</strong> {selectedApartment.rooms}</p>
                <p>
                  <strong>Trạng thái:</strong> 
                  <span className={selectedApartment.customerId ? 'status-occupied' : 'status-vacant'}>
                    {selectedApartment.customerId ? 'Đã có người ở' : 'Trống'}
                  </span>
                </p>
              </div>
              
              {selectedApartment.customerId && (
                <div className="info-card">
                  <h3>Thông tin cư dân</h3>
                  {residents.filter(r => r.id === selectedApartment.customerId).map(resident => (
                    <div key={resident.id}>
                      <p><strong>Họ tên:</strong> {resident.name}</p>
                      <p><strong>Email:</strong> {resident.email}</p>
                      <p><strong>Số điện thoại:</strong> {resident.phone}</p>
                      <p><strong>Địa chỉ liên hệ:</strong> {resident.address}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="action-buttons">
              <button className="edit-btn" onClick={() => handleEditApartment(selectedApartment)}>
                <FontAwesomeIcon icon={faEdit} />
              </button>
              <button className="assign-btn" onClick={() => handleAssignResident(selectedApartment)}>
                <FontAwesomeIcon icon={faUserEdit} />
              </button>
            </div>
          </div>
        )}
        
        {viewMode === 'edit' && (
          <div className="apartment-edit-view">
            <div className="section-header">
              <button className="back-btn" onClick={backToList}>Hủy</button>
              <h2>{selectedApartment ? 'Sửa thông tin căn hộ' : 'Thêm căn hộ mới'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="apartment-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Mã căn hộ *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="buildingId">Tòa nhà *</label>
                  <select
                    id="buildingId"
                    name="buildingId"
                    value={formData.buildingId}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Chọn tòa nhà</option>
                    {buildings.map(building => (
                      <option key={building.id} value={building.id}>{building.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="floor">Tầng *</label>
                  <select
                    id="floor"
                    name="floor"
                    value={formData.floor}
                    onChange={handleFormChange}
                    required
                    disabled={!formData.buildingId || maxFloor === 0}
                  >
                    <option value="">Chọn tầng</option>
                    {Array.from({ length: maxFloor }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="rooms">Số phòng *</label>
                  <input
                    type="number"
                    id="rooms"
                    name="rooms"
                    value={formData.rooms}
                    onChange={handleFormChange}
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="area">Diện tích (m²) *</label>
                <input
                  type="number"
                  id="area"
                  name="area"
                  value={formData.area}
                  onChange={handleFormChange}
                  min="1"
                  required
                />
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  {selectedApartment ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {viewMode === 'assign' && selectedApartment && (
          <div className="apartment-assign-view">
            <div className="section-header">
              <button className="back-btn" onClick={backToList}>Hủy</button>
              <h2>{selectedApartment.customerId ? 'Thay đổi cư dân' : 'Gán cư dân vào căn hộ'}</h2>
            </div>
            
            <div className="apartment-summary">
              <p><strong>Căn hộ:</strong> {selectedApartment.name}</p>
              <p><strong>Tòa nhà:</strong> {getBuildingName(selectedApartment.buildingId)}</p>
              <p><strong>Hiện tại:</strong> {getResidentName(selectedApartment.customerId)}</p>
            </div>
            
            <form onSubmit={handleAssignSubmit} className="assign-form">
              <div className="form-group">
                <label htmlFor="customerId">Chọn cư dân</label>
                <select
                  id="customerId"
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleFormChange}
                >
                  <option value="">Căn hộ trống</option>
                  {residents.map(resident => (
                    <option key={resident.id} value={resident.id}>
                      {resident.name} - {resident.phone}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  {selectedApartment.customerId ? 'Cập nhật cư dân' : 'Gán cư dân'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default ApartmentManagement;