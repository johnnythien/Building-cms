import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import callApi from '../../../apis/handleApi';
import { useAuth } from '../../../context/AuthContext';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const VoteForm = () => {
  const basePath = useMediaConsultingPath();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // State cho danh sách tòa nhà
  const [buildings, setBuildings] = useState([]);

  // State chính của form
  const [vote, setVote] = useState({
    Title: '',
    StartDate: '',
    EndDate: '',
    CreatedBy: user?.fullName || user?.email || '',
    buildingId: '' // Mặc định là chuỗi rỗng
  });

  // State cho chế độ Demo
  const [isDemo, setIsDemo] = useState(false);
  const [demoData, setDemoData] = useState({
    agree: 0,
    disagree: 0
  });

  useEffect(() => {
    fetchBuildings(); 
    if (id) {
      fetchVote();
    }
  }, [id]);

  // Gọi API lấy danh sách tòa nhà
  const fetchBuildings = async () => {
    try {
      const res = await callApi('/buildings'); 
      // Log để kiểm tra backend trả về Id hoa hay thường
      console.log("Buildings loaded:", res); 
      setBuildings(res || []);
    } catch (error) {
      console.error("Lỗi lấy danh sách tòa nhà:", error);
    }
  };

  const fetchVote = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/votes/${id}`);
      setVote({
        Title: response.Title || '',
        StartDate: response.StartDate ? new Date(response.StartDate).toISOString().split('T')[0] : '',
        EndDate: response.EndDate ? new Date(response.EndDate).toISOString().split('T')[0] : '',
        CreatedBy: response.CreatedBy || user?.fullName || user?.email || '',
        buildingId: response.buildingId || '' // Bind dữ liệu cũ nếu có
      });
    } catch (error) {
      console.error('Error fetching vote:', error);
      toast.error('Không tìm thấy biểu quyết');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Log để xem khi chọn tòa nhà, value có nhận được ID (ví dụ 301) không
    if(name === 'buildingId') console.log("Selected Building ID:", value);
    
    setVote(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation cơ bản
    if (!vote.Title.trim()) {
      toast.error('Vui lòng nhập tiêu đề biểu quyết');
      return;
    }
    
    if (!vote.StartDate || !vote.EndDate) {
      toast.error('Vui lòng nhập đầy đủ ngày bắt đầu và ngày kết thúc');
      return;
    }
    
    if (new Date(vote.StartDate) > new Date(vote.EndDate)) {
      toast.error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
      return;
    }
    // Ép kiểu sang số nguyên nếu có giá trị, nếu rỗng thì là null
    const finalBuildingId = (vote.buildingId && vote.buildingId !== "") 
                            ? parseInt(vote.buildingId, 10) 
                            : null;
    const payload = {
        ...vote,
        CreatedById: user?.Id || user?.id, 
        buildingId: finalBuildingId, 
        isDemo: !id && isDemo, 
        demoData: (!id && isDemo) ? demoData : null
    };
    
    console.log("PAYLOAD GỬI ĐI:", payload); 

    try {
      setLoading(true);
      if (id) {
        await callApi(`/votes/${id}`, payload, 'put');
        toast.success('Cập nhật biểu quyết thành công!');
      } else {
        await callApi('/votes', payload, 'post');
        toast.success('Tạo biểu quyết và dữ liệu mẫu thành công!');
      }
      navigate(`${basePath}/votes`);
    } catch (error) {
      console.error('Error saving vote:', error);
      toast.error('Không thể lưu biểu quyết: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) {
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
          <h3 className="card-title mb-0">
            <i className="fas fa-vote-yea me-2"></i>
            {id ? 'Cập nhật Biểu quyết' : 'Tạo Biểu quyết Mới'}
          </h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            
            {/* 1. Tiêu đề */}
            <div className="mb-3">
              <label className="form-label fw-bold">Tiêu đề biểu quyết <span className="text-danger">*</span></label>
              <input
                type="text"
                name="Title"
                className="form-control"
                placeholder="Nhập tiêu đề biểu quyết"
                value={vote.Title}
                onChange={handleChange}
                required
              />
            </div>

            {/* 2. Phạm vi áp dụng (ĐÃ SỬA LẠI ĐỂ NHẬN DIỆN ID TỐT HƠN) */}
            <div className="mb-3">
                <label className="form-label fw-bold">Phạm vi áp dụng</label>
                <select 
                    name="buildingId" 
                    className="form-select"
                    value={vote.buildingId}
                    onChange={handleChange}
                >
                    <option value="">-- Toàn bộ khu dân cư --</option>
                    {buildings.map(b => (
                        // Sử dụng b.Id || b.id để tránh lỗi uppercase/lowercase từ API
                        <option key={b.Id || b.id} value={b.Id || b.id}>
                            {b.name || b.Name}
                        </option>
                    ))}
                </select>
                <small className="text-muted">
                    {vote.buildingId ? `Đang chọn ID tòa nhà: ${vote.buildingId}` : "Đang chọn: Toàn bộ (Null)"}
                </small>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">Ngày bắt đầu <span className="text-danger">*</span></label>
                <input
                  type="date"
                  name="StartDate"
                  className="form-control"
                  value={vote.StartDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">Ngày kết thúc <span className="text-danger">*</span></label>
                <input
                  type="date"
                  name="EndDate"
                  className="form-control"
                  value={vote.EndDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Người tạo</label>
              <input
                type="text"
                name="CreatedBy"
                className="form-control bg-light"
                value={vote.CreatedBy}
                readOnly
              />
            </div>

            {/* 3. Khu vực Demo Data (Chỉ hiện khi Tạo mới) */}
            {!id && (
                <div className="card bg-light border-dashed mb-4">
                    <div className="card-body">
                        <div className="form-check form-switch mb-3">
                            <input 
                                className="form-check-input" 
                                type="checkbox" 
                                id="demoSwitch"
                                checked={isDemo}
                                onChange={(e) => setIsDemo(e.target.checked)}
                            />
                            <label className="form-check-label fw-bold text-primary" htmlFor="demoSwitch">
                                <i className="fas fa-magic me-2"></i>
                                Chế độ Demo (Tạo sẵn kết quả giả lập)
                            </label>
                        </div>

                        {isDemo && (
                            <div className="row animate__animated animate__fadeIn">
                                <div className="col-md-6">
                                    <label className="form-label">Số phiếu Đồng ý:</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="form-control"
                                        value={demoData.agree}
                                        onChange={(e) => setDemoData({...demoData, agree: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Số phiếu Không đồng ý:</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="form-control"
                                        value={demoData.disagree}
                                        onChange={(e) => setDemoData({...demoData, disagree: e.target.value})}
                                    />
                                </div>
                                <div className="col-12 mt-2">
                                    <small className="text-danger fst-italic">
                                        * Lưu ý: Tổng số phiếu không nên vượt quá số lượng cư dân của tòa nhà.
                                    </small>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              <Link to={`${basePath}/votes`} className="btn btn-secondary">
                <i className="fas fa-times me-1"></i> Hủy
              </Link>
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-1"></i>
                    {id ? 'Cập nhật' : 'Tạo & Giả lập'}
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

export default VoteForm;