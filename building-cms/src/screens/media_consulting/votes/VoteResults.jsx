import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import callApi from '../../../apis/handleApi';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import * as XLSX from 'xlsx';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const VoteResults = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const [vote, setVote] = useState(null);
  const [voteResults, setVoteResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVote();
    fetchVoteResults();
  }, [id]);

  const fetchVote = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/votes/${id}`);
      setVote(response);
    } catch (error) {
      console.error('Error fetching vote:', error);
      toast.error('Không tìm thấy biểu quyết');
    } finally {
      setLoading(false);
    }
  };

  const fetchVoteResults = async () => {
    try {
      const response = await callApi('/vote-results');
      const results = Array.isArray(response) ? response : [];
      setVoteResults(results.filter(r => r.VoteId === parseInt(id)));
    } catch (error) {
      console.error('Error fetching vote results:', error);
      setVoteResults([]);
    }
  };

  const aggregateResults = () => {
    const choiceCount = {};
    voteResults.forEach(result => {
      const choice = result.choice || 'Không có lựa chọn';
      choiceCount[choice] = (choiceCount[choice] || 0) + 1;
    });
    return choiceCount;
  };

  // --- CẬP NHẬT LOGIC XUẤT EXCEL TẠI ĐÂY ---
  const handleExportExcel = () => {
    const data = voteResults.map((result, index) => {
      
      // 1. Áp dụng logic xác định tên giống hệt như hiển thị trên bảng
      let displayName = "Ẩn danh";
      let role = "Không rõ";

      if (result.userName) {
        displayName = result.userName;
        role = "Ban quản lý";
      } else if (result.residentName) {
        displayName = result.residentName;
        role = "Cư dân";
      } else {
        displayName = `Cư dân ẩn danh #${index + 1}`;
        role = "Dữ liệu mô phỏng";
      }

      // 2. Trả về object dữ liệu cho Excel (Thay ID bằng Tên thật)
      return {
        'STT': index + 1,
        'Người bỏ phiếu': displayName, // Hiển thị tên thay vì ID N/A
        'Vai trò': role,               // Thêm cột vai trò cho rõ ràng
        'Lựa chọn': result.choice || 'Không có',
        'Thời gian': result.createdAt ? new Date(result.createdAt).toLocaleString('vi-VN') : 'N/A'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Tự động điều chỉnh độ rộng cột (Optional)
    const wscols = [
        { wch: 5 },  // STT
        { wch: 25 }, // Tên
        { wch: 15 }, // Vai trò
        { wch: 20 }, // Lựa chọn
        { wch: 20 }  // Thời gian
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, 'Kết quả biểu quyết');
    XLSX.writeFile(wb, `KetQuaBieuQuyet_${vote?.Title || 'Export'}.xlsx`);
    toast.success('Đã xuất file Excel thành công!');
  };
  // -------------------------------------------

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!vote) {
    return (
      <div className="alert alert-warning">
        Không tìm thấy biểu quyết
      </div>
    );
  }

  const aggregatedData = aggregateResults();
  const choices = Object.keys(aggregatedData);
  const counts = Object.values(aggregatedData);

  const pieData = {
    labels: choices.length > 0 ? choices : ['Chưa có dữ liệu'],
    datasets: [{
      data: counts.length > 0 ? counts : [0],
      backgroundColor: [
        '#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14'
      ]
    }]
  };

  const barData = {
    labels: choices.length > 0 ? choices : ['Chưa có dữ liệu'],
    datasets: [{
      label: 'Số phiếu',
      data: counts.length > 0 ? counts : [0],
      backgroundColor: '#007bff'
    }]
  };

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            Kết quả Biểu quyết: <span className="text-white">{vote.Title}</span>
          </h4>
          <div>
            <button className="btn btn-light btn-sm me-2" onClick={handleExportExcel}>
              <i className="fas fa-file-excel me-1"></i> Xuất Excel
            </button>
            <Link to={`${basePath}/votes`} className="btn btn-secondary btn-sm">
              <i className="fas fa-arrow-left me-1"></i> Quay lại
            </Link>
          </div>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card text-center border-primary">
                <div className="card-body">
                  <h5 className="card-title text-primary">Tổng số phiếu</h5>
                  <h2>{voteResults.length}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card text-center border-success">
                <div className="card-body">
                  <h5 className="card-title text-success">Số người tham gia</h5>
                  <h2>{vote ? vote.totalEligible : 0}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card text-center border-info">
                <div className="card-body">
                  <h5 className="card-title text-info">Số lựa chọn</h5>
                  <h2>{choices.length}</h2>
                </div>
              </div>
            </div>
          </div>

          {voteResults.length === 0 ? (
            <div className="alert alert-info text-center">
              <h5>Chưa có kết quả biểu quyết</h5>
              <p>Chưa có ai tham gia biểu quyết này.</p>
            </div>
          ) : (
            <>
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-primary text-white">
                      <h5 className="mb-0">Biểu đồ tròn</h5>
                    </div>
                    <div className="card-body">
                      <div style={{ height: '300px' }}>
                        <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-success text-white">
                      <h5 className="mb-0">Biểu đồ cột</h5>
                    </div>
                    <div className="card-body">
                      <div style={{ height: '300px' }}>
                        <Bar data={barData} options={{ maintainAspectRatio: false }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card mt-3">
                <div className="card-header">
                  <h5 className="mb-0">Danh sách phiếu bầu</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th colSpan="2">Người bỏ phiếu</th>
                          <th>Lựa chọn</th>
                          <th>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {voteResults.map((result, index) => {
                          let displayName = "Ẩn danh";
                          let role = "";

                          if (result.userName) {
                            displayName = result.userName;
                            role = "(Ban quản lý)";
                          } else if (result.residentName) {
                            displayName = result.residentName;
                            role = "(Cư dân)";
                          } else {
                            displayName = `Cư dân ẩn danh #${index + 1}`;
                          }
                          return (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td colSpan="2">
                                <strong>{displayName}</strong> <br />
                                <small className="text-muted" style={{ fontSize: '0.8em' }}>{role}</small>
                              </td>
                              <td>
                                <span className={`badge ${result.choice === 'Đồng ý' ? 'bg-success' : 'bg-danger'}`}>
                                  {result.choice || 'Không có'}
                                </span>
                              </td>
                              <td>{result.createdAt ? new Date(result.createdAt).toLocaleString('vi-VN') : 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteResults;