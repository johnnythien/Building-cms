import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faTrash, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import './InvoiceManagement.css';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';

const InvoiceManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Update document title
  useEffect(() => {
    document.title = 'Quản lý hóa đơn';
  }, []);
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    apartmentId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: [{ description: '', amount: '', categoryId: '' }],
    paidAmount: 0,
    paidDate: '',
    status: 'pending',
    notes: '',
  });
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchApartments();
    fetchCategories();
  }, []);

  // Lọc căn hộ theo khách hàng đã chọn
  useEffect(() => {
    if (formData.customerId) {
      const customerApartments = apartments.filter(
        apt => apt.customerId === parseInt(formData.customerId, 10)
      );
      setFilteredApartments(customerApartments);
      
      // Nếu khách hàng thay đổi, cần cập nhật tên khách hàng
      const selectedCustomer = customers.find(c => c.id === parseInt(formData.customerId, 10));
      if (selectedCustomer) {
        setFormData(prev => ({
          ...prev,
          customerName: selectedCustomer.name,
          // Reset apartment nếu khách hàng thay đổi
          apartment: ''
        }));
      }
    } else {
      setFilteredApartments([]);
    }
  }, [formData.customerId, apartments, customers]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await callApi('/invoices');
      setInvoices(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu hóa đơn. Vui lòng thử lại sau.');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await callApi('/customers');
      setCustomers(response);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Không thể tải danh sách khách hàng.');
    }
  };

  const fetchApartments = async () => {
    try {
      const response = await callApi('/apartments');
      setApartments(response);
    } catch (err) {
      console.error('Error fetching apartments:', err);
      setError('Không thể tải danh sách căn hộ.');
    }
  };

  const fetchCategories = async () => {
    try {
      const allCategories = await callApi('/categories'); // Lấy tất cả danh mục
      if (Array.isArray(allCategories)) {
        const incomeCategories = allCategories.filter(cat => cat.type === 'income'); // lọc danh mục thu
        setCategories(incomeCategories);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Không thể tải danh mục.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', amount: '', categoryId: '' }]
    }));
  };

  const removeItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const amount = item.amount ? parseFloat(item.amount) : 0;
      return sum + amount;
    }, 0);
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      customerName: '',
      apartmentId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [{ description: '', amount: '', categoryId: '' }],
      paidAmount: 0,
      paidDate: '',
      status: 'pending',
      notes: '',
    });
    setSelectedInvoice(null);
    setFilteredApartments([]);
  };

  const openCreateModal = () => {
    resetForm();
    // Set due date to 15 days from now by default
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    setFormData(prev => ({
      ...prev,
      dueDate: dueDate.toISOString().split('T')[0]
    }));
    setShowInvoiceModal(true);
  };

  const openEditModal = async (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
    
    try {
      // Fetch chi tiết hóa đơn từ API để lấy items đầy đủ với categoryId
      const response = await callApi(`/invoices/${invoice.id}`);
      const { invoice: invoiceDetail, items } = response;
      
      // Set formData với dữ liệu đầy đủ từ API
      setFormData({
        customerId: invoiceDetail.customerId || invoice.customerId || '',
        customerName: invoiceDetail.customerName || invoice.customerName || '',
        apartmentId: invoiceDetail.apartmentId || invoice.apartmentId || '',
        issueDate: invoiceDetail.issueDate || invoice.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoiceDetail.dueDate || invoice.dueDate || '',
        items: items && items.length > 0 ? items.map(item => ({
          description: item.description || '',
          amount: item.amount || '',
          categoryId: item.categoryId ? String(item.categoryId) : ''
        })) : [{ description: '', amount: '', categoryId: '' }],
        paidAmount: invoiceDetail.paidAmount || invoice.paidAmount || 0,
        paidDate: invoiceDetail.paidDate || invoice.paidDate || '',
        status: invoiceDetail.status || invoice.status || 'pending',
        notes: invoiceDetail.notes || invoice.notes || '',
        invoiceNumber: invoiceDetail.invoiceNumber || invoice.invoiceNumber || ''
      });
      
      // Nếu có customerId, lọc căn hộ tương ứng
      const customerIdToUse = invoiceDetail.customerId || invoice.customerId;
      if (customerIdToUse) {
        const customerApartments = apartments.filter(
          apt => apt.customerId === parseInt(customerIdToUse, 10)
        );
        setFilteredApartments(customerApartments);
      }
    } catch (err) {
      console.error('Error fetching invoice details:', err);
      setError('Không thể tải chi tiết hóa đơn. Vui lòng thử lại.');
      // Fallback: dùng dữ liệu từ danh sách nếu API lỗi
      setFormData({
        customerId: invoice.customerId || '',
        customerName: invoice.customerName || '',
        apartmentId: invoice.apartmentId || '',
        issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoice.dueDate || '',
        items: invoice.items && invoice.items.length > 0 ? invoice.items : [{ description: '', amount: '', categoryId: '' }],
        paidAmount: invoice.paidAmount || 0,
        paidDate: invoice.paidDate || '',
        status: invoice.status || 'pending',
        notes: invoice.notes || '',
        invoiceNumber: invoice.invoiceNumber || ''
      });
      
      if (invoice.customerId) {
        const customerApartments = apartments.filter(
          apt => apt.customerId === parseInt(invoice.customerId, 10)
        );
        setFilteredApartments(customerApartments);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra các trường bắt buộc
    if (!formData.customerId || !formData.apartmentId || !formData.issueDate || !formData.dueDate) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    
    // Kiểm tra các mục hóa đơn
    if (formData.items.some(item => !item.description || !item.amount || !item.categoryId)) { 
      setError('Vui lòng điền đầy đủ Mô tả, Số tiền, và Danh mục cho tất cả các mục hóa đơn.'); 
      return;
    }
    
    try {
      // Tính toán tổng tiền
      const totalAmount = calculateTotal();
      
      // Cập nhật trạng thái dựa trên số tiền đã thanh toán
      let status = formData.status;
      
      // Khi người dùng không chủ động chọn trạng thái, tính toán tự động
      if (selectedInvoice && status === selectedInvoice.status) {
        if (formData.paidAmount >= totalAmount) {
          status = 'paid';
        } else if (formData.paidAmount > 0) {
          status = 'partial';
        } else if (new Date(formData.dueDate) < new Date()) {
          status = 'overdue';
        } else {
          status = 'pending';
        }
      }
      
      // Tạo payload; backend sẽ tính total từ items nếu totalAmount không truyền
      let invoiceData = {
        ...formData,
        totalAmount,
        status
      };
      
      if (!selectedInvoice) {
        // Tạo mã hóa đơn mới theo định dạng INV-YYYY-XXX
        const year = new Date().getFullYear();
        const latestInvoice = invoices.length > 0 ? 
          Math.max(...invoices.map(inv => {
            // Trích xuất số thứ tự từ mã hóa đơn hiện có
            const match = inv.invoiceNumber?.match(/INV-\d{4}-(\d{3})/);
            return match ? parseInt(match[1], 10) : 0;
          })) : 0;
        
        const nextNumber = (latestInvoice + 1).toString().padStart(3, '0');
        invoiceData.invoiceNumber = `INV-${year}-${nextNumber}`;
      }
      
      if (selectedInvoice) {
        // Đảm bảo giữ nguyên invoiceNumber khi cập nhật
        if (!invoiceData.invoiceNumber && selectedInvoice.invoiceNumber) {
          invoiceData.invoiceNumber = selectedInvoice.invoiceNumber;
        }
        
        // Đảm bảo có ID khi cập nhật
        invoiceData.id = selectedInvoice.id;
        
        // Cập nhật hóa đơn
        console.log('Cập nhật hóa đơn:', invoiceData);
        await callApi(`/invoices/${selectedInvoice.id}`, invoiceData, 'put');
      } else {
        // Tạo hóa đơn mới
        console.log('Tạo hóa đơn mới:', invoiceData);
        await callApi('/invoices', invoiceData, 'post');
      }
      
      setShowInvoiceModal(false);
      resetForm();
      fetchInvoices();
    } catch (err) {
      setError(selectedInvoice 
        ? 'Không thể cập nhật hóa đơn. Vui lòng thử lại.' 
        : 'Không thể tạo hóa đơn mới. Vui lòng thử lại.');
      console.error('Error submitting invoice:', err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hóa đơn này không?')) {
      try {
        await callApi(`/invoices/${id}`, null, 'delete');
        fetchInvoices();
      } catch (err) {
        setError('Không thể xóa hóa đơn. Vui lòng thử lại.');
        console.error('Error deleting invoice:', err);
      }
    }
  };

  const handleUpdateStatus = async (invoice, newPaidAmount, newPaidDate = null) => {
    try {
      // Tạo bản sao của hóa đơn để cập nhật
      const updatedInvoice = { ...invoice };
      
      // Cập nhật số tiền đã thanh toán và ngày thanh toán
      updatedInvoice.paidAmount = parseFloat(newPaidAmount);
      updatedInvoice.paidDate = newPaidAmount > 0 ? 
        (newPaidDate || new Date().toISOString().split('T')[0]) : 
        null;
      
      // Cập nhật trạng thái dựa trên số tiền đã thanh toán
      updatedInvoice.status = 'paid';
      
      console.log('Cập nhật trạng thái hóa đơn:', updatedInvoice);
      await callApi(`/invoices/${invoice.id}`, updatedInvoice, 'put');
      fetchInvoices();
    } catch (err) {
      setError('Không thể cập nhật trạng thái hóa đơn. Vui lòng thử lại.');
      console.error('Error updating invoice status:', err);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = filters.status === 'all' || invoice.status === filters.status;
    
    const matchesDateFrom = !filters.dateFrom || new Date(invoice.issueDate) >= new Date(filters.dateFrom);
    const matchesDateTo = !filters.dateTo || new Date(invoice.issueDate) <= new Date(filters.dateTo);
    
    const matchesSearch = !filters.searchTerm || 
      invoice.customerName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      invoice.apartment.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(filters.searchTerm.toLowerCase());
    
    return matchesStatus && matchesDateFrom && matchesDateTo && matchesSearch;
  });

  const formatCurrency = (amount) => {
    const n = Number(amount);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(safe);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN').format(date);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid': return 'Đã thanh toán';
      case 'partial': return 'Thanh toán một phần';
      case 'pending': return 'Chờ thanh toán';
      case 'overdue': return 'Quá hạn';
      default: return status;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid': return 'status-paid';
      case 'partial': return 'status-partial';
      case 'pending': return 'status-pending';
      case 'overdue': return 'status-overdue';
      default: return '';
    }
  };

  const exportToPDF = async () => {
    if (!selectedInvoice) return;

    // Fetch chi tiết hóa đơn để đảm bảo có items đầy đủ
    let invoiceData = selectedInvoice;
    let invoiceItems = formData.items && formData.items.length > 0 ? formData.items : [];
    
    // Nếu formData không có items hoặc items rỗng, fetch lại từ API
    if (!invoiceItems || invoiceItems.length === 0 || !invoiceItems[0].description) {
      try {
        const response = await callApi(`/invoices/${selectedInvoice.id}`);
        invoiceData = response.invoice || selectedInvoice;
        invoiceItems = response.items || [];
      } catch (err) {
        console.error('Error fetching invoice details for PDF:', err);
        // Fallback: sử dụng selectedInvoice và formData
        invoiceItems = formData.items || [];
      }
    }

    // Đảm bảo invoiceItems là array và có dữ liệu
    if (!Array.isArray(invoiceItems) || invoiceItems.length === 0) {
      alert('Không thể xuất PDF: Hóa đơn không có mục nào.');
      return;
    }

    const invoiceElement = document.createElement('div');
    invoiceElement.style.width = '210mm';
    invoiceElement.style.padding = '20px';
    invoiceElement.style.fontFamily = 'Arial, sans-serif';
    
    invoiceElement.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-size: 24px; margin-bottom: 5px;">HỆ THỐNG QUẢN LÝ CHUNG CƯ</h1>
        <p style="font-size: 14px; margin: 5px 0;">Địa chỉ: Khu Công nghệ cao TP.HCM (SHTP), Xa lộ Hà Nội, P. Hiệp Phú, TP. Thủ Đức, TP.HCM</p>
        <p style="font-size: 14px; margin: 5px 0;">Điện thoại: (038) 1234 5678 - Email: Nhom1@quanlychungcu.vn</p>
        <hr style="border: 1px solid #000; margin: 10px 0 20px 0;" />
        <h2 style="font-size: 20px; margin-bottom: 20px;">HÓA ĐƠN DỊCH VỤ</h2>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>Mã hóa đơn:</strong> ${invoiceData.invoiceNumber || selectedInvoice.invoiceNumber || 'N/A'}</p>
        <p><strong>Ngày lập:</strong> ${formatDate(invoiceData.issueDate || selectedInvoice.issueDate)}</p>
        <p><strong>Ngày đến hạn:</strong> ${formatDate(invoiceData.dueDate || selectedInvoice.dueDate)}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 10px;">Thông tin khách hàng:</h3>
        <p><strong>Họ tên:</strong> ${invoiceData.customerName || selectedInvoice.customerName || formData.customerName || 'N/A'}</p>
        <p><strong>Căn hộ:</strong> ${invoiceData.apartment || selectedInvoice.apartment || 'N/A'}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 10px;">Chi tiết dịch vụ:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #34495e; color: white;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">STT</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Dịch vụ</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceItems.map((item, index) => `
              <tr style="background-color: ${index % 2 === 0 ? '#f2f2f2' : 'white'};">
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${item.description || ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.amount || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: right; margin-bottom: 20px;">
        <p><strong>Tổng cộng:</strong> ${formatCurrency(invoiceData.totalAmount || selectedInvoice.totalAmount || calculateTotal())}</p>
        <p><strong>Đã thanh toán:</strong> ${formatCurrency(invoiceData.paidAmount || selectedInvoice.paidAmount || formData.paidAmount || 0)}</p>
        <p><strong>Còn lại:</strong> ${formatCurrency((invoiceData.totalAmount || selectedInvoice.totalAmount || calculateTotal()) - (invoiceData.paidAmount || selectedInvoice.paidAmount || formData.paidAmount || 0))}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>Trạng thái:</strong> ${getStatusLabel(invoiceData.status || selectedInvoice.status || formData.status)}</p>
        ${(invoiceData.notes || selectedInvoice.notes || formData.notes) ? `<p><strong>Ghi chú:</strong> ${invoiceData.notes || selectedInvoice.notes || formData.notes}</p>` : ''}
      </div>
      
      <div style="display: flex; justify-content: space-around; margin-top: 40px; text-align: center;">
        <div>
          <p><strong>Người lập hóa đơn</strong></p>
          <p style="font-size: 12px;">(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <p><strong>Khách hàng</strong></p>
          <p style="font-size: 12px;">(Ký, ghi rõ họ tên)</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(invoiceElement);
    
    try {
      const canvas = await html2canvas(invoiceElement, { 
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      const xPos = (pdfWidth - canvasWidth * ratio) / 2;
      const yPos = 0;
      
      pdf.addImage(imgData, 'PNG', xPos, yPos, canvasWidth * ratio, canvasHeight * ratio);
      pdf.save(`hoa-don-${invoiceData.invoiceNumber || selectedInvoice.invoiceNumber || 'invoice'}.pdf`);
      
      document.body.removeChild(invoiceElement);
    } catch (err) {
      console.error('Error generating PDF:', err);
      document.body.removeChild(invoiceElement);
      alert('Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.');
    }
  };

  const {
    currentItems: paginatedInvoices,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(filteredInvoices);

  const renderInvoiceForm = () => (
    <form onSubmit={handleSubmit} className="invoice-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="customerId">Khách hàng <span className="required">*</span></label>
          <select
            id="customerId"
            name="customerId"
            value={formData.customerId}
            onChange={handleChange}
            required
          >
            <option value="">-- Chọn khách hàng --</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} - {customer.phone}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="apartment">Căn hộ <span className="required">*</span></label>
          <select
            id="apartment"
            name="apartmentId"
            value={formData.apartmentId}
            onChange={handleChange}
            required
            disabled={!formData.customerId || filteredApartments.length === 0}
          >
            <option value="">-- Chọn căn hộ --</option>
            {filteredApartments.map(apt => (
              <option key={apt.id} value={apt.id}>
                {apt.name} - {apt.block}, Tầng {apt.floor}, {apt.area}m²
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="issueDate">Ngày phát hành <span className="required">*</span></label>
          <input
            type="date"
            id="issueDate"
            name="issueDate"
            value={formData.issueDate}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="dueDate">Ngày đến hạn <span className="required">*</span></label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      
      <h3>Các mục hóa đơn</h3>
      
      {formData.items.map((item, index) => (
        <div className="invoice-item" key={index}>
          <div className="form-row">
            <div className="form-group flex-grow">
              <label htmlFor={`item-desc-${index}`}>Mô tả <span className="required">*</span></label>
              <input
                type="text"
                id={`item-desc-${index}`}
                value={item.description}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ minWidth: '200px' }}>
              <label htmlFor={`item-category-${index}`}>Danh mục <span className="required">*</span></label>
              <select
                id={`item-category-${index}`}
                value={item.categoryId}
                onChange={(e) => handleItemChange(index, 'categoryId', e.target.value)}
                required
              >
                <option value="">-- Chọn danh mục thu --</option>
                {categories.map(cat => (
                  <option key={cat.id || cat.Id} value={cat.id || cat.Id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor={`item-amount-${index}`}>Số tiền <span className="required">*</span></label>
              <input
                type="number"
                id={`item-amount-${index}`}
                value={item.amount}
                onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                min="0"
                step="1000"
                required
              />
            </div>
            
            {formData.items.length > 1 && (
              <button 
                type="button" 
                className="remove-item-btn"
                onClick={() => removeItem(index)}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
      
      <div className="add-item-container">
        <button 
          type="button" 
          className="add-item-btn"
          onClick={addItem}
        >
          + Thêm mục
        </button>
      </div>
      
      <div className="invoice-total">
        <span className="total-label">Tổng cộng:</span>
        <span className="total-amount">{formatCurrency(calculateTotal())}</span>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="paidAmount">Số tiền đã thanh toán</label>
          <input
            type="number"
            id="paidAmount"
            name="paidAmount"
            value={formData.paidAmount}
            onChange={handleChange}
            min="0"
            step="1000"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="paidDate">Ngày thanh toán</label>
          <input
            type="date"
            id="paidDate"
            name="paidDate"
            value={formData.paidDate}
            onChange={handleChange}
            disabled={!formData.paidAmount}
          />
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="status">Trạng thái</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="pending">Chờ thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
            <option value="paid">Đã thanh toán</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="notes">Ghi chú</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
          />
        </div>
      </div>
      
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {selectedInvoice ? 'Cập nhật hóa đơn' : 'Tạo hóa đơn'}
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => setShowInvoiceModal(false)}
        >
          Hủy
        </button>
      </div>
    </form>
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
      <div className="invoice-management">
        <div className="page-header-wrapper mb-4">
          <PageHeader 
            title="Quản lý hóa đơn" 
            buttonText="Tạo hóa đơn mới"
            onButtonClick={openCreateModal}
          />
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="invoice-filters">
          <div className="filter-row">
            <div className="filter-item">
              <label htmlFor="status-filter">Trạng thái</label>
              <select
                id="status-filter"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="all">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="partial">Thanh toán một phần</option>
                <option value="pending">Chờ thanh toán</option>
                <option value="overdue">Quá hạn</option>
              </select>
            </div>
            
            <div className="filter-item">
              <label htmlFor="date-from">Từ ngày</label>
              <input
                type="date"
                id="date-from"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="filter-item">
              <label htmlFor="date-to">Đến ngày</label>
              <input
                type="date"
                id="date-to"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="filter-item flex-grow">
              <label htmlFor="search-term">Tìm kiếm</label>
              <input
                type="text"
                id="search-term"
                name="searchTerm"
                placeholder="Tìm theo khách hàng, căn hộ, mã hóa đơn..."
                value={filters.searchTerm}
                onChange={handleFilterChange}
              />
            </div>
          </div>
        </div>

        <div className="invoice-summary">
          <div className="summary-card total">
            <span className="label">Tổng số hóa đơn</span>
            <span className="value">{filteredInvoices.length}</span>
          </div>
          
          <div className="summary-card paid">
            <span className="label">Đã thanh toán</span>
            <span className="value">{filteredInvoices.filter(i => i.status === 'paid').length}</span>
          </div>
          
          <div className="summary-card partial">
            <span className="label">Thanh toán một phần</span>
            <span className="value">{filteredInvoices.filter(i => i.status === 'partial').length}</span>
          </div>
          
          <div className="summary-card overdue">
            <span className="label">Quá hạn</span>
            <span className="value">{filteredInvoices.filter(i => i.status === 'overdue').length}</span>
          </div>

          <div className="summary-card total-amount">
            <span className="label">Tổng tiền</span>
            <span className="value">{formatCurrency(filteredInvoices.reduce((sum, invoice) => sum + (parseFloat(invoice.totalAmount) || 0), 0))}</span>
          </div>

          <div className="summary-card total-paid">
            <span className="label">Tổng đã thanh toán</span>
            <span className="value">{formatCurrency(filteredInvoices.reduce((sum, invoice) => sum + (parseFloat(invoice.paidAmount) || 0), 0))}</span>
          </div>
        </div>

        <h2>Danh sách hóa đơn</h2>
        {filteredInvoices.length === 0 ? (
          <div className="no-data">Không có hóa đơn nào</div>
        ) : (
          <div className="data-table-container">
            <div className="data-table-header">
              <h5 className="mb-0">Danh sách hóa đơn</h5>
            </div>
            <div className="table-responsive">
              <table className="data-table table align-middle">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Khách hàng</th>
                    <th>Căn hộ</th>
                    <th>Ngày phát hành</th>
                    <th>Ngày đến hạn</th>
                    <th>Tổng tiền</th>
                    <th>Đã thanh toán</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.length > 0 ? (
                    paginatedInvoices.map((invoice, index) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber || ((currentPage - 1) * 10 + index + 1)}</td>
                        <td>{invoice.customerName}</td>
                        <td>{invoice.apartment}</td>
                        <td>{formatDate(invoice.issueDate)}</td>
                        <td>{formatDate(invoice.dueDate)}</td>
                        <td className="amount-cell">{formatCurrency(invoice.totalAmount)}</td>
                        <td className="amount-cell">{formatCurrency(invoice.paidAmount)}</td>
                        <td>
                          <span className={`status-badge ${getStatusClass(invoice.status)}`}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="actions">
                          <button 
                            className="btn-view" 
                            onClick={() => openEditModal(invoice)}
                            title="Xem chi tiết"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          
                          <button 
                            className={`btn-pay ${invoice.status === 'paid' ? 'btn-disabled' : ''}`}
                            onClick={() => invoice.status !== 'paid' && handleUpdateStatus(invoice, invoice.totalAmount, new Date().toISOString().split('T')[0])}
                            title={invoice.status === 'paid' ? 'Đã thanh toán' : 'Đánh dấu đã thanh toán'}
                            disabled={invoice.status === 'paid'}
                          >
                            <FontAwesomeIcon icon={faCreditCard} />
                          </button>
                          
                          <button 
                            className="btn-delete" 
                            onClick={() => handleDelete(invoice.id)}
                            title="Xóa hóa đơn"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        <div className="empty-state-icon">📄</div>
                        <div className="empty-state-title">Chưa có hóa đơn nào</div>
                        <div>Thêm hóa đơn mới để bắt đầu quản lý</div>
                        <button
                          className="btn btn-sm btn-primary mt-3"
                          onClick={() => setShowInvoiceModal(true)}
                        >
                          Thêm hóa đơn mới
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {invoices.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
              />
            )}
          </div>
        )}
      </div>
      
      {showInvoiceModal && (
        <div className="modal-overlay">
          <div className="invoice-modal">
            <div className="modal-header">
              <h2>{selectedInvoice ? 'Chi tiết hóa đơn' : 'Tạo hóa đơn mới'}</h2>
              <div className="modal-header-actions">
                {selectedInvoice && (
                  <button 
                    className="btn btn-primary export-btn"
                    onClick={exportToPDF}
                    title="Xuất hóa đơn dạng PDF"
                  >
                    Xuất PDF
                  </button>
                )}
                <button 
                  className="close-btn"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  &times;
                </button>
              </div>
            </div>
            
            {renderInvoiceForm()}
          </div>
        </div>
      )}
    </>
  );
};

export default InvoiceManagement;