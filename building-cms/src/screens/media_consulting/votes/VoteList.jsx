import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVoteYea, faPlus, faFileExcel, faEye, faEdit, faTrash, faChartBar } from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';
import '../MediaConsulting.css';

export function VoteList() {
  const basePath = useMediaConsultingPath();
  const [votes, setVotes] = useState([]);
  const [voteResults, setVoteResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voteIdToEdit, setVoteIdToEdit] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [creator, setCreator] = useState('');
  const [sortField, setSortField] = useState('StartDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedVotes, setSelectedVotes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();
  const now = new Date();

  useEffect(() => {
    fetchVotes();
    fetchVoteResults();
  }, []);

  const fetchVotes = async () => {
    try {
      setLoading(true);
      const response = await callApi('/votes');
      setVotes(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching votes:', error);
      toast.error('Không thể tải danh sách biểu quyết');
      setVotes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoteResults = async () => {
    try {
      const response = await callApi('/vote-results');
      setVoteResults(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching vote results:', error);
      setVoteResults([]);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa biểu quyết này không?');
    if (confirmDelete) {
      try {
        await callApi(`/votes/${id}`, null, 'delete');
        setVotes(prev => prev.filter(v => v.Id !== id));
        toast.success('Xóa biểu quyết thành công!');
      } catch (error) {
        console.error('Error deleting vote:', error);
        toast.error('Không thể xóa biểu quyết');
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedVotes.length === 0) return;
    const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa các biểu quyết đã chọn?');
    if (confirmDelete) {
      try {
        await Promise.all(selectedVotes.map(id => callApi(`/votes/${id}`, null, 'delete')));
        setVotes(prev => prev.filter(v => !selectedVotes.includes(v.Id)));
        setSelectedVotes([]);
        toast.success('Đã xóa các biểu quyết đã chọn!');
      } catch (error) {
        console.error('Error bulk deleting votes:', error);
        toast.error('Không thể xóa một số biểu quyết');
      }
    }
  };

  const handleSelect = (id) => {
    setSelectedVotes(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedVotes(paginatedVotes.map(v => v.Id));
    } else {
      setSelectedVotes([]);
    }
  };

  const handleExportExcel = () => {
    const data = filteredVotes.map(vote => {
      const participantCount = vote.totalEligible || 0;
      return {
        'Tiêu đề': vote.Title,
        'Ngày bắt đầu': vote.StartDate,
        'Ngày kết thúc': vote.EndDate,
        'Trạng thái':
          new Date(vote.StartDate) <= now && now <= new Date(vote.EndDate)
            ? 'Đang diễn ra'
            : new Date(vote.EndDate) < now
            ? 'Đã kết thúc'
            : 'Sắp diễn ra',
        'Người tạo': vote.CreatedBy || '',
        'Số người tham gia': participantCount,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Biểu quyết');
    XLSX.writeFile(wb, 'danh_sach_bieu_quyet.xlsx');
    toast.success('Xuất Excel thành công!');
  };

  const filteredVotes = votes
    .filter(vote => vote.Title?.toLowerCase().includes(search.toLowerCase()))
    .filter(vote => filterStatus === 'all' ? true :
      filterStatus === 'active' ? new Date(vote.StartDate) <= now && now <= new Date(vote.EndDate) :
      filterStatus === 'inactive' ? new Date(vote.EndDate) < now :
      new Date(vote.StartDate) > now)
    .filter(vote => creator ? (vote.CreatedBy || '').toLowerCase().includes(creator.toLowerCase()) : true)
    .sort((a, b) => {
      if (sortOrder === 'asc') return new Date(a[sortField]) - new Date(b[sortField]);
      return new Date(b[sortField]) - new Date(a[sortField]);
    });

  const totalPages = Math.ceil(filteredVotes.length / pageSize);
  const paginatedVotes = filteredVotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const ongoingVotes = votes.filter(vote =>
    new Date(vote.StartDate) <= now && now <= new Date(vote.EndDate)
  );

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
    <div className="mc-news-list-container mc-fade-in">
      {/* Page Header */}
      <div className="mc-page-header">
        <h1 className="mc-page-title" style={{margin: 0, color: '#2a3f54', fontSize: '1.75rem', fontWeight: 600}}>
          Danh sách Biểu quyết
        </h1>
        <div className="mc-btn-group">
          <button className="mc-btn mc-btn-success" onClick={() => navigate(`${basePath}/votes/create`)}>
            <FontAwesomeIcon icon={faPlus} />
            Tạo mới
          </button>
          <button className="mc-btn mc-btn-info" onClick={handleExportExcel}>
            <FontAwesomeIcon icon={faFileExcel} />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="mc-filter-section">
        <div className="mc-filter-row">
          <input
            type="text"
            className="mc-form-control"
            placeholder="Tìm kiếm theo tiêu đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="mc-form-select"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang diễn ra</option>
            <option value="inactive">Đã kết thúc</option>
            <option value="upcoming">Sắp diễn ra</option>
          </select>
          <input
            type="text"
            className="mc-form-control"
            placeholder="Tìm theo người tạo..."
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
          />
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortField(field);
              setSortOrder(order);
            }}
            className="mc-form-select"
          >
            <option value="StartDate-desc">Ngày bắt đầu (Mới nhất)</option>
            <option value="StartDate-asc">Ngày bắt đầu (Cũ nhất)</option>
            <option value="EndDate-desc">Ngày kết thúc (Mới nhất)</option>
            <option value="EndDate-asc">Ngày kết thúc (Cũ nhất)</option>
          </select>
        </div>
        <div className="mt-3 d-flex align-items-center gap-3">
          <label style={{ margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedVotes.length === paginatedVotes.length && paginatedVotes.length > 0}
              onChange={handleSelectAll}
              className="me-2"
            />
            Chọn tất cả
          </label>
          {selectedVotes.length > 0 && (
            <button className="mc-btn mc-btn-danger mc-btn-sm" onClick={handleDeleteSelected}>
              <FontAwesomeIcon icon={faTrash} />
              Xóa {selectedVotes.length} biểu quyết
            </button>
          )}
        </div>
      </div>

      {filteredVotes.length === 0 ? (
        <div className="mc-empty-container">
          <div className="mc-empty-icon">
            <FontAwesomeIcon icon={faVoteYea} />
          </div>
          <div className="mc-empty-title">Chưa có biểu quyết nào</div>
          <div className="mc-empty-text">Chưa có biểu quyết phù hợp với bộ lọc của bạn</div>
        </div>
      ) : (
        <div className="mc-data-card">
          <div className="mc-table-wrapper">
            <table className="mc-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Tiêu đề</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc</th>
                  <th>Trạng thái</th>
                  <th>Người tạo</th>
                  <th>Số người tham gia</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVotes.map((vote) => {
                  const participantCount = vote.totalEligible || 0;
                  const isActive = new Date(vote.StartDate) <= now && now <= new Date(vote.EndDate);
                  const isEnded = new Date(vote.EndDate) < now;
                  return (
                    <tr key={vote.Id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedVotes.includes(vote.Id)}
                          onChange={() => handleSelect(vote.Id)}
                        />
                      </td>
                      <td><strong>{vote.Title}</strong></td>
                      <td>{new Date(vote.StartDate).toLocaleDateString('vi-VN')}</td>
                      <td>{new Date(vote.EndDate).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span className={`mc-badge ${
                          isActive ? 'mc-badge-approved' : isEnded ? 'mc-badge-resolved' : 'mc-badge-pending'
                        }`}>
                          {isActive ? 'Đang diễn ra' : isEnded ? 'Đã kết thúc' : 'Sắp diễn ra'}
                        </span>
                      </td>
                      <td>{vote.CreatedBy || 'Không rõ'}</td>
                      <td><strong>{participantCount}</strong></td>
                      <td>
                        <div className="mc-action-buttons">
                          <Link to={`${basePath}/votes/${vote.Id}`} className="mc-btn-icon mc-btn-icon-view" title="Xem">
                            <FontAwesomeIcon icon={faEye} />
                          </Link>
                          <Link to={`${basePath}/votes/edit/${vote.Id}`} className="mc-btn-icon mc-btn-icon-edit" title="Sửa">
                            <FontAwesomeIcon icon={faEdit} />
                          </Link>
                          <Link to={`${basePath}/votes/results/${vote.Id}`} className="mc-btn-icon mc-btn-icon-approve" title="Kết quả">
                            <FontAwesomeIcon icon={faChartBar} />
                          </Link>
                          <button onClick={() => handleDelete(vote.Id)} className="mc-btn-icon mc-btn-icon-delete" title="Xóa">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-3" style={{ borderTop: '1px solid #f3f4f6' }}>
              <nav>
                <ul className="pagination justify-content-center mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>
                      Trước
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                      <button className="page-link" onClick={() => setCurrentPage(page)}>
                        {page}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>
                      Sau
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VoteList;

