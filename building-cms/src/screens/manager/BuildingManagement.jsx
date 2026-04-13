import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './BuildingManagement.css';

const BuildingManagement = () => {
  const { currentUser, logout } = useAuth();
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [buildingApartments, setBuildingApartments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', 'edit'
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    floors: '',
    totalApartments: '',
    constructionYear: '',
    status: 'active'
  });
  const [error, setError] = useState('');

  // Thêm phân trang
  const {
    currentItems: paginatedBuildings,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(buildings);

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    setLoading(true);
    try {
      const response = await callApi('/buildings');
      setBuildings(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
      console.error('Error fetching buildings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildingDetails = async (buildingId) => {
    setLoading(true);
    try {
      // Tải thông tin căn hộ trong tòa nhà
      const [allApartments, allCustomers] = await Promise.all([
        callApi('/apartments'),
        callApi('/customers')
      ]);
      
      // Lọc căn hộ thuộc tòa nhà dựa vào buildingId
      const buildingApts = allApartments.filter(apt => 
        // Chuyển buildingId về cùng kiểu để so sánh
        String(apt.buildingId) === String(buildingId)
      );
      setBuildingApartments(buildingApts);
      
      // Lọc ra những cư dân đang sống trong tòa nhà này
      const buildingResidents = allCustomers.filter(customer => 
        buildingApts.some(apt => apt.customerId === customer.id)
      );
      setResidents(buildingResidents);
      
      setError('');
    } catch (err) {
      setError('Không thể tải chi tiết tòa nhà. Vui lòng thử lại sau.');
      console.error('Error fetching building details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBuilding = async (building) => {
    setSelectedBuilding(building);
    await fetchBuildingDetails(building.id);
    setViewMode('detail');
  };

  const handleEditBuilding = (building) => {
    setSelectedBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      floors: building.floors,
      totalApartments: building.totalApartments,
      constructionYear: building.constructionYear,
      status: building.status
    });
    setViewMode('edit');
  };

  const handleAddBuilding = () => {
    setSelectedBuilding(null);
    setFormData({
      name: '',
      address: '',
      floors: '',
      totalApartments: '',
      constructionYear: new Date().getFullYear(),
      status: 'active'
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
    if (!formData.name || !formData.address || !formData.floors || !formData.totalApartments) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    
    try {
      const apiMethod = selectedBuilding ? 'put' : 'post';
      const endpoint = selectedBuilding 
        ? `/buildings/${selectedBuilding.id}` 
        : '/buildings';
      
      const response = await callApi(endpoint, formData, apiMethod);
      
      if (response) {
        // Cập nhật danh sách
        await fetchBuildings();
        setViewMode('list');
        setError('');
        
        // Hiển thị thông báo thành công
        alert(selectedBuilding ? 'Cập nhật tòa nhà thành công' : 'Thêm tòa nhà mới thành công');
      }
    } catch (err) {
      setError('Không thể lưu dữ liệu. Vui lòng thử lại sau.');
      console.error('Error saving building:', err);
    }
  };

  const handleDeleteBuilding = async (buildingId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tòa nhà này?')) return;
    
    try {
      await callApi(`/buildings/${buildingId}`, null, 'delete');
      
      // Cập nhật danh sách
      await fetchBuildings();
      setViewMode('list');
      
      // Hiển thị thông báo thành công
      alert('Xóa tòa nhà thành công');
    } catch (err) {
      setError('Không thể xóa tòa nhà. Vui lòng thử lại sau.');
      console.error('Error deleting building:', err);
    }
  };
  
  const getApartmentStatusClass = (apartment) => {
    return apartment.customerId ? 'occupied' : 'vacant';
  };

  const getApartmentOccupant = (apartmentId) => {
    const apartment = buildingApartments.find(apt => apt.id === apartmentId);
    if (!apartment || !apartment.customerId) return 'Trống';
    
    const resident = residents.find(r => r.id === apartment.customerId);
    return resident ? resident.name : 'Không xác định';
  };

  const backToList = () => {
    setSelectedBuilding(null);
    setBuildingApartments([]);
    setResidents([]);
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
      <div className="building-management">
        <PageHeader 
          title="Quản lý tòa nhà" 
          buttonText="Thêm tòa nhà mới"
          onButtonClick={handleAddBuilding}
        />

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {viewMode === 'list' && (
          <div className="data-table-container">
            <div className="data-table-header">
              <h5 className="mb-0">Danh sách tòa nhà</h5>
            </div>
            <div className="table-responsive">
              <table className="data-table table align-middle">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tên tòa nhà</th>
                    <th>Địa chỉ</th>
                    <th>Số tầng</th>
                    <th>Số căn hộ</th>
                    <th>Năm xây dựng</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBuildings.length > 0 ? (
                    paginatedBuildings.map((building, index) => (
                      <tr key={building.id}>
                        <td>{(currentPage - 1) * 10 + index + 1}</td>
                        <td>{building.name}</td>
                        <td>{building.address}</td>
                        <td>{building.floors}</td>
                        <td>{building.totalApartments}</td>
                        <td>{building.constructionYear}</td>
                        <td>{building.status === 'active' ? 'Đang hoạt động' : 'Đã đóng cửa'}</td>
                        <td>
                          <button className="view-btn" onClick={() => handleViewBuilding(building)}>
                            Xem chi tiết
                          </button>
                          <button className="edit-btn" onClick={() => handleEditBuilding(building)}>
                            Sửa
                          </button>
                          <button className="delete-btn" onClick={() => handleDeleteBuilding(building.id)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        <div className="empty-state-icon">🏢</div>
                        <div className="empty-state-title">Chưa có tòa nhà nào</div>
                        <div>Thêm tòa nhà mới để bắt đầu quản lý</div>
                        <button
                          className="btn btn-sm btn-primary mt-3"
                          onClick={() => setViewMode('edit')}
                        >
                          Thêm tòa nhà mới
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Thêm phân trang */}
            {buildings.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
              />
            )}
          </div>
        )}
        
        {viewMode === 'detail' && selectedBuilding && (
          <div className="building-detail-view">
            <div className="section-header">
              <button className="back-btn" onClick={backToList}>Quay lại danh sách</button>
              <h2>Chi tiết tòa nhà: {selectedBuilding.name}</h2>
            </div>
            
            <div className="building-info">
              <div className="info-card">
                <h3>Thông tin chung</h3>
                <p><strong>Địa chỉ:</strong> {selectedBuilding.address}</p>
                <p><strong>Số tầng:</strong> {selectedBuilding.floors}</p>
                <p><strong>Tổng số căn hộ:</strong> {selectedBuilding.totalApartments}</p>
                <p><strong>Năm xây dựng:</strong> {selectedBuilding.constructionYear}</p>
                <p>
                  <strong>Trạng thái:</strong> 
                  <span className={`status-badge ${selectedBuilding.status}`}>
                    {selectedBuilding.status === 'active' ? 'Đang hoạt động' : 'Đã đóng cửa'}
                  </span>
                </p>
              </div>
              
              <div className="info-card">
                <h3>Thống kê</h3>
                <p><strong>Tổng số căn hộ:</strong> {buildingApartments.length}</p>
                <p>
                  <strong>Đã có người ở:</strong> 
                  {buildingApartments.filter(apt => apt.customerId).length}
                </p>
                <p>
                  <strong>Còn trống:</strong> 
                  {buildingApartments.filter(apt => !apt.customerId).length}
                </p>
                <p><strong>Tổng số cư dân:</strong> {residents.length}</p>
              </div>
            </div>
            
            <div className="building-apartments">
              <h3>Danh sách căn hộ</h3>
              
              <div className="apartments-list">
                <div className="apartment-header">
                  <span className="apartment-name">Mã căn hộ</span>
                  <span className="apartment-floor">Tầng</span>
                  <span className="apartment-area">Diện tích (m²)</span>
                  <span className="apartment-rooms">Số phòng</span>
                  <span className="apartment-status">Trạng thái</span>
                  <span className="apartment-occupant">Người ở</span>
                </div>
                
                {buildingApartments.length > 0 ? (
                  buildingApartments.map(apartment => (
                    <div key={apartment.id} className="apartment-item">
                      <span className="apartment-name">{apartment.name}</span>
                      <span className="apartment-floor">{apartment.floor}</span>
                      <span className="apartment-area">{apartment.area} m²</span>
                      <span className="apartment-rooms">{apartment.rooms}</span>
                      <span className={`apartment-status ${getApartmentStatusClass(apartment)}`}>
                        {apartment.customerId ? 'Đã có người ở' : 'Trống'}
                      </span>
                      <span className="apartment-occupant">
                        {getApartmentOccupant(apartment.id)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="no-data">Không có căn hộ nào trong tòa nhà này</div>
                )}
              </div>
            </div>
            
            <div className="building-residents">
              <h3>Danh sách cư dân</h3>
              
              <div className="residents-list">
                <div className="resident-header">
                  <span className="resident-name">Họ tên</span>
                  <span className="resident-email">Email</span>
                  <span className="resident-phone">Số điện thoại</span>
                  <span className="resident-address">Địa chỉ</span>
                </div>
                
                {residents.length > 0 ? (
                  residents.map(resident => (
                    <div key={resident.id} className="resident-item">
                      <span className="resident-name">{resident.name}</span>
                      <span className="resident-email">{resident.email}</span>
                      <span className="resident-phone">{resident.phone}</span>
                      <span className="resident-address">{resident.address}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-data">Không có cư dân nào trong tòa nhà này</div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {viewMode === 'edit' && (
          <div className="building-edit-view">
            <div className="section-header">
              <button className="back-btn" onClick={backToList}>Hủy</button>
              <h2>{selectedBuilding ? 'Sửa thông tin tòa nhà' : 'Thêm tòa nhà mới'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="building-form">
              <div className="form-group">
                <label htmlFor="name">Tên tòa nhà *</label>
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
                <label htmlFor="address">Địa chỉ *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="floors">Số tầng *</label>
                  <input
                    type="number"
                    id="floors"
                    name="floors"
                    value={formData.floors}
                    onChange={handleFormChange}
                    min="1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="totalApartments">Tổng số căn hộ *</label>
                  <input
                    type="number"
                    id="totalApartments"
                    name="totalApartments"
                    value={formData.totalApartments}
                    onChange={handleFormChange}
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="constructionYear">Năm xây dựng</label>
                  <input
                    type="number"
                    id="constructionYear"
                    name="constructionYear"
                    value={formData.constructionYear}
                    onChange={handleFormChange}
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="status">Trạng thái</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Đã đóng cửa</option>
                  </select>
                </div>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  {selectedBuilding ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default BuildingManagement;