// File: client/src/screens/tax/components/InvoiceTaxCalculator.jsx
// Component Tính thuế cho Hóa đơn
// NÂNG CẤP: UI chuyên nghiệp, dễ sử dụng cho doanh nghiệp

import React, { useState, useEffect } from 'react';
import { 
    Row, Col, Card, Form, Button, Spinner, Alert, Badge, Table,
    InputGroup, ButtonGroup, Dropdown
} from 'react-bootstrap';
import { 
    FaFileInvoice, FaCheckCircle, FaInfoCircle, FaDownload, 
    FaPrint, FaCalculator, FaSearch, FaChartLine, FaFileAlt,
    FaMoneyBillWave, FaPercent, FaCalendarAlt
} from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import callApi from '../../apis/handleApi';
import './InvoiceTaxCalculator.css';

const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
};

function InvoiceTaxCalculator() {
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingInvoices, setLoadingInvoices] = useState(true);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
  
    // Tải danh sách hóa đơn
    useEffect(() => {
        const loadInvoices = async () => {
            try {
                setLoadingInvoices(true);
                setError(null);
                
                const response = await callApi('/invoices');
                const invoiceData = response;

                if (!Array.isArray(invoiceData)) {
                    throw new Error("API /invoices không trả về một mảng (array)");
                }

                // Sắp xếp theo ngày mới nhất
                const sortedInvoices = invoiceData.sort((a, b) => {
                    const dateA = new Date(a.issueDate || a.createdAt || 0);
                    const dateB = new Date(b.issueDate || b.createdAt || 0);
                    return dateB - dateA;
                });

                setInvoices(sortedInvoices); 
                
                if (sortedInvoices.length > 0) {
                    setSelectedInvoiceId(sortedInvoices[0].id);
                    setSelectedInvoice(sortedInvoices[0]);
                } else {
                    setError("Không tìm thấy hóa đơn nào.");
                }
            } catch (err) {
                setError(`Không thể tải danh sách hóa đơn: ${err.message}. Đảm bảo API /invoices đang chạy.`);
                setInvoices([]);
            } finally {
                setLoadingInvoices(false);
            }
        };
        
        loadInvoices();
    }, []);

    // Cập nhật selectedInvoice khi selectedInvoiceId thay đổi
    useEffect(() => {
        if (selectedInvoiceId && invoices.length > 0) {
            const invoice = invoices.find(inv => inv.id === parseInt(selectedInvoiceId));
            setSelectedInvoice(invoice || null);
            setResult(null);
        }
    }, [selectedInvoiceId, invoices]);

    // Lọc hóa đơn theo search term
    const filteredInvoices = invoices.filter(inv => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            inv.invoiceNumber?.toLowerCase().includes(term) ||
            inv.customerName?.toLowerCase().includes(term) ||
            formatCurrency(inv.totalAmount).toLowerCase().includes(term)
        );
    });
  
    // Xử lý tính thuế
    async function handleSubmit(e) {
        e.preventDefault();
        if (!selectedInvoiceId) {
            setError('Vui lòng chọn một hóa đơn.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await callApi(
                `/taxes/calculate/invoice/${selectedInvoiceId}`, 
                null, 
                'POST'
            );
            
            setResult(data.data || data);
        
        } catch (err) {
            setError(`Lỗi khi tính thuế: ${err.message}`); 
        } finally {
            setLoading(false);
        }
    }

    // Tính tổng thuế
    const calculateTotalTax = () => {
        if (!result || !result.summary) return 0;
        return result.summary.reduce((sum, tax) => sum + (tax.TotalTaxAmount || 0), 0);
    };

    // Tính tổng tiền gốc
    const calculateTotalBase = () => {
        if (!result || !result.summary) return 0;
        return result.summary.reduce((sum, tax) => sum + (tax.TotalBaseAmount || 0), 0);
    };

    // Export PDF
    const handleExportPDF = async () => {
        if (!result) return;

        try {
            const reportElement = document.getElementById('tax-report-content');
            if (!reportElement) {
                alert('Không tìm thấy nội dung báo cáo.');
                return;
            }

            const canvas = await html2canvas(reportElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

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
            
            const fileName = `tinh-thue-hoa-don-${selectedInvoice?.invoiceNumber || selectedInvoiceId}-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('Error exporting PDF:', err);
            alert('Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.');
        }
    };

    // Print
    const handlePrint = () => {
        if (!result) return;
        window.print();
    };

    return (
        <div className="container-fluid py-4">
            <div className="mb-4">
                <h2 className="mb-2 d-flex align-items-center">
                    <FaCalculator className="me-3 text-primary" />
                    Tính Thuế Hóa Đơn
                </h2>
                <p className="text-muted">Chọn hóa đơn và tính toán thuế tự động theo quy định hiện hành</p>
            </div>

            <Row className="g-4">
                {/* Form Chọn Hóa Đơn */}
                <Col lg={4}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-primary text-white d-flex align-items-center">
                            <FaFileInvoice className="me-2" size={20} />
                            <span className="fw-bold">1. Chọn Hóa Đơn</span>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Form onSubmit={handleSubmit}>
                                {/* Search */}
                                <Form.Group className="mb-3">
                                    <InputGroup>
                                        <InputGroup.Text>
                                            <FaSearch />
                                        </InputGroup.Text>
                                        <Form.Control
                                            type="text"
                                            placeholder="Tìm kiếm hóa đơn..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </InputGroup>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold">
                                        <FaFileAlt className="me-2" />
                                        Hóa đơn
                                    </Form.Label>
                                    {loadingInvoices ? (
                                        <div className="text-center py-3">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            <span>Đang tải...</span>
                                        </div>
                                    ) : (
                                        <Form.Select 
                                            value={selectedInvoiceId} 
                                            onChange={(e) => {
                                                setSelectedInvoiceId(e.target.value);
                                                setResult(null);
                                                setError(null);
                                            }}
                                            disabled={loading || invoices.length === 0}
                                            className="form-select-lg"
                                        >
                                            <option value="">-- {invoices.length === 0 ? "Không có hóa đơn" : "Chọn hóa đơn"} --</option>
                                            {filteredInvoices.map(inv => (
                                                <option key={inv.id} value={inv.id}>
                                                    {inv.invoiceNumber} - {formatCurrency(inv.totalAmount)}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    )}
                                </Form.Group>

                                {/* Invoice Info */}
                                {selectedInvoice && (
                                    <Card className="bg-light mb-3">
                                        <Card.Body className="p-3">
                                            <div className="small">
                                                <div className="mb-2">
                                                    <strong>Số hóa đơn:</strong> {selectedInvoice.invoiceNumber}
                                                </div>
                                                <div className="mb-2">
                                                    <strong>Ngày phát hành:</strong> {formatDate(selectedInvoice.issueDate)}
                                                </div>
                                                <div className="mb-2">
                                                    <strong>Tổng tiền:</strong> 
                                                    <span className="text-primary fw-bold ms-2">
                                                        {formatCurrency(selectedInvoice.totalAmount)}
                                                    </span>
                                                </div>
                                                {selectedInvoice.customerName && (
                                                    <div>
                                                        <strong>Khách hàng:</strong> {selectedInvoice.customerName}
                                                    </div>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Card>
                                )}
                                
                                <Button 
                                    variant="primary" 
                                    type="submit" 
                                    className="w-100 py-2 fw-semibold"
                                    disabled={loading || !selectedInvoiceId}
                                    size="lg"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Đang tính toán...
                                        </>
                                    ) : (
                                        <>
                                            <FaCalculator className="me-2" />
                                            Tính Thuế
                                        </>
                                    )}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Kết quả */}
                <Col lg={8}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-success text-white d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                                <FaCheckCircle className="me-2" size={20} />
                                <span className="fw-bold">2. Kết Quả Tính Thuế</span>
                            </div>
                            {result && (
                                <ButtonGroup size="sm">
                                    <Button variant="light" onClick={handleExportPDF}>
                                        <FaDownload className="me-1" />
                                        Xuất PDF
                                    </Button>
                                    <Button variant="light" onClick={handlePrint}>
                                        <FaPrint className="me-1" />
                                        In
                                    </Button>
                                </ButtonGroup>
                            )}
                        </Card.Header>
                        <Card.Body className="p-4">
                            {error && (
                                <Alert variant="danger" className="d-flex align-items-center">
                                    <FaInfoCircle className="me-2" />
                                    {error}
                                </Alert>
                            )}
                            
                            {!result && !loading && !error && (
                                <div className="text-center py-5">
                                    <FaFileInvoice size={64} className="text-muted mb-3" />
                                    <p className="text-muted">Hãy chọn hóa đơn và bấm "Tính Thuế" để xem kết quả.</p>
                                </div>
                            )}

                            {loading && (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" size="lg" />
                                    <p className="mt-3 text-muted">Đang tính toán thuế...</p>
                                </div>
                            )}
                            
                            {result && (
                                <div id="tax-report-content">
                                    {/* Success Alert */}
                                    <Alert variant="success" className="d-flex align-items-center mb-4">
                                        <FaCheckCircle className="me-2" size={20} />
                                        <div>
                                            <strong>Thành công!</strong> Đã xử lý <strong>{result.transactionsProcessed || 0}</strong> giao dịch cho Hóa đơn <strong>{selectedInvoice?.invoiceNumber || result.invoiceId}</strong>.
                                        </div>
                                    </Alert>

                                    {/* Summary Cards */}
                                    <Row className="g-3 mb-4">
                                        <Col md={4}>
                                            <Card className="border-0 shadow-sm bg-gradient" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                                                <Card.Body className="text-white">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <div className="small opacity-75">Tổng Tiền Gốc</div>
                                                            <h4 className="mb-0 fw-bold">{formatCurrency(calculateTotalBase())}</h4>
                                                        </div>
                                                        <FaMoneyBillWave size={32} className="opacity-50" />
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col md={4}>
                                            <Card className="border-0 shadow-sm bg-gradient" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                                                <Card.Body className="text-white">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <div className="small opacity-75">Tổng Thuế</div>
                                                            <h4 className="mb-0 fw-bold">{formatCurrency(calculateTotalTax())}</h4>
                                                        </div>
                                                        <FaPercent size={32} className="opacity-50" />
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col md={4}>
                                            <Card className="border-0 shadow-sm bg-gradient" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                                                <Card.Body className="text-white">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <div className="small opacity-75">Số Giao Dịch</div>
                                                            <h4 className="mb-0 fw-bold">{result.transactionsProcessed || 0}</h4>
                                                        </div>
                                                        <FaChartLine size={32} className="opacity-50" />
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    </Row>

                                    {/* Tax Summary */}
                                    <Card className="mb-4 border-0 shadow-sm">
                                        <Card.Header className="bg-light d-flex align-items-center">
                                            <FaInfoCircle className="me-2 text-primary" />
                                            <strong>Tóm Tắt Thuế Theo Loại</strong>
                                        </Card.Header>
                                        <Card.Body>
                                            {(!result.summary || result.summary.length === 0) ? (
                                                <Alert variant="warning" className="mb-0">
                                                    Không phát sinh thuế cho hóa đơn này.
                                                </Alert>
                                            ) : (
                                                <div className="table-responsive">
                                                    <Table hover className="mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Loại Thuế</th>
                                                                <th className="text-end">Tiền Gốc</th>
                                                                <th className="text-end">Tiền Thuế</th>
                                                                <th className="text-center">Hướng</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {result.summary.map(tax => (
                                                                <tr key={tax.TaxTypeID}>
                                                                    <td>
                                                                        <strong>{tax.TaxTypeName}</strong>
                                                                    </td>
                                                                    <td className="text-end fw-semibold">
                                                                        {formatCurrency(tax.TotalBaseAmount)}
                                                                    </td>
                                                                    <td className="text-end">
                                                                        <Badge 
                                                                            bg={tax.TaxDirection === 'INPUT' ? 'success' : 'danger'} 
                                                                            className="px-3 py-2"
                                                                        >
                                                                            {formatCurrency(tax.TotalTaxAmount)}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="text-center">
                                                                        <Badge bg={tax.TaxDirection === 'INPUT' ? 'info' : 'warning'}>
                                                                            {tax.TaxDirection === 'INPUT' ? 'Đầu vào' : 'Đầu ra'}
                                                                        </Badge>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                            )}
                                        </Card.Body>
                                    </Card>
                                    
                                    {/* Transaction Details */}
                                    <Card className="border-0 shadow-sm">
                                        <Card.Header className="bg-light d-flex align-items-center">
                                            <FaFileAlt className="me-2 text-primary" />
                                            <strong>Chi Tiết Giao Dịch</strong>
                                        </Card.Header>
                                        <Card.Body>
                                            <div className="table-responsive">
                                                <Table striped bordered hover className="mb-0">
                                                    <thead className="table-dark">
                                                        <tr>
                                                            <th className="text-center" style={{ width: '80px' }}>ID</th>
                                                            <th>Mô Tả</th>
                                                            <th>Loại Thuế</th>
                                                            <th className="text-end">Tiền Gốc</th>
                                                            <th className="text-center" style={{ width: '100px' }}>Thuế Suất</th>
                                                            <th className="text-end">Tiền Thuế</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(!result.details || result.details.length === 0) ? (
                                                            <tr>
                                                                <td colSpan={6} className="text-center text-muted py-4">
                                                                    Không có chi tiết giao dịch.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            result.details.map((detail, i) => (
                                                                <tr key={i}>
                                                                    <td className="text-center">
                                                                        <Badge bg="secondary">{detail.TransactionID}</Badge>
                                                                    </td>
                                                                    <td>{detail.TransactionDescription}</td>
                                                                    <td>
                                                                        <Badge bg={detail.TaxDirection === 'INPUT' ? 'success' : 'danger'}>
                                                                            {detail.TaxTypeName}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="text-end fw-semibold">
                                                                        {formatCurrency(detail.BaseAmount)}
                                                                    </td>
                                                                    <td className="text-center">
                                                                        {detail.IsExempt ? (
                                                                            <Badge bg="warning">MIỄN</Badge>
                                                                        ) : (
                                                                            <Badge bg="info">{detail.AppliedRate || 0}%</Badge>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-end fw-bold text-primary">
                                                                        {formatCurrency(detail.TaxAmount)}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default InvoiceTaxCalculator;
