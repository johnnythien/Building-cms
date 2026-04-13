import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import callApi from '../apis/handleApi';
import PageHeader from '../components/layout/PageHeader';
import ReAuthModal from '../components/auth/ReAuthModal';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './MySalary.css';

const MySalary = () => {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [requiresReAuth, setRequiresReAuth] = useState(true);
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);

  const parseDetailList = (value) => {
    if (!value) return [];
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && (item.label || item.amount));
      }
      return [];
    } catch (err) {
      console.warn('[MySalary] detail parse error:', err.message);
      return [];
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleString('vi-VN');
    } catch (err) {
      return dateString;
    }
  };

  const openDetailModal = (salary) => {
    setSelectedSalary({
      ...salary,
      allowanceItems: parseDetailList(salary.allowanceDetails),
      deductionItems: parseDetailList(salary.deductionDetails),
    });
    const modal = document.getElementById('salaryDetailModal');
    if (modal) {
      modal.showModal?.();
    }
  };

  const closeDetailModal = () => {
    const modal = document.getElementById('salaryDetailModal');
    if (modal) {
      modal.close?.();
    }
    setSelectedSalary(null);
  };

  // Kiểm tra xác thực lại khi component mount hoặc user thay đổi
  useEffect(() => {
    if (user) {
      const userId = user.id || user.Id;
      if (!userId) {
        console.warn('[MySalary] User ID not found, requiring re-authentication');
        setRequiresReAuth(true);
        setIsReAuthModalOpen(true);
        return;
      }

      // Key timestamp riêng cho từng user
      const timestampKey = `salaryReAuthTimestamp_${userId}`;
      
      // Kiểm tra xem có phải đang redirect từ login page không
      const urlParams = new URLSearchParams(window.location.search);
      const fromLogin = urlParams.get('fromLogin') === 'true';
      
      // Nếu đang redirect từ login, lưu timestamp ngay để không cần xác thực lại
      if (fromLogin) {
        const timestamp = Date.now().toString();
        sessionStorage.setItem(timestampKey, timestamp);
        console.log('[MySalary] Redirected from login, timestamp saved for user:', userId, timestamp);
        // Xóa query param để tránh lặp lại
        window.history.replaceState({}, '', window.location.pathname);
        setRequiresReAuth(false);
        setIsReAuthModalOpen(false);
        return;
      }
      
      // Kiểm tra xem đã xác thực lại trong session này chưa (cho user hiện tại)
      const reAuthTimestamp = sessionStorage.getItem(timestampKey);
      const now = Date.now();
      const RE_AUTH_DURATION = 15 * 60 * 1000; // 15 phút
      
      if (reAuthTimestamp) {
        const timestamp = parseInt(reAuthTimestamp);
        const timeDiff = now - timestamp;
        
        if (timeDiff < RE_AUTH_DURATION && timeDiff >= 0) {
          // Đã xác thực trong vòng 15 phút, không cần xác thực lại
          console.log('[MySalary] Re-auth still valid for user', userId, ', time remaining:', Math.floor((RE_AUTH_DURATION - timeDiff) / 1000 / 60), 'minutes');
          setRequiresReAuth(false);
          setIsReAuthModalOpen(false);
          // Không fetch ngay ở đây, để useEffect khác xử lý
        } else {
          // Timestamp hết hạn hoặc không hợp lệ, cần xác thực lại
          console.log('[MySalary] Re-auth expired or invalid for user', userId, ', requiring re-authentication');
          sessionStorage.removeItem(timestampKey);
          setRequiresReAuth(true);
          setIsReAuthModalOpen(true);
        }
      } else {
        // Chưa có timestamp cho user này, cần xác thực lại
        console.log('[MySalary] No re-auth timestamp found for user', userId, ', requiring re-authentication');
        setRequiresReAuth(true);
        setIsReAuthModalOpen(true);
      }
    } else {
      // Không có user, reset state
      setRequiresReAuth(true);
      setIsReAuthModalOpen(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch salaries khi đã xác thực và thay đổi filter
  useEffect(() => {
    if (user && !requiresReAuth) {
      fetchMySalaries();
    }
  }, [user, selectedYear, selectedMonth, requiresReAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMySalaries = async () => {
    setLoading(true);
    try {
      // Sử dụng endpoint mới /salaries/me để lấy lương của user hiện tại
      console.log('[MySalary] Fetching salaries for current user, month:', selectedMonth, 'year:', selectedYear);
      const response = await callApi(`/salaries/me`);
      console.log('[MySalary] Received salaries:', response);
      
      // Lọc theo tháng/năm nếu có
      let filteredSalaries = Array.isArray(response) ? response : [];
      if (selectedMonth && selectedYear) {
        filteredSalaries = filteredSalaries.filter(salary => 
          salary.month === selectedMonth && salary.year === selectedYear
        );
      }
      
      setSalaries(filteredSalaries);
      setError('');
    } catch (err) {
      setError('Không thể tải danh sách lương. Vui lòng thử lại sau.');
      console.error('[MySalary] Error fetching salaries:', err);
      console.error('[MySalary] Error details:', {
        message: err.message,
        response: err.response,
        data: err.response?.data
      });
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (salaryId, newStatus) => {
    if (!window.confirm(`Bạn có chắc chắn muốn cập nhật trạng thái thành "${getStatusLabel(newStatus)}"?`)) {
      return;
    }

    setUpdatingStatus(salaryId);
    try {
      await callApi(`/employee-salaries/${salaryId}`, { status: newStatus }, 'put');
      await fetchMySalaries();
      alert('Cập nhật trạng thái thành công!');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Không thể cập nhật trạng thái. Vui lòng thử lại sau.';
      setError(errorMsg);
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePrintSalaryInvoice = async (salary) => {
    try {
      // Tạo div chứa nội dung hóa đơn lương
      const invoiceElement = document.createElement('div');
      invoiceElement.style.width = '210mm';
      invoiceElement.style.padding = '20px';
      invoiceElement.style.fontFamily = 'Arial, sans-serif';
      invoiceElement.style.backgroundColor = 'white';
      invoiceElement.style.position = 'absolute';
      invoiceElement.style.left = '-9999px';
      
      const employeeName = salary.employeeName || user?.fullName || 'Nhân viên';
      const month = salary.month || '';
      const year = salary.year || '';
      const baseSalary = salary.baseSalary || 0;
      const allowances = salary.allowances || 0;
      const deductions = salary.deductions || 0;
      const netSalary = salary.netSalary || 0;
      const paymentDate = salary.paymentDate ? formatDate(salary.paymentDate) : 'Chưa có';
      const description = salary.description || '';
      const notes = salary.notes || '';
      const bankName = salary.bankName || '';
      const bankAccountNumber = salary.bankAccountNumber || '';
      const transferReference = salary.transferReference || '';
      const allowanceItems = parseDetailList(salary.allowanceDetails);
      const deductionItems = parseDetailList(salary.deductionDetails);
      
      invoiceElement.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 24px; margin-bottom: 5px; color: #2c3e50;">HỆ THỐNG QUẢN LÝ CHUNG CƯ</h1>
          <p style="font-size: 14px; margin: 5px 0;">Địa chỉ: Khu Công nghệ cao TP.HCM (SHTP), Xa lộ Hà Nội, P. Hiệp Phú, TP. Thủ Đức, TP.HCM</p>
          <p style="font-size: 14px; margin: 5px 0;">Điện thoại: (038) 1234 5678 - Email: Nhom1@quanlychungcu.vn</p>
          <hr style="border: 2px solid #2c3e50; margin: 15px 0 25px 0;" />
          <h2 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50;">PHIẾU LƯƠNG</h2>
        </div>
        ${(bankName || bankAccountNumber || transferReference) ? `
        <div style="margin-bottom: 15px;">
          <h3 style="font-size: 16px; margin-bottom: 8px; color: #2c3e50;">Thông tin thanh toán</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 35%;"><strong>Ngân hàng:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${bankName || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Số tài khoản:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${bankAccountNumber || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Mã giao dịch:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${transferReference || '—'}</td>
            </tr>
          </table>
        </div>
        ` : ''}
        
        <div style="margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 30%;"><strong>Nhân viên:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Tháng/Năm:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">Tháng ${month}/${year}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Ngày trả lương:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${paymentDate}</td>
            </tr>
            ${description ? `
            <tr>
              <td style="padding: 8px;"><strong>Mô tả:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${description}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 18px; margin-bottom: 15px; color: #2c3e50; border-bottom: 2px solid #d4a574; padding-bottom: 5px;">Chi tiết lương</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #34495e; color: white;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Khoản mục</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Số tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; border: 1px solid #ddd;">Lương cơ bản</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(baseSalary)}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">Phụ cấp</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(allowances)}</td>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; border: 1px solid #ddd;">Khấu trừ</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(deductions)}</td>
              </tr>
              ${allowanceItems.map(item => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">➕ ${item.label || 'Phụ cấp khác'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.amount || 0)}</td>
              </tr>`).join('')}
              ${deductionItems.map(item => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">➖ ${item.label || 'Khấu trừ khác'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.amount || 0)}</td>
              </tr>`).join('')}
              <tr style="background-color: #e8f5e9; font-weight: bold; font-size: 16px;">
                <td style="padding: 12px; border: 2px solid #4caf50; text-align: right;">TỔNG THỰC NHẬN:</td>
                <td style="padding: 12px; border: 2px solid #4caf50; text-align: right; color: #2e7d32;">${formatCurrency(netSalary)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        ${notes ? `
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 16px; margin-bottom: 10px;">Ghi chú:</h3>
          <p style="padding: 10px; background-color: #f8f9fa; border-left: 4px solid #d4a574;">${notes}</p>
        </div>
        ` : ''}
        
        <div style="display: flex; justify-content: space-around; margin-top: 50px; text-align: center;">
          <div>
            <p><strong>Người lập phiếu</strong></p>
            <p style="font-size: 12px; margin-top: 50px;">(Ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p><strong>Nhân viên</strong></p>
            <p style="font-size: 12px; margin-top: 50px;">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #7f8c8d;">
          <p>Phiếu lương này được tạo tự động từ hệ thống quản lý chung cư</p>
        </div>
      `;
      
      // Thêm vào body tạm thời để render
      document.body.appendChild(invoiceElement);
      
      // Sử dụng html2canvas để chuyển đổi HTML thành canvas
      html2canvas(invoiceElement, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      }).then(canvas => {
        // Tạo PDF từ canvas
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10;
        
        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        
        // Tải xuống PDF
        const fileName = `phieu-luong-${employeeName.replace(/\s+/g, '-')}-${month}-${year}.pdf`;
        pdf.save(fileName);
        
        // Xóa phần tử tạm thời
        document.body.removeChild(invoiceElement);
      }).catch(err => {
        console.error('Error generating PDF:', err);
        alert('Có lỗi xảy ra khi tạo PDF. Vui lòng thử lại.');
        document.body.removeChild(invoiceElement);
      });
    } catch (err) {
      console.error('Error printing invoice:', err);
      alert('Có lỗi xảy ra khi in hóa đơn. Vui lòng thử lại.');
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'pending': 'Chờ trả',
      'paid': 'Đã trả',
      'confirmed': 'Đã xác nhận',
      'received': 'Đã nhận - hoàn tất',
      'cancelled': 'Đã hủy'
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeClass = (status) => {
    const classMap = {
      'pending': 'bg-warning',
      'paid': 'bg-info',
      'confirmed': 'bg-success',
      'received': 'bg-success',
      'cancelled': 'bg-secondary'
    };
    return classMap[status] || 'bg-secondary';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  };

  // Xử lý khi xác thực thành công
  const handleReAuthSuccess = () => {
    // Lưu timestamp xác thực vào sessionStorage với key riêng cho từng user
    if (user) {
      const userId = user.id || user.Id;
      if (userId) {
        const timestamp = Date.now().toString();
        const timestampKey = `salaryReAuthTimestamp_${userId}`;
        sessionStorage.setItem(timestampKey, timestamp);
        console.log('[MySalary] Re-auth successful, timestamp saved for user:', userId, timestamp);
        setRequiresReAuth(false);
        setIsReAuthModalOpen(false);
        // Fetch salaries sau khi đã xác thực
        fetchMySalaries();
      } else {
        console.error('[MySalary] User ID not found when saving re-auth timestamp');
        setError('Không thể xác định người dùng. Vui lòng đăng nhập lại.');
      }
    }
  };

  // Xử lý khi đóng modal (không cho phép đóng nếu chưa xác thực)
  const handleReAuthClose = () => {
    // Không cho phép đóng modal nếu chưa xác thực
    // User phải đăng nhập để xem lương
  };

  // Tính tổng lương trong tháng
  const totalSalary = salaries.reduce((sum, salary) => sum + Number(salary.netSalary || 0), 0);

  // Hiển thị modal xác thực nếu cần
  if (requiresReAuth && isReAuthModalOpen) {
    return (
      <ReAuthModal
        isOpen={isReAuthModalOpen}
        onSuccess={handleReAuthSuccess}
        onClose={handleReAuthClose}
      />
    );
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="my-salary">
      <PageHeader 
        title="Lương của tôi" 
        hideButton={true}
      />

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {/* Filter Section */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Năm</label>
                <select 
                  className="form-select" 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Tháng</label>
                <select 
                  className="form-select" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>Tháng {month}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card summary-card">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">Tổng lương tháng {selectedMonth}/{selectedYear}</h6>
                <h3 className="card-title text-primary">{formatCurrency(totalSalary)}</h3>
                <small className="text-muted">{salaries.length} bảng lương</small>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card summary-card">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">Lương trung bình</h6>
                <h3 className="card-title text-success">
                  {salaries.length > 0 
                    ? formatCurrency(totalSalary / salaries.length)
                    : formatCurrency(0)}
                </h3>
                <small className="text-muted">Mỗi bảng lương</small>
              </div>
            </div>
          </div>
        </div>

        {/* Salaries List */}
        <div className="data-table-container">
          <div className="data-table-header">
            <h5 className="mb-0">Danh sách lương - Tháng {selectedMonth}/{selectedYear}</h5>
          </div>
          <div className="table-responsive">
            <table className="data-table table align-middle">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th>Tháng/Năm</th>
                  <th style={{ width: '150px' }}>Lương cơ bản</th>
                  <th style={{ width: '150px' }}>Phụ cấp</th>
                  <th style={{ width: '150px' }}>Khấu trừ</th>
                  <th style={{ width: '150px' }}>Thực nhận</th>
                  <th style={{ width: '150px' }}>Ngày trả</th>
                  <th style={{ width: '220px' }}>Trạng thái & Timeline</th>
                  <th style={{ width: '220px' }}>Chi tiết</th>
                  <th style={{ width: '160px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {salaries.length > 0 ? (
                  salaries.map((salary, index) => (
                    <tr key={salary.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="fw-bold">Tháng {salary.month}/{salary.year}</div>
                        {salary.description && (
                          <small className="text-muted">{salary.description}</small>
                        )}
                      </td>
                      <td>{formatCurrency(salary.baseSalary || 0)}</td>
                      <td>{formatCurrency(salary.allowances || 0)}</td>
                      <td>{formatCurrency(salary.deductions || 0)}</td>
                      <td className="fw-bold text-primary">
                        {formatCurrency(salary.netSalary || 0)}
                      </td>
                      <td>
                        {salary.paymentDate ? formatDate(salary.paymentDate) : 'Chưa trả'}
                      </td>
                      <td>
                        <div className="timeline-cell">
                          <div className="timeline-badge mb-2">
                            <span className={`badge ${getStatusBadgeClass(salary.status)}`}>
                              {getStatusLabel(salary.status)}
                            </span>
                          </div>
                          <ul className="timeline-list">
                            <li>
                              <span>✔️ Duyệt:</span>
                              <strong>{formatDateTime(salary.approvedAt) || 'Chưa'}</strong>
                            </li>
                            <li>
                              <span>💸 Trả:</span>
                              <strong>{formatDateTime(salary.paidAt) || 'Chưa'}</strong>
                            </li>
                            <li>
                              <span>✅ Xác nhận:</span>
                              <strong>{formatDateTime(salary.acknowledgedAt) || 'Chưa'}</strong>
                            </li>
                          </ul>
                        </div>
                      </td>
                      <td>
                        <div className="bank-info">
                          {(salary.bankName || salary.bankAccountNumber) ? (
                            <>
                              <div><strong>NH:</strong> {salary.bankName || '—'}</div>
                              <div><strong>STK:</strong> {salary.bankAccountNumber || '—'}</div>
                            </>
                          ) : (
                            <div className="text-muted small">Chưa có thông tin ngân hàng</div>
                          )}
                        </div>
                        <button
                          className="btn btn-sm btn-outline-secondary mt-2"
                          onClick={() => openDetailModal(salary)}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                      <td>
                        <div className="d-flex gap-2 flex-wrap">
                          {salary.status === 'paid' && (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleUpdateStatus(salary.id, 'received')}
                              disabled={updatingStatus === salary.id}
                              title="Xác nhận bạn đã nhận được lương"
                            >
                              {updatingStatus === salary.id ? 'Đang cập nhật...' : 'Đã nhận'}
                            </button>
                          )}
                          {salary.status === 'pending' && (
                            <div>
                              <small className="text-muted d-block mb-1">Chờ quản lý xử lý</small>
                              <small className="text-muted">Bạn chưa thể cập nhật trạng thái</small>
                            </div>
                          )}
                          {salary.status === 'confirmed' && (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleUpdateStatus(salary.id, 'received')}
                              disabled={updatingStatus === salary.id}
                              title="Xác nhận bạn đã nhận được lương"
                            >
                              {updatingStatus === salary.id ? 'Đang cập nhật...' : 'Đã nhận'}
                            </button>
                          )}
                          {salary.status === 'received' && (
                            <span className="badge bg-success">Đã nhận - hoàn tất</span>
                          )}
                          {salary.status === 'cancelled' && (
                            <span className="badge bg-secondary">Đã hủy</span>
                          )}
                          {(salary.status === 'paid' || salary.status === 'received' || salary.status === 'confirmed') && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handlePrintSalaryInvoice(salary)}
                              title="In hóa đơn lương"
                            >
                              🖨️ In
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="text-center py-4">
                      <div className="empty-state-icon">💰</div>
                      <div className="empty-state-title">Chưa có bảng lương nào</div>
                      <div>Bạn chưa có bảng lương cho tháng {selectedMonth}/{selectedYear}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes Section */}
        <div className="card mt-4">
          <div className="card-header bg-primary text-white">
            <h6 className="mb-0">📋 Hướng dẫn sử dụng</h6>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <h6 className="text-primary mb-3">Các trạng thái lương:</h6>
                <div className="mb-3">
                  <span className="badge bg-warning me-2">Chờ trả</span>
                  <span className="text-muted">Lương đang được quản lý xử lý, chưa đến ngày trả. Bạn chưa thể thao tác.</span>
                </div>
                <div className="mb-3">
                  <span className="badge bg-success me-2">Đã trả</span>
                  <span className="text-muted">Quản lý đã xác nhận trả lương. Bạn có thể nhấn nút "Đã nhận" để xác nhận.</span>
                </div>
                <div className="mb-3">
                  <span className="badge bg-success me-2">Đã nhận - hoàn tất</span>
                  <span className="text-muted">Lương đã được xác nhận hoàn tất. Không cần thao tác thêm.</span>
                </div>
              </div>
              <div className="col-md-6">
                <h6 className="text-success mb-3">Cách cập nhật trạng thái:</h6>
                <div className="alert alert-light border-start border-success border-3">
                  <strong className="text-success">Khi lương có trạng thái "Đã trả":</strong>
                  <ul className="mb-0 mt-2">
                    <li>Nhấn nút <strong className="text-success">"Đã nhận"</strong> → Chuyển sang trạng thái "Đã nhận - hoàn tất"</li>
                  </ul>
                </div>
                <div className="alert alert-warning mb-0">
                  <small>
                    <strong>Lưu ý:</strong> Bạn chỉ có thể cập nhật trạng thái lương của chính mình. 
                    Nếu có thắc mắc, vui lòng liên hệ quản lý.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
        <dialog id="salaryDetailModal" className="salary-detail-modal">
          {selectedSalary && (
            <div className="modal-content-card">
              <div className="modal-header">
                <h5>Chi tiết lương tháng {selectedSalary.month}/{selectedSalary.year}</h5>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeDetailModal}>Đóng</button>
              </div>
              <div className="modal-body">
                <section>
                  <h6>Thông tin thanh toán</h6>
                  <p><strong>Ngân hàng:</strong> {selectedSalary.bankName || '—'}</p>
                  <p><strong>Số tài khoản:</strong> {selectedSalary.bankAccountNumber || '—'}</p>
                  <p><strong>Mã giao dịch:</strong> {selectedSalary.transferReference || '—'}</p>
                </section>
                <section>
                  <h6>Phụ cấp chi tiết</h6>
                  {selectedSalary.allowanceItems?.length ? (
                    <ul>
                      {selectedSalary.allowanceItems.map((item, idx) => (
                        <li key={`allow-${idx}`}>
                          {item.label || 'Khoản phụ cấp'} — {formatCurrency(item.amount || 0)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted small">Chưa có dữ liệu</div>
                  )}
                </section>
                <section>
                  <h6>Khấu trừ chi tiết</h6>
                  {selectedSalary.deductionItems?.length ? (
                    <ul>
                      {selectedSalary.deductionItems.map((item, idx) => (
                        <li key={`deduct-${idx}`}>
                          {item.label || 'Khoản khấu trừ'} — {formatCurrency(item.amount || 0)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted small">Chưa có dữ liệu</div>
                  )}
                </section>
                <section>
                  <h6>Timeline</h6>
                  <ul className="timeline-list">
                    <li>✔️ Duyệt: {formatDateTime(selectedSalary.approvedAt) || 'Chưa'}</li>
                    <li>💸 Trả: {formatDateTime(selectedSalary.paidAt) || 'Chưa'}</li>
                    <li>✅ Xác nhận: {formatDateTime(selectedSalary.acknowledgedAt) || 'Chưa'}</li>
                  </ul>
                </section>
              </div>
            </div>
          )}
        </dialog>
    </div>
  );
};

export default MySalary;

