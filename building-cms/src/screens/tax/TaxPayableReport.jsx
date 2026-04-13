// File: building-cms/src/screens/tax/TaxPayableReport.jsx
// Component Báo cáo Thuế Phải Nộp Nhà Nước
// NÂNG CẤP: UI chuyên nghiệp, đẹp, dễ sử dụng cho doanh nghiệp

import React, { useState, useEffect } from 'react';
import { 
    Row, Col, Card, Form, Button, Spinner, Alert, Table, Badge,
    InputGroup, ButtonGroup
} from 'react-bootstrap';
import { 
    FaBalanceScale, FaDownload, FaPrint, FaCalendarAlt, 
    FaChartLine, FaFileInvoiceDollar, FaInfoCircle, FaExclamationTriangle,
    FaMoneyBillWave, FaArrowUp, FaArrowDown, FaEquals, FaPercent
} from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import callApi from '../../apis/handleApi';
import './TaxPayableReport.css';

const formatCurrency = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

const formatDate = (month, year) => {
    const monthNames = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    return `${monthNames[month - 1]}/${year}`;
};

function TaxPayableReport() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [report, setReport] = useState(null);

    const handleFetchReport = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        setReport(null);

        try {
            const response = await callApi(`/taxes/report/comprehensive?month=${month}&year=${year}`);
            console.log('Tax Payable Report Response:', response);
            
            const data = response?.data || response;
            console.log('Tax Payable Report Data:', data);

            if (!data || typeof data !== 'object') {
                setError('Dữ liệu trả về không đúng định dạng.');
                return;
            }

            setReport(data);
        } catch (err) {
            console.error('Error fetching tax payable report:', err);
            const errMsg = err?.message || err?.error || 'Không thể tải báo cáo thuế.';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleFetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Export PDF
    const handleExportPDF = async () => {
        if (!report) return;

        try {
            const reportElement = document.getElementById('tax-payable-report-content');
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
            
            const fileName = `bao-cao-thue-phai-nop-${month}-${year}-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('Error exporting PDF:', err);
            alert('Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.');
        }
    };

    // Print
    const handlePrint = () => {
        if (!report) return;
        window.print();
    };

    // Tính tổng thuế phải nộp
    const calculateTotalPayable = () => {
        if (!report) return 0;
        const vatNet = report.vatReport?.net || 0;
        const withholding = report.withholdingTaxReport?.total || 0;
        // VAT Net (nếu > 0) + Thuế thu hộ
        return (vatNet > 0 ? vatNet : 0) + withholding;
    };

    return (
        <div className="container-fluid py-3 tax-payable-report-container">
            {/* Header */}
            <div className="mb-3">
                <h4 className="mb-1 fw-bold text-dark d-flex align-items-center">
                    <FaFileInvoiceDollar className="me-2" style={{ color: '#4f46e5' }} />
                    Báo Cáo Thuế Phải Nộp Nhà Nước
                </h4>
                <p className="text-muted small mb-0">Xem báo cáo tổng hợp thuế phải nộp theo tháng/năm</p>
            </div>

            {/* Filter Section */}
            <Card className="shadow-sm border mb-3" style={{ borderRadius: '6px' }}>
                <Card.Body className="p-3">
                    <Form onSubmit={handleFetchReport}>
                        <Row className="g-2 align-items-end">
                            <Col md={3}>
                                <Form.Label className="fw-semibold small text-dark mb-1">
                                    <FaCalendarAlt className="me-1" />
                                    Tháng
                                </Form.Label>
                                <Form.Select
                                    value={month}
                                    onChange={(e) => setMonth(parseInt(e.target.value))}
                                    disabled={loading}
                                    style={{ borderRadius: '4px' }}
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>
                                            Tháng {m}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col md={3}>
                                <Form.Label className="fw-semibold small text-dark mb-1">Năm</Form.Label>
                                <Form.Control
                                    type="number"
                                    value={year}
                                    min="2020"
                                    max="2100"
                                    disabled={loading}
                                    onChange={(e) => setYear(parseInt(e.target.value))}
                                    style={{ borderRadius: '4px' }}
                                />
                            </Col>
                            <Col md={4}>
                                <Button 
                                    variant="primary" 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-100 fw-semibold"
                                    style={{ borderRadius: '4px' }}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Đang tải...
                                        </>
                                    ) : (
                                        <>
                                            <FaChartLine className="me-2" />
                                            Xem Báo Cáo
                                        </>
                                    )}
                                </Button>
                            </Col>
                            {report && (
                                <Col md={2}>
                                    <ButtonGroup className="w-100">
                                        <Button 
                                            variant="outline-secondary" 
                                            onClick={handleExportPDF}
                                            style={{ borderRadius: '4px 0 0 4px' }}
                                        >
                                            <FaDownload />
                                        </Button>
                                        <Button 
                                            variant="outline-secondary" 
                                            onClick={handlePrint}
                                            style={{ borderRadius: '0 4px 4px 0' }}
                                        >
                                            <FaPrint />
                                        </Button>
                                    </ButtonGroup>
                                </Col>
                            )}
                        </Row>
                    </Form>
                </Card.Body>
            </Card>

            {/* Errors */}
            {error && (
                <Alert variant="danger" className="d-flex align-items-center mb-3" style={{ borderRadius: '6px' }}>
                    <FaExclamationTriangle className="me-2" />
                    <span className="text-dark">{error}</span>
                </Alert>
            )}

            {/* Empty State */}
            {!report && !loading && !error && (
                <Card className="border shadow-sm" style={{ borderRadius: '6px' }}>
                    <Card.Body className="text-center py-4">
                        <FaFileInvoiceDollar size={48} className="text-muted mb-2" />
                        <p className="text-muted mb-0 small">Hãy chọn kỳ báo cáo và bấm "Xem Báo Cáo" để xem kết quả.</p>
                    </Card.Body>
                </Card>
            )}

            {/* Loading State */}
            {loading && (
                <Card className="border shadow-sm" style={{ borderRadius: '6px' }}>
                    <Card.Body className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted small mb-0">Đang tải báo cáo...</p>
                    </Card.Body>
                </Card>
            )}

            {/* Report Content */}
            {report && (
                <div id="tax-payable-report-content">
                    {/* Report Title */}
                    <div className="mb-3">
                        <h5 className="fw-bold text-dark mb-1">
                            Báo Cáo Thuế Phải Nộp Nhà Nước
                        </h5>
                        <p className="text-muted small mb-0">
                            {formatDate(report.month, report.year)}
                        </p>
                    </div>

                    {/* KPI Cards Row - 4 Mini Stat Cards */}
                    <Row className="g-3 mb-3">
                        {/* Card 1: Tổng Phải Nộp */}
                        <Col md={3} sm={6}>
                            <Card className="border shadow-sm h-100 enterprise-stat-card" style={{ borderRadius: '6px' }}>
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon me-3" style={{ color: '#dc2626' }}>
                                            <FaMoneyBillWave size={24} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="stat-value text-dark fw-bold mb-1" style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>
                                                {formatCurrency(calculateTotalPayable())}
                                            </div>
                                            <div className="stat-label text-muted small">Tổng Phải Nộp</div>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Card 2: VAT Đầu Vào */}
                        <Col md={3} sm={6}>
                            <Card className="border shadow-sm h-100 enterprise-stat-card" style={{ borderRadius: '6px' }}>
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon me-3" style={{ color: '#2563eb' }}>
                                            <FaArrowDown size={24} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="stat-value text-dark fw-bold mb-1" style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>
                                                {formatCurrency(report.vatReport?.input || 0)}
                                            </div>
                                            <div className="stat-label text-muted small">VAT Đầu Vào</div>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Card 3: Thuế Thu Hộ */}
                        <Col md={3} sm={6}>
                            <Card className="border shadow-sm h-100 enterprise-stat-card" style={{ borderRadius: '6px' }}>
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon me-3" style={{ color: '#ea580c' }}>
                                            <FaPercent size={24} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="stat-value text-dark fw-bold mb-1" style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>
                                                {formatCurrency(report.withholdingTaxReport?.total || 0)}
                                            </div>
                                            <div className="stat-label text-muted small">Thuế Thu Hộ</div>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Card 4: VAT Net/Refund */}
                        <Col md={3} sm={6}>
                            <Card className="border shadow-sm h-100 enterprise-stat-card" style={{ borderRadius: '6px' }}>
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon me-3" style={{ color: (report.vatReport?.net || 0) >= 0 ? '#dc2626' : '#059669' }}>
                                            <FaBalanceScale size={24} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className={`stat-value fw-bold mb-1 ${(report.vatReport?.net || 0) >= 0 ? 'text-danger' : 'text-success'}`} style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>
                                                {formatCurrency(report.vatReport?.net || 0)}
                                            </div>
                                            <div className="stat-label text-muted small">VAT Net</div>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    {/* Detailed Tables - Side by Side */}
                    {(report.outputDetails || report.inputDetails) && (
                        <Row className="g-3 mb-3">
                            {/* VAT Output & Withholding Table */}
                            <Col md={6}>
                                <Card className="border shadow-sm" style={{ borderRadius: '6px' }}>
                                    <Card.Header className="bg-light border-bottom" style={{ borderRadius: '6px 6px 0 0' }}>
                                        <div className="d-flex align-items-center">
                                            <FaArrowUp className="me-2 text-success" />
                                            <strong className="text-dark">Thuế Đầu Ra & Thu Hộ</strong>
                                        </div>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        <div className="table-responsive">
                                            <Table size="sm" className="mb-0">
                                                <thead className="bg-light">
                                                    <tr>
                                                        <th className="text-dark fw-bold" style={{ width: '40px', fontSize: '0.75rem' }}>#</th>
                                                        <th className="text-dark fw-bold" style={{ fontSize: '0.75rem' }}>Loại</th>
                                                        <th className="text-dark fw-bold" style={{ fontSize: '0.75rem' }}>Mã</th>
                                                        <th className="text-end text-dark fw-bold" style={{ fontSize: '0.75rem' }}>Số Tiền</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(!report.outputDetails || report.outputDetails.length === 0) ? (
                                                        <tr>
                                                            <td colSpan={4} className="text-center text-muted py-3 small">
                                                                Không có dữ liệu
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        report.outputDetails.map((tax, idx) => (
                                                            <tr key={`out-${idx}`}>
                                                                <td className="text-center">
                                                                    <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>{idx + 1}</span>
                                                                </td>
                                                                <td className="text-dark small">{tax.type}</td>
                                                                <td>
                                                                    <code className="bg-light px-1 py-0 rounded small" style={{ fontSize: '0.7rem' }}>{tax.code}</code>
                                                                </td>
                                                                <td className="text-end fw-bold text-dark small" style={{ fontFamily: 'monospace' }}>
                                                                    {formatCurrency(tax.amount)}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                <tfoot className="bg-light">
                                                    <tr>
                                                        <th colSpan={3} className="text-end text-dark fw-bold small">TỔNG CỘNG</th>
                                                        <th className="text-end text-dark fw-bold small" style={{ fontFamily: 'monospace' }}>
                                                            {formatCurrency(
                                                                (report.vatReport?.output || 0) +
                                                                (report.withholdingTaxReport?.total || 0)
                                                            )}
                                                        </th>
                                                    </tr>
                                                </tfoot>
                                            </Table>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>

                            {/* VAT Input Table */}
                            <Col md={6}>
                                <Card className="border shadow-sm" style={{ borderRadius: '6px' }}>
                                    <Card.Header className="bg-light border-bottom" style={{ borderRadius: '6px 6px 0 0' }}>
                                        <div className="d-flex align-items-center">
                                            <FaArrowDown className="me-2 text-info" />
                                            <strong className="text-dark">Thuế Đầu Vào</strong>
                                        </div>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        <div className="table-responsive">
                                            <Table size="sm" className="mb-0">
                                                <thead className="bg-light">
                                                    <tr>
                                                        <th className="text-dark fw-bold" style={{ width: '40px', fontSize: '0.75rem' }}>#</th>
                                                        <th className="text-dark fw-bold" style={{ fontSize: '0.75rem' }}>Loại</th>
                                                        <th className="text-dark fw-bold" style={{ fontSize: '0.75rem' }}>Mã</th>
                                                        <th className="text-end text-dark fw-bold" style={{ fontSize: '0.75rem' }}>Số Tiền</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(!report.inputDetails || report.inputDetails.length === 0) ? (
                                                        <tr>
                                                            <td colSpan={4} className="text-center text-muted py-3 small">
                                                                Không có dữ liệu
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        report.inputDetails.map((tax, idx) => (
                                                            <tr key={`in-${idx}`}>
                                                                <td className="text-center">
                                                                    <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>{idx + 1}</span>
                                                                </td>
                                                                <td className="text-dark small">{tax.type}</td>
                                                                <td>
                                                                    <code className="bg-light px-1 py-0 rounded small" style={{ fontSize: '0.7rem' }}>{tax.code}</code>
                                                                </td>
                                                                <td className="text-end fw-bold text-dark small" style={{ fontFamily: 'monospace' }}>
                                                                    {formatCurrency(tax.amount)}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                <tfoot className="bg-light">
                                                    <tr>
                                                        <th colSpan={3} className="text-end text-dark fw-bold small">TỔNG CỘNG</th>
                                                        <th className="text-end text-dark fw-bold small" style={{ fontFamily: 'monospace' }}>
                                                            {formatCurrency(report.vatReport?.input || 0)}
                                                        </th>
                                                    </tr>
                                                </tfoot>
                                            </Table>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Important Note */}
                    {report && (
                        <Alert variant="warning" className="mb-0 d-flex align-items-start" style={{ borderRadius: '6px' }}>
                            <FaInfoCircle className="me-2 mt-1" size={16} />
                            <div className="small">
                                <strong className="text-dark">Lưu ý quan trọng:</strong>
                                <ul className="mb-0 mt-2 small">
                                    <li className="text-dark">Thuế thu hộ (VAT_RENTAL + PIT_RENTAL) <strong>không thể bù trừ</strong> với VAT_INPUT.</li>
                                    <li className="text-dark">Thuế thu hộ phải được nộp riêng biệt, không được khấu trừ vào VAT đầu vào.</li>
                                    <li className="text-dark">VAT ròng = VAT Đầu ra - VAT Đầu vào (có thể âm nếu được hoàn).</li>
                                </ul>
                            </div>
                        </Alert>
                    )}
                </div>
            )}
        </div>
    );
}

export default TaxPayableReport;
