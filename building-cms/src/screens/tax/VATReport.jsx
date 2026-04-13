// File: building-cms/src/screens/tax/VATReport.jsx
// Component Báo cáo VAT Tháng
// NÂNG CẤP: Dùng "Thẻ Thống kê" (Stat Cards) giống UI Giao dịch.

import React, { useState } from 'react';
import { Row, Col, Card, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { FaArrowUp, FaArrowDown, FaBalanceScale } from 'react-icons/fa';
import callApi from '../../apis/handleApi';

const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

function VATReport({ apiUrl }) {
    const [month, setMonth] = useState(new Date().getMonth() + 1); // Tháng hiện tại
    const [year, setYear] = useState(new Date().getFullYear()); // Năm hiện tại
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [report, setReport] = useState(null);

    const handleFetchReport = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setReport(null);

        try {
            const data = await callApi(`/taxes/report/vat?month=${month}&year=${year}`);
            setReport(data.data || data); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Tự động chạy báo cáo cho tháng hiện tại khi tải
    return (
        <div>
            {/* Bộ lọc */}
            <Card className="mb-4">
                <Card.Body>
                    <Form onSubmit={handleFetchReport} className="d-flex align-items-end gap-3">
                        <Form.Group controlId="reportMonth">
                            <Form.Label>Tháng</Form.Label>
                            <Form.Control 
                                type="number"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                min="1" max="12"
                                disabled={loading}
                            />
                        </Form.Group>
                        <Form.Group controlId="reportYear">
                            <Form.Label>Năm</Form.Label>
                            <Form.Control 
                                type="number"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                min="2020" max="2100"
                                disabled={loading}
                            />
                        </Form.Group>
                        <Button 
                            variant="success" 
                            type="submit" 
                            disabled={loading}
                            style={{ height: '38px' }}
                        >
                            {loading ? <Spinner animation="border" size="sm" /> : 'Xem Báo Cáo'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
            
            {/* Kết quả */}
            {error && <Alert variant="danger">{error}</Alert>}
            {!report && !loading && (
                <Alert variant="secondary">
                    Hãy chọn kỳ báo cáo và bấm "Xem Báo Cáo". 
                    <br/>
                    Lưu ý: Báo cáo này đọc từ bảng `TransactionTaxes`. Bạn phải chạy "Tính thuế Hóa đơn" (ở Tab 1) trước.
                </Alert>
            )}
            {loading && <div className="text-center"><Spinner animation="border" /> <p>Đang tải báo cáo...</p></div>}

            {/* *** NÂNG CẤP UI: Dùng Thẻ Thống kê (Stat Cards) *** */}
            {report && (
                <div>
                    <h4 className="mb-3">Báo cáo Thuế GTGT - Tháng {report.month}/{report.year}</h4>
                    <Row className="g-4">
                        {/* 1. VAT Đầu Ra */}
                        <Col md={4}>
                            <Card className="stat-card bg-success text-white">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="fw-bold">Tổng VAT Đầu Ra (OUTPUT)</div>
                                        <FaArrowUp size={24} className="opacity-75" />
                                    </div>
                                    <div className="fs-3 fw-bold mt-2">{formatCurrency(report.totalOutputVAT)}</div>
                                    <small className="text-white-50 d-block mt-2">Thuế đầu ra từ doanh thu</small>
                                </Card.Body>
                            </Card>
                        </Col>
                        {/* 2. VAT Đầu Vào */}
                        <Col md={4}>
                            <Card className="stat-card bg-info text-white">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="fw-bold">Tổng VAT Đầu Vào (INPUT)</div>
                                        <FaArrowDown size={24} className="opacity-75" />
                                    </div>
                                    <div className="fs-3 fw-bold mt-2">{formatCurrency(report.totalInputVAT)}</div>
                                    <small className="text-white-50 d-block mt-2">Thuế đầu vào từ chi phí</small>
                                </Card.Body>
                            </Card>
                        </Col>
                        {/* 3. VAT Phải Nộp (NET) */}
                        <Col md={4}>
                            <Card className={`stat-card text-white ${report.netVATPayable >= 0 ? 'bg-danger' : 'bg-warning'}`}>
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="fw-bold">
                                            {report.netVATPayable >= 0 ? 'VAT Phải Nộp (NET)' : 'VAT Được Khấu Trừ'}
                                        </div>
                                        <FaBalanceScale size={24} className="opacity-75" />
                                    </div>
                                    <div className="fs-3 fw-bold mt-2">{formatCurrency(report.netVATPayable)}</div>
                                    <small className="text-white-50 d-block mt-2">
                                        {report.netVATPayable >= 0 
                                            ? 'Số tiền phải nộp cho nhà nước' 
                                            : 'Số tiền được khấu trừ'}
                                    </small>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </div>
            )}
        </div>
    );
}

export default VATReport;