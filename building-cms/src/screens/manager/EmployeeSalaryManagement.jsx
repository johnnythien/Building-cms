import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash, faPrint } from '@fortawesome/free-solid-svg-icons';
import callApi from '../../apis/handleApi';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './EmployeeSalaryManagement.css';

const defaultDetailRow = () => ({ label: '', amount: '' });

const parseDetailList = (value) => {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && (item.label || item.amount));
    }
    return [];
  } catch (err) {
    console.warn('[EmployeeSalaryManagement] detail parse error:', err.message);
    return [];
  }
};

const formatDateTime = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

const EmployeeSalaryManagement = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [salaryTransactions, setSalaryTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'calculate', 'employee-form'
  const [formData, setFormData] = useState({
    employeeId: '',
    baseSalary: '',
    standardWorkingDays: '26', // Mặc định 26 ngày
    actualWorkingDays: '26', // Mặc định 26 ngày
    allowances: '',
    deductions: '',
    netSalary: '',
    paymentDate: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
    status: 'pending',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    bankName: '',
    bankAccountNumber: '',
    transferReference: '',
    allowanceDetails: [defaultDetailRow()],
    deductionDetails: [defaultDetailRow()]
  });
  const [employeeFormData, setEmployeeFormData] = useState({
    id: '',
    fullName: '',
    email: '',
    password: '',
    role: 'manager'
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSalary, setSelectedSalary] = useState(null);

  const {
    currentItems: paginatedEmployees,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(employees);

  const normalizeDetailItems = (items = []) => {
    return items
      .map(item => ({
        label: (item?.label || '').trim(),
        amount: item?.amount !== '' && item?.amount != null ? Number(item.amount) : 0
      }))
      .filter(item => item.label || item.amount);
  };

  // Helper function để tính tổng từ chi tiết
  const calculateTotalFromDetails = (details = []) => {
    return details.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);
  };

  // Tự động cập nhật tổng khi chi tiết thay đổi
  const updateTotalFromDetails = (type, details) => {
    const total = calculateTotalFromDetails(details);
    const totalField = type === 'allowanceDetails' ? 'allowances' : 'deductions';
    return { [totalField]: total.toString() };
  };

  const handleDetailChange = (type, index, field, value) => {
    setFormData(prev => {
      const updated = [...prev[type]];
      updated[index] = {
        ...updated[index],
        [field]: field === 'amount' ? value : value
      };

      // Tự động tính tổng từ chi tiết và cập nhật
      const totalUpdate = updateTotalFromDetails(type, updated);

      return {
        ...prev,
        [type]: updated,
        ...totalUpdate
      };
    });
  };

  const addDetailRow = (type) => {
    setFormData(prev => {
      const newDetails = [...prev[type], defaultDetailRow()];
      // Tính lại tổng sau khi thêm hàng (mặc dù hàng mới có amount = 0 nên tổng không đổi)
      const totalUpdate = updateTotalFromDetails(type, newDetails);
      return {
        ...prev,
        [type]: newDetails,
        ...totalUpdate
      };
    });
  };

  const removeDetailRow = (type, index) => {
    setFormData(prev => {
      const list = [...prev[type]];
      if (list.length === 1) return prev;
      list.splice(index, 1);
      // Tính lại tổng sau khi xóa hàng
      const totalUpdate = updateTotalFromDetails(type, list);
      return {
        ...prev,
        [type]: list,
        ...totalUpdate
      };
    });
  };

  const openSalaryModal = (salary) => {
    setSelectedSalary({
      ...salary,
      allowanceItems: parseDetailList(salary.allowanceDetails),
      deductionItems: parseDetailList(salary.deductionDetails)
    });
    const modal = document.getElementById('managerSalaryDetailModal');
    if (modal) modal.showModal?.();
  };

  const closeSalaryModal = () => {
    const modal = document.getElementById('managerSalaryDetailModal');
    if (modal) modal.close?.();
    setSelectedSalary(null);
  };

  const detailConfig = {
    allowanceDetails: {
      title: 'Phụ cấp chi tiết',
      accent: 'success',
      placeholder: 'Ví dụ: Phụ cấp ăn trưa'
    },
    deductionDetails: {
      title: 'Khấu trừ chi tiết',
      accent: 'danger',
      placeholder: 'Ví dụ: Thuế TNCN'
    }
  };

  const renderDetailRows = (type) => {
    const config = detailConfig[type];
    return (
      <div className="detail-list-card">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className={`text-${config.accent} mb-0`}>{config.title}</h6>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => addDetailRow(type)}
          >
            + Thêm hàng
          </button>
        </div>
        {formData[type].map((detail, index) => (
          <div className="row g-2 align-items-center detail-row" key={`${type}-${index}`}>
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder={config.placeholder}
                value={detail.label}
                onChange={(e) => handleDetailChange(type, index, 'label', e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="Số tiền"
                value={detail.amount}
                onChange={(e) => handleDetailChange(type, index, 'amount', e.target.value)}
              />
            </div>
            <div className="col-md-2 text-end">
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => removeDetailRow(type, index)}
                disabled={formData[type].length === 1}
                title="Xóa hàng"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchEmployees();
      await fetchCategories();
    };
    loadData();
  }, []);

  useEffect(() => {
    fetchSalaryTransactions();
  }, [selectedYear, selectedMonth]);

  // Kiểm tra nếu user không phải admin hoặc manager thì không cho truy cập viewMode 'calculate'
  useEffect(() => {
    if (viewMode === 'calculate' && user?.role !== 'admin' && user?.role !== 'manager') {
      setViewMode('list');
      setError('Chỉ quản lý và quản trị viên mới có quyền tính lương');
    }
  }, [viewMode, user]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Lấy tất cả nhân viên từ API
      const response = await callApi('/users');
      // Filter để hiển thị tất cả các role có thể nhận lương:
      // manager, admin, tender_manager, media_consulting_manager
      const filteredResponse = Array.isArray(response)
        ? response.filter(emp =>
          emp.role === 'manager' ||
          emp.role === 'admin' ||
          emp.role === 'tender_manager' ||
          emp.role === 'media_consulting_manager'
        )
        : [];
      setEmployees(filteredResponse);
      setError('');
      console.log('[fetchEmployees] Loaded', filteredResponse.length, 'employees');
    } catch (err) {
      setError('Không thể tải danh sách nhân viên. Vui lòng thử lại sau.');
      console.error('Error fetching employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await callApi('/categories');
      const salaryCategory = response.find(cat => cat.name === 'Lương nhân viên');
      setCategories(response);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchSalaryTransactions = async () => {
    try {
      // Lấy dữ liệu từ bảng EmployeeSalaries với filter theo tháng/năm
      const response = await callApi(`/employee-salaries?month=${selectedMonth}&year=${selectedYear}`);
      setSalaryTransactions(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Error fetching salary transactions:', err);
      setSalaryTransactions([]);
    }
  };

  const handleAddSalary = () => {
    setFormData({
      employeeId: '',
      baseSalary: '',
      standardWorkingDays: '26', // Mặc định 26 ngày
      actualWorkingDays: '26', // Mặc định 26 ngày
      allowances: '',
      deductions: '',
      netSalary: '',
      paymentDate: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
      status: 'pending',
      month: selectedMonth,
      year: selectedYear,
      bankName: '',
      bankAccountNumber: '',
      transferReference: '',
      allowanceDetails: [defaultDetailRow()],
      deductionDetails: [defaultDetailRow()]
    });
    setViewMode('calculate');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      // 1. Cập nhật giá trị trường đang nhập
      const updated = {
        ...prev,
        [name]: value
      };

      // 2. Kiểm tra nếu các trường ảnh hưởng đến lương thay đổi thì tính lại
      if (['baseSalary', 'standardWorkingDays', 'actualWorkingDays', 'allowances', 'deductions'].includes(name)) {

        // Lấy giá trị số (nếu rỗng hoặc lỗi thì về 0)
        const base = parseFloat(updated.baseSalary) || 0;
        const standardDays = parseFloat(updated.standardWorkingDays) || 26;
        const actualDays = parseFloat(updated.actualWorkingDays) || standardDays;
        const allow = parseFloat(updated.allowances) || 0;
        const deduct = parseFloat(updated.deductions) || 0;

        // Tính lương cơ bản thực tế (chưa làm tròn)
        const realBaseSalaryRaw = standardDays > 0 ? (base / standardDays) * actualDays : 0;

        // Tính tổng thu nhập (chưa làm tròn)
        const totalIncomeRaw = realBaseSalaryRaw + allow - deduct;

        //  Làm tròn số nguyên 
        updated.netSalary = Math.round(totalIncomeRaw).toString();
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.netSalary || !formData.month || !formData.year) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc: Nhân viên, Lương thực nhận, Tháng, Năm');
      return;
    }

    try {
      const selectedEmployee = employees.find(emp => emp.id.toString() === formData.employeeId);
      const employeeName = selectedEmployee ? selectedEmployee.fullName : 'Nhân viên';

      // Parse và validate dữ liệu
      const baseSalary = (formData.baseSalary && formData.baseSalary !== '' && !isNaN(parseFloat(formData.baseSalary)))
        ? parseFloat(formData.baseSalary) : 0;
      const allowances = (formData.allowances && formData.allowances !== '' && !isNaN(parseFloat(formData.allowances)))
        ? parseFloat(formData.allowances) : 0;
      const deductions = (formData.deductions && formData.deductions !== '' && !isNaN(parseFloat(formData.deductions)))
        ? parseFloat(formData.deductions) : 0;
      const netSalary = parseFloat(formData.netSalary);

      if (isNaN(netSalary) || netSalary < 0) {
        setError('Lương thực nhận không hợp lệ');
        return;
      }

      // Parse working days
      const standardWorkingDays = parseFloat(formData.standardWorkingDays) || 26;
      const actualWorkingDays = parseFloat(formData.actualWorkingDays) || standardWorkingDays;

      if (standardWorkingDays <= 0) {
        setError('Số ngày công chuẩn phải lớn hơn 0');
        return;
      }
      if (actualWorkingDays < 0) {
        setError('Số ngày công thực tế không được âm');
        return;
      }

      const salaryData = {
        employeeId: parseInt(formData.employeeId, 10),
        month: parseInt(formData.month, 10),
        year: parseInt(formData.year, 10),
        baseSalary: isNaN(baseSalary) ? 0 : baseSalary,
        standardWorkingDays: standardWorkingDays,
        actualWorkingDays: actualWorkingDays,
        allowances: isNaN(allowances) ? 0 : allowances,
        deductions: isNaN(deductions) ? 0 : deductions,
        netSalary: netSalary,
        paymentDate: (formData.paymentDate && formData.paymentDate.trim() !== '') ? formData.paymentDate : null,
        status: formData.status || 'pending',
        description: (formData.description && formData.description.trim() !== '')
          ? formData.description
          : `Lương nhân viên ${employeeName} - Tháng ${formData.month}/${formData.year}`,
        notes: (formData.notes && formData.notes.trim() !== '') ? formData.notes : null,
        bankName: formData.bankName || null,
        bankAccountNumber: formData.bankAccountNumber || null,
        transferReference: formData.transferReference || null,
        allowanceDetails: normalizeDetailItems(formData.allowanceDetails),
        deductionDetails: normalizeDetailItems(formData.deductionDetails)
      };

      console.log('[handleSubmit] Sending salary data:', salaryData);
      await callApi('/employee-salaries', salaryData, 'post');

      // Refresh data
      await fetchSalaryTransactions();
      setViewMode('list');
      setError('');
      alert('Tính lương thành công!');
    } catch (err) {
      console.error('Error saving salary:', err);
      console.error('Error details:', {
        response: err.response,
        data: err.response?.data,
        message: err.message
      });

      // Xử lý 422 Validation Errors
      if (err.code === 'VALIDATION_ERROR' && err.validationErrors) {
        const validationErrors = err.validationErrors;
        const fieldErrors = Object.entries(validationErrors)
          .map(([field, message]) => `${field}: ${message}`)
          .join(', ');
        setError(`Dữ liệu không hợp lệ: ${fieldErrors}`);
        return;
      }

      const errorMsg = err.response?.data?.message || err.message || 'Không thể lưu bảng lương. Vui lòng thử lại sau.';
      const errorDetails = err.response?.data?.details;

      setError(errorDetails ? `${errorMsg} (Chi tiết: ${JSON.stringify(errorDetails)})` : errorMsg);
    }
  };

  const handleUpdateSalaryStatus = async (salaryId, newStatus) => {
    // Tìm salary hiện tại để so sánh
    const currentSalary = salaryTransactions.find(s => s.id === salaryId);
    if (currentSalary && currentSalary.status === newStatus) {
      return; // Không cần cập nhật nếu trạng thái không thay đổi
    }

    if (!window.confirm(`Bạn có chắc chắn muốn cập nhật trạng thái từ "${getStatusLabel(currentSalary?.status || '')}" sang "${getStatusLabel(newStatus)}"?`)) {
      // Nếu cancel, cần reset dropdown về giá trị cũ
      await fetchSalaryTransactions();
      return;
    }

    try {
      await callApi(`/employee-salaries/${salaryId}`, { status: newStatus }, 'put');
      await fetchSalaryTransactions();
      alert('Cập nhật trạng thái thành công!');
      setError('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Không thể cập nhật trạng thái. Vui lòng thử lại sau.';
      setError(errorMsg);
      console.error('Error updating status:', err);
      // Reset dropdown về giá trị cũ nếu có lỗi
      await fetchSalaryTransactions();
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
      'confirmed': 'bg-primary',
      'received': 'bg-success',
      'cancelled': 'bg-secondary'
    };
    return classMap[status] || 'bg-secondary';
  };

  const handleDeleteSalary = async (salaryId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bảng lương này?')) return;

    try {
      await callApi(`/employee-salaries/${salaryId}`, null, 'delete');
      await fetchSalaryTransactions();
      alert('Xóa bảng lương thành công');
    } catch (err) {
      setError('Không thể xóa bảng lương. Vui lòng thử lại sau.');
      console.error('Error deleting salary:', err);
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

      const employeeName = salary.employeeName || 'Nhân viên';
      const month = salary.month || '';
      const year = salary.year || '';
      const baseSalary = salary.baseSalary || 0;
      const allowances = salary.allowances || 0;
      const deductions = salary.deductions || 0;
      const netSalary = salary.netSalary || 0;
      const paymentDate = salary.paymentDate ? formatDate(salary.paymentDate) : 'Chưa có';
      const description = salary.description || '';
      const notes = salary.notes || '';

      invoiceElement.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 24px; margin-bottom: 5px; color: #2c3e50;">HỆ THỐNG QUẢN LÝ CHUNG CƯ</h1>
          <p style="font-size: 14px; margin: 5px 0;">Địa chỉ: Khu Công nghệ cao TP.HCM (SHTP), Xa lộ Hà Nội, P. Hiệp Phú, TP. Thủ Đức, TP.HCM</p>
          <p style="font-size: 14px; margin: 5px 0;">Điện thoại: (038) 1234 5678 - Email: Nhom1@quanlychungcu.vn</p>
          <hr style="border: 2px solid #2c3e50; margin: 15px 0 25px 0;" />
          <h2 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50;">PHIẾU LƯƠNG</h2>
        </div>
        
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

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsEditingEmployee(false);
    setEmployeeFormData({
      id: '',
      fullName: '',
      email: '',
      password: '',
      role: 'manager'
    });
    setViewMode('employee-form');
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setIsEditingEmployee(true);
    setEmployeeFormData({
      id: employee.id,
      fullName: employee.fullName || '',
      email: employee.email || '',
      password: '',
      role: employee.role || 'manager'
    });
    setViewMode('employee-form');
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân viên này? Lưu ý: Các bảng lương liên quan vẫn sẽ được giữ lại.')) return;

    try {
      await callApi(`/users/${employeeId}`, null, 'delete');
      await fetchEmployees();
      alert('Xóa nhân viên thành công');
    } catch (err) {
      setError('Không thể xóa nhân viên. Vui lòng thử lại sau.');
      console.error('Error deleting employee:', err);
    }
  };

  const handleEmployeeFormChange = (e) => {
    const { name, value } = e.target;
    setEmployeeFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();

    if (!employeeFormData.fullName || !employeeFormData.email) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    // Khi tạo mới, password là bắt buộc
    if (!isEditingEmployee && !employeeFormData.password) {
      setError('Mật khẩu là bắt buộc khi tạo nhân viên mới');
      return;
    }

    // Validation: Admin không thể thay đổi role của admin khác
    if (isEditingEmployee && user?.role === 'admin') {
      const employeeToEdit = employees.find(emp => emp.id === employeeFormData.id);
      if (employeeToEdit && employeeToEdit.role === 'admin' && employeeFormData.role !== 'admin') {
        setError('Admin không thể thay đổi role của admin khác');
        return;
      }
    }

    try {
      const employeeData = {
        role: employeeFormData.role
      };

      // Khi tạo mới, gửi fullName, email, password
      if (!isEditingEmployee) {
        employeeData.fullName = employeeFormData.fullName;
        employeeData.email = employeeFormData.email;
        if (employeeFormData.password) {
          employeeData.password = employeeFormData.password;
        }
      }
      // Khi chỉnh sửa, chỉ gửi role (fullName, email, password không được thay đổi)

      let result;
      if (isEditingEmployee) {
        result = await callApi(`/users/${employeeFormData.id}`, employeeData, 'put');
        console.log('[handleEmployeeSubmit] Update result:', result);
        alert('Cập nhật nhân viên thành công');
      } else {
        result = await callApi('/users', employeeData, 'post');
        console.log('[handleEmployeeSubmit] Create result:', result);
        if (result) {
          alert('Thêm nhân viên mới thành công');
        } else {
          throw new Error('Không nhận được response từ server');
        }
      }

      // Refresh danh sách nhân viên sau khi thêm/cập nhật
      await fetchEmployees();
      setViewMode('list');
      setError('');
      setSelectedEmployee(null);
      setIsEditingEmployee(false);
      setEmployeeFormData({
        id: '',
        fullName: '',
        email: '',
        password: '',
        role: 'manager'
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Không thể lưu nhân viên. Vui lòng thử lại sau.';
      setError(errorMsg);
      console.error('Error saving employee:', err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
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

  // Lọc nhân viên theo từ khóa tìm kiếm
  const filteredEmployees = employees.filter(employee =>
    employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tính tổng lương trong tháng
  const totalSalary = salaryTransactions.reduce((sum, salary) => sum + Number(salary.netSalary || 0), 0);

  const canCalculateSalary = user?.role === 'admin' || user?.role === 'manager';

  // Show loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="employee-salary-management">
      <div className="page-header-wrapper mb-4">
        <PageHeader
          title="Quản lý lương nhân viên"
          buttonText="Tính lương tháng này"
          onButtonClick={handleAddSalary}
          hideButton={!canCalculateSalary}
        />
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {viewMode === 'list' && (
        <>
          {/* Filter Section */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
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
                <div className="col-md-3">
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
                <div className="col-md-6">
                  <label className="form-label">Tìm kiếm nhân viên</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Tìm theo tên hoặc email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card summary-card">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Tổng lương tháng {selectedMonth}/{selectedYear}</h6>
                  <h3 className="card-title text-danger">{formatCurrency(totalSalary)}</h3>
                  <small className="text-muted">{salaryTransactions.length} bảng lương</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card summary-card">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Tổng nhân viên</h6>
                  <h3 className="card-title text-primary">{employees.length}</h3>
                  <small className="text-muted">Nhân viên trong hệ thống</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card summary-card">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Lương trung bình</h6>
                  <h3 className="card-title text-success">
                    {salaryTransactions.length > 0
                      ? formatCurrency(totalSalary / salaryTransactions.length)
                      : formatCurrency(0)}
                  </h3>
                  <small className="text-muted">Mỗi nhân viên</small>
                </div>
              </div>
            </div>
          </div>

          {/* Salary Transactions List */}
          <div className="data-table-container">
            <div className="data-table-header">
              <h5 className="mb-0">Danh sách lương đã trả - Tháng {selectedMonth}/{selectedYear}</h5>
            </div>
            <div className="table-responsive">
              <table className="data-table table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>Nhân viên</th>
                    <th style={{ width: '140px' }}>Ngày trả</th>
                    <th style={{ width: '140px' }}>Lương cơ bản</th>
                    <th style={{ width: '140px' }}>Phụ cấp</th>
                    <th style={{ width: '140px' }}>Khấu trừ</th>
                    <th style={{ width: '150px' }}>Thực nhận</th>
                    <th style={{ width: '220px' }}>Trạng thái & Timeline</th>
                    <th style={{ width: '220px' }}>Thanh toán</th>
                    <th style={{ width: '160px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryTransactions.length > 0 ? (
                    salaryTransactions.map((salary, index) => (
                      <tr key={salary.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div>{salary.employeeName || 'N/A'}</div>
                          <small className="text-muted">{salary.description || ''}</small>
                        </td>
                        <td>{salary.paymentDate ? formatDate(salary.paymentDate) : 'Chưa trả'}</td>
                        <td>{formatCurrency(salary.baseSalary || 0)}</td>
                        <td>{formatCurrency(salary.allowances || 0)}</td>
                        <td>{formatCurrency(salary.deductions || 0)}</td>
                        <td className="fw-bold text-danger">
                          {formatCurrency(salary.netSalary || 0)}
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
                            <div className="mt-2">
                              <select
                                className="form-select form-select-sm"
                                value={salary.status}
                                onChange={(e) => handleUpdateSalaryStatus(salary.id, e.target.value)}
                                style={{ width: 'auto', minWidth: '140px' }}
                              >
                                <option value="pending">Chờ trả</option>
                                <option value="confirmed">Đã xác nhận</option>
                                <option value="paid">Đã trả</option>
                                <option value="cancelled">Đã hủy</option>
                              </select>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="bank-info">
                            <div><strong>NH:</strong> {salary.bankName || '—'}</div>
                            <div><strong>STK:</strong> {salary.bankAccountNumber || '—'}</div>
                            <div><strong>Mã:</strong> {salary.transferReference || '—'}</div>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-secondary mt-2"
                            onClick={() => openSalaryModal(salary)}
                          >
                            Xem chi tiết
                          </button>
                        </td>
                        <td>
                          <div className="salary-actions">
                            <button
                              className="edit-btn"
                              onClick={() => handlePrintSalaryInvoice(salary)}
                              title="In hóa đơn lương"
                            >
                              <FontAwesomeIcon icon={faPrint} />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteSalary(salary.id)}
                              title="Xóa bảng lương"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="text-center py-4">
                        <div className="empty-state-icon">💰</div>
                        <div className="empty-state-title">Chưa có bảng lương nào</div>
                        <div>Tính lương cho nhân viên trong tháng này</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employees List */}
          <div className="data-table-container mt-4">
            <div className="data-table-header">
              <h5 className="mb-0">Danh sách nhân viên</h5>
              <button className="btn btn-sm btn-primary" onClick={handleAddEmployee}>
                + Thêm nhân viên
              </button>
            </div>
            <div className="table-responsive">
              <table className="data-table table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th style={{ width: '150px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee, index) => (
                      <tr key={employee.id}>
                        <td>{(currentPage - 1) * 10 + index + 1}</td>
                        <td>{employee.fullName}</td>
                        <td>{employee.email}</td>
                        <td>
                          <span className="badge bg-info">
                            {employee.role === 'manager' ? 'Quản lý' :
                              employee.role === 'admin' ? 'Quản trị viên' :
                                employee.role === 'tender_manager' ? 'Quản lý đấu thầu' :
                                  employee.role === 'media_consulting_manager' ? 'Quản lý Truyền thông' :
                                    employee.role}
                          </span>
                        </td>
                        <td>
                          <div className="salary-actions">
                            <button
                              className="edit-btn"
                              onClick={() => handleEditEmployee(employee)}
                              title="Sửa"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteEmployee(employee.id)}
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
                      <td colSpan="5" className="text-center py-4">
                        <div className="empty-state-icon">👥</div>
                        <div className="empty-state-title">Chưa có nhân viên nào</div>
                        <button className="btn btn-sm btn-primary mt-3" onClick={handleAddEmployee}>
                          Thêm nhân viên mới
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length > 0 && (
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

      {viewMode === 'calculate' && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Tính lương nhân viên - Tháng {formData.month}/{formData.year}</h5>
            <button className="btn btn-outline-secondary" onClick={() => setViewMode('list')}>
              Hủy
            </button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nhân viên <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Tháng tính lương <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="month"
                    value={formData.month}
                    onChange={handleFormChange}
                    required
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>Tháng {month}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Năm tính lương <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="year"
                    value={formData.year}
                    onChange={handleFormChange}
                    required
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Lương cơ bản (VNĐ) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    className="form-control"
                    name="baseSalary"
                    value={formData.baseSalary}
                    onChange={handleFormChange}
                    placeholder="0"
                    min="0"
                    step="1000"
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Công chuẩn (ngày) <span className="text-danger">*</span>
                    <small className="text-muted d-block">Số ngày công chuẩn trong tháng</small>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="standardWorkingDays"
                    value={formData.standardWorkingDays}
                    onChange={handleFormChange}
                    placeholder="26"
                    min="1"
                    step="0.5"
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Công thực tế (ngày) <span className="text-danger">*</span>
                    <small className="text-muted d-block">Số ngày công thực tế đi làm</small>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="actualWorkingDays"
                    value={formData.actualWorkingDays}
                    onChange={handleFormChange}
                    placeholder="26"
                    min="0"
                    step="0.5"
                    required
                  />
                </div>
                <div className="col-md-12">
                  <div className="alert alert-info mb-3">
                    <strong>Công thức tính lương:</strong><br />
                    <span className="text-muted">
                      Lương cơ bản thực tế = (Lương cơ bản ÷ Công chuẩn) × Công thực tế<br />
                      Lương thực nhận = Lương cơ bản thực tế + Phụ cấp - Khấu trừ
                    </span>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Phụ cấp (VNĐ)
                    <small className="text-muted ms-2">(Tự động tính từ chi tiết)</small>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="allowances"
                    value={formData.allowances}
                    onChange={handleFormChange}
                    placeholder="0"
                    min="0"
                    step="1000"
                    readOnly
                    style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    title="Tổng phụ cấp được tự động tính từ danh sách phụ cấp chi tiết bên dưới"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Khấu trừ (VNĐ)
                    <small className="text-muted ms-2">(Tự động tính từ chi tiết)</small>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="deductions"
                    value={formData.deductions}
                    onChange={handleFormChange}
                    placeholder="0"
                    min="0"
                    step="1000"
                    readOnly
                    style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    title="Tổng khấu trừ được tự động tính từ danh sách khấu trừ chi tiết bên dưới"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Lương thực nhận (VNĐ) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    className="form-control"
                    name="netSalary"
                    value={formData.netSalary} // Dùng formData thay vì this.state
                    onChange={handleFormChange}
                    placeholder="Tự động tính = Lương cơ bản + Phụ cấp - Khấu trừ"
                    required
                    min="0"
                    step="1"  // chấp nhận số lẻ hoặc số không tròn nghìn
                  />
                  <small className="text-muted">Tự động tính khi nhập lương cơ bản, phụ cấp, khấu trừ</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Ngày trả lương</label>
                  <input
                    type="date"
                    className="form-control"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Ngân hàng</label>
                  <input
                    type="text"
                    className="form-control"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleFormChange}
                    placeholder="Ví dụ: Vietcombank"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Số tài khoản</label>
                  <input
                    type="text"
                    className="form-control"
                    name="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={handleFormChange}
                    placeholder="Nhập số tài khoản"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Mã giao dịch/Tham chiếu</label>
                  <input
                    type="text"
                    className="form-control"
                    name="transferReference"
                    value={formData.transferReference}
                    onChange={handleFormChange}
                    placeholder="Nhập mã tham chiếu"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Trạng thái</label>
                  <select
                    className="form-select"
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                  >
                    <option value="pending">Chờ trả</option>
                    <option value="paid">Đã trả</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label">Mô tả</label>
                  <textarea
                    className="form-control"
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    rows="2"
                    placeholder="Nhập mô tả (để trống sẽ tự động tạo)"
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label">Ghi chú</label>
                  <textarea
                    className="form-control"
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    rows="2"
                    placeholder="Nhập ghi chú (nếu có)"
                  />
                </div>
                <div className="col-md-12">
                  {renderDetailRows('allowanceDetails')}
                </div>
                <div className="col-md-12">
                  {renderDetailRows('deductionDetails')}
                </div>
              </div>
              <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setViewMode('list')}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu bảng lương
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'employee-form' && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{isEditingEmployee ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h5>
            <button className="btn btn-outline-secondary" onClick={() => {
              setViewMode('list');
              setSelectedEmployee(null);
              setIsEditingEmployee(false);
              setEmployeeFormData({
                id: '',
                fullName: '',
                email: '',
                password: '',
                role: 'manager'
              });
            }}>
              Hủy
            </button>
          </div>
          <div className="card-body">
            <form onSubmit={handleEmployeeSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Họ và tên <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="fullName"
                    value={employeeFormData.fullName}
                    onChange={handleEmployeeFormChange}
                    placeholder="Nhập họ và tên"
                    required
                    readOnly={isEditingEmployee}
                    style={isEditingEmployee ? { backgroundColor: '#f8f9fa', cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email <span className="text-danger">*</span></label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={employeeFormData.email}
                    onChange={handleEmployeeFormChange}
                    placeholder="example@email.com"
                    required
                    readOnly={isEditingEmployee}
                    style={isEditingEmployee ? { backgroundColor: '#f8f9fa', cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">
                    Mật khẩu {!isEditingEmployee && <span className="text-danger">*</span>}
                    {isEditingEmployee && <small className="text-muted">(Không thể thay đổi)</small>}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    name="password"
                    value={isEditingEmployee ? '••••••••' : employeeFormData.password}
                    onChange={handleEmployeeFormChange}
                    placeholder={isEditingEmployee ? "Mật khẩu không thể thay đổi" : "Nhập mật khẩu"}
                    required={!isEditingEmployee}
                    readOnly={isEditingEmployee}
                    disabled={isEditingEmployee}
                    style={isEditingEmployee ? { backgroundColor: '#f8f9fa', cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Vai trò</label>
                  <select
                    className="form-select"
                    name="role"
                    value={employeeFormData.role}
                    onChange={handleEmployeeFormChange}
                    disabled={isEditingEmployee && selectedEmployee?.role === 'admin' && user?.role === 'admin'}
                  >
                    <option value="manager">Quản lý</option>
                    <option value="tender_manager">Quản lý đấu thầu</option>
                    <option value="media_consulting_manager">Quản lý Truyền thông</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                  {isEditingEmployee && selectedEmployee?.role === 'admin' && user?.role === 'admin' && (
                    <small className="text-muted d-block mt-1">Admin không thể thay đổi role của admin khác</small>
                  )}
                </div>
              </div>
              <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setViewMode('list');
                    setSelectedEmployee(null);
                    setIsEditingEmployee(false);
                    setEmployeeFormData({
                      id: '',
                      fullName: '',
                      email: '',
                      password: '',
                      role: 'staff'
                    });
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditingEmployee ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <dialog id="managerSalaryDetailModal" className="salary-detail-modal">
        {selectedSalary && (
          <div className="modal-content-card">
            <div className="modal-header">
              <h5>Chi tiết lương - {selectedSalary.employeeName}</h5>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeSalaryModal}>Đóng</button>
            </div>
            <div className="modal-body">
              <section>
                <h6>Thông tin thanh toán</h6>
                <p><strong>Ngân hàng:</strong> {selectedSalary.bankName || '—'}</p>
                <p><strong>Số tài khoản:</strong> {selectedSalary.bankAccountNumber || '—'}</p>
                <p><strong>Mã giao dịch:</strong> {selectedSalary.transferReference || '—'}</p>
              </section>
              <section>
                <h6>Timeline</h6>
                <ul className="timeline-list">
                  <li>✔️ Duyệt: {formatDateTime(selectedSalary.approvedAt) || 'Chưa'}</li>
                  <li>💸 Trả: {formatDateTime(selectedSalary.paidAt) || 'Chưa'}</li>
                  <li>✅ Xác nhận: {formatDateTime(selectedSalary.acknowledgedAt) || 'Chưa'}</li>
                </ul>
              </section>
              <section>
                <h6>Phụ cấp chi tiết</h6>
                {selectedSalary.allowanceItems?.length ? (
                  <ul>
                    {selectedSalary.allowanceItems.map((item, idx) => (
                      <li key={`manager-allow-${idx}`}>
                        {item.label || 'Phụ cấp'} — {formatCurrency(item.amount || 0)}
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
                      <li key={`manager-deduct-${idx}`}>
                        {item.label || 'Khấu trừ'} — {formatCurrency(item.amount || 0)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted small">Chưa có dữ liệu</div>
                )}
              </section>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};

export default EmployeeSalaryManagement;

