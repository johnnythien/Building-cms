// File: building-cms/src/screens/tax/TaxRulesViewer.jsx
// Component xem danh sách Quy tắc Thuế
// Nâng cấp: Sắp xếp theo ưu tiên, hiển thị trạng thái miễn thuế/tính thuế và thuế suất ghi đè.

import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, Table, Badge } from 'react-bootstrap';
import { FaListAlt, FaExclamationTriangle } from 'react-icons/fa';
import callApi from '../../apis/handleApi';

function TaxRulesViewer({ apiUrl }) {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load quy tắc thuế khi component mount
    useEffect(() => {
        const loadRules = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await callApi('/taxes/rules', { method: 'GET' });

                const sortedRules = (data.data || data).sort(
                    (a, b) => (a.Priority || 0) - (b.Priority || 0)
                );

                setRules(sortedRules);
            } catch (err) {
                setError(err.message);
                setRules([]);
            } finally {
                setLoading(false);
            }
        };

        loadRules();
    }, []);

    return (
        <Card>
            <Card.Header as="h5" className="d-flex align-items-center">
                <FaListAlt className="me-2" />
                Danh sách Quy tắc Thuế (Đang áp dụng)
            </Card.Header>

            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}

                {loading && (
                    <div className="text-center">
                        <Spinner animation="border" />
                    </div>
                )}

                {!loading && !error && (
                    <div className="table-responsive">
                        <Table striped bordered hover className="tax-rules-table">
                            <thead>
                                <tr>
                                    <th>Ưu tiên</th>
                                    <th>Danh mục</th>
                                    <th>Loại Thuế</th>
                                    <th>Trạng thái</th>
                                    <th>Thuế suất</th>
                                    <th>Hiệu lực</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rules.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center text-muted py-4">
                                            <FaExclamationTriangle className="mb-2" size={24} />
                                            <div>Không tìm thấy quy tắc thuế nào.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    rules.map(rule => (
                                        <tr key={rule.Id} className={rule.IsExempt ? 'table-success' : ''}>
                                            <td className="text-center">
                                                <Badge bg="secondary">
                                                    {rule.Priority || 0}
                                                </Badge>
                                            </td>

                                            <td>
                                                <strong>{rule.CategoryName || 'N/A'}</strong>
                                                <br />
                                                <small className="text-muted">
                                                    (ID: {rule.CategoryID})
                                                </small>
                                            </td>

                                            <td>
                                                <Badge
                                                    bg={
                                                        rule.TaxDirection === 'INPUT'
                                                            ? 'success'
                                                            : 'danger'
                                                    }
                                                >
                                                    {rule.TaxDirection}
                                                </Badge>
                                                {' '}
                                                {rule.TaxTypeName}
                                            </td>

                                            <td className="text-center">
                                                {rule.IsExempt ? (
                                                    <Badge bg="success">MIỄN THUẾ</Badge>
                                                ) : (
                                                    <Badge bg="primary">TÍNH THUẾ</Badge>
                                                )}
                                            </td>

                                            <td className="text-center fw-bold">
                                                {rule.IsExempt ? (
                                                    /*  Nếu là Miễn thuế -> Luôn hiển thị 0% màu xanh */
                                                    <span className="text-success">0%</span>
                                                ) : (
                                                    /* Nếu phải Tính thuế -> Kiểm tra có ghi đè (Override) không */
                                                    rule.RateOverride !== null ? (
                                                        <span style={{ color: '#d63384' }}>
                                                            {rule.RateOverride}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">
                                                            {rule.DefaultRate || 0}%
                                                        </span>
                                                    )
                                                )}
                                            </td>

                                            <td>
                                                {rule.StartDate
                                                    ? new Date(rule.StartDate).toLocaleDateString('vi-VN')
                                                    : 'N/A'}
                                                <br />
                                                {rule.EndDate
                                                    ? new Date(rule.EndDate).toLocaleDateString('vi-VN')
                                                    : 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
}

export default TaxRulesViewer;
