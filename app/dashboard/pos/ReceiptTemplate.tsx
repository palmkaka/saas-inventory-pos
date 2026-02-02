'use client';

import { useRef } from 'react';

interface OrderItem {
    product_id: string;
    name: string;
    quantity: number;
    price: number;
}

interface Organization {
    name: string;
    address?: string;
    phone?: string;
    tax_id?: string;
    logo_url?: string;
}

interface ReceiptProps {
    orderId: string;
    items: OrderItem[];
    totalAmount: number;
    organization: Organization;
    createdAt: string;
    onClose: () => void;
}

export default function ReceiptTemplate({
    orderId,
    items,
    totalAmount,
    organization,
    createdAt,
    onClose
}: ReceiptProps) {
    const receiptRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    return (
        <>
            {/* Modal Overlay */}
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">ใบเสร็จรับเงิน</h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Receipt Preview */}
                    <div className="bg-white text-black p-6 rounded-lg mb-4 max-h-96 overflow-y-auto">
                        <div ref={receiptRef} className="receipt-content">
                            {/* Header */}
                            <div className="text-center mb-4">
                                {organization.logo_url && (
                                    <img
                                        src={organization.logo_url}
                                        alt={organization.name}
                                        className="w-16 h-16 mx-auto mb-2 object-contain"
                                    />
                                )}
                                <h3 className="text-lg font-bold">{organization.name}</h3>
                                {organization.address && (
                                    <p className="text-xs text-gray-600">{organization.address}</p>
                                )}
                                {organization.phone && (
                                    <p className="text-xs text-gray-600">โทร: {organization.phone}</p>
                                )}
                                {organization.tax_id && (
                                    <p className="text-xs text-gray-600">เลขประจำตัวผู้เสียภาษี: {organization.tax_id}</p>
                                )}
                            </div>

                            <div className="border-t-2 border-dashed border-gray-300 my-3"></div>

                            {/* Order Info */}
                            <div className="text-xs mb-3">
                                <div className="flex justify-between">
                                    <span>เลขที่ออเดอร์:</span>
                                    <span className="font-mono">{orderId.substring(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>วันที่:</span>
                                    <span>{formatDateTime(createdAt)}</span>
                                </div>
                            </div>

                            <div className="border-t-2 border-dashed border-gray-300 my-3"></div>

                            {/* Items */}
                            <table className="w-full text-xs mb-3">
                                <thead>
                                    <tr className="border-b border-gray-300">
                                        <th className="text-left py-1">รายการ</th>
                                        <th className="text-center py-1">จำนวน</th>
                                        <th className="text-right py-1">ราคา</th>
                                        <th className="text-right py-1">รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className="border-b border-gray-200">
                                            <td className="py-1">{item.name}</td>
                                            <td className="text-center">{item.quantity}</td>
                                            <td className="text-right">{formatCurrency(item.price)}</td>
                                            <td className="text-right font-medium">
                                                {formatCurrency(item.price * item.quantity)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="border-t-2 border-dashed border-gray-300 my-3"></div>

                            {/* Total */}
                            <div className="text-sm font-bold flex justify-between mb-4">
                                <span>ยอดรวมทั้งสิ้น:</span>
                                <span className="text-lg">{formatCurrency(totalAmount)}</span>
                            </div>

                            <div className="border-t-2 border-dashed border-gray-300 my-3"></div>

                            {/* Footer */}
                            <div className="text-center text-xs text-gray-600">
                                <p>ขอบคุณที่ใช้บริการ</p>
                                <p className="mt-1">โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐาน</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            พิมพ์ใบเสร็จ
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            ปิด
                        </button>
                    </div>
                </div>
            </div>

            {/* Print-only content */}
            <div className="hidden print:block">
                <div className="receipt-print" style={{ width: '80mm', margin: '0 auto', fontFamily: 'monospace' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                        {organization.logo_url && (
                            <img
                                src={organization.logo_url}
                                alt={organization.name}
                                style={{ width: '60px', height: '60px', margin: '0 auto 8px', objectFit: 'contain' }}
                            />
                        )}
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {organization.name}
                        </div>
                        {organization.address && (
                            <div style={{ fontSize: '10px', color: '#666' }}>{organization.address}</div>
                        )}
                        {organization.phone && (
                            <div style={{ fontSize: '10px', color: '#666' }}>โทร: {organization.phone}</div>
                        )}
                        {organization.tax_id && (
                            <div style={{ fontSize: '10px', color: '#666' }}>เลขประจำตัวผู้เสียภาษี: {organization.tax_id}</div>
                        )}
                    </div>

                    <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }}></div>

                    {/* Order Info */}
                    <div style={{ fontSize: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>เลขที่ออเดอร์:</span>
                            <span>{orderId.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>วันที่:</span>
                            <span>{formatDateTime(createdAt)}</span>
                        </div>
                    </div>

                    <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }}></div>

                    {/* Items */}
                    <table style={{ width: '100%', fontSize: '10px', marginBottom: '8px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #000' }}>
                                <th style={{ textAlign: 'left', padding: '4px 0' }}>รายการ</th>
                                <th style={{ textAlign: 'center', padding: '4px 0' }}>จำนวน</th>
                                <th style={{ textAlign: 'right', padding: '4px 0' }}>ราคา</th>
                                <th style={{ textAlign: 'right', padding: '4px 0' }}>รวม</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td style={{ padding: '4px 0' }}>{item.name}</td>
                                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        {formatCurrency(item.price * item.quantity)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }}></div>

                    {/* Total */}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>ยอดรวมทั้งสิ้น:</span>
                        <span>{formatCurrency(totalAmount)}</span>
                    </div>

                    <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }}></div>

                    {/* Footer */}
                    <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>
                        <p>ขอบคุณที่ใช้บริการ</p>
                        <p style={{ marginTop: '4px' }}>โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐาน</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .receipt-print, .receipt-print * {
                        visibility: visible;
                    }
                    .receipt-print {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 80mm;
                    }
                }
            `}</style>
        </>
    );
}
