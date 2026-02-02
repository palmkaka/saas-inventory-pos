'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

interface Transfer {
    id: string;
    created_at: string;
    source_branch: { name: string };
    destination_branch: { name: string };
    product: { name: string; sku: string };
    quantity: number;
    status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
    notes: string;
    created_by_profile: { first_name: string; last_name: string } | null;
}

export default function TransferHistoryPage() {
    const supabase = createClient();
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    const fetchTransfers = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return;

        let query = supabase
            .from('stock_transfers')
            .select(`
                id,
                created_at,
                quantity,
                status,
                notes,
                source_branch:source_branch_id(name),
                destination_branch:destination_branch_id(name),
                product:product_id(name, sku),
                created_by_profile:profiles!stock_transfers_created_by_fkey(first_name, last_name)
            `)
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

        if (filterStatus !== 'ALL') {
            query = query.eq('status', filterStatus);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching transfers:', error);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setTransfers(data as any[] || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTransfers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStatus]);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        let confirmMessage = '';
        switch (newStatus) {
            case 'APPROVED': confirmMessage = 'ยืนยันการอนุมัติการโอนย้าย?'; break;
            case 'REJECTED': confirmMessage = 'ยืนยันการปฏิเสธรายการ?'; break;
            case 'COMPLETED': confirmMessage = 'ยืนยันการรับสินค้าและปรับปรุงสต็อก?'; break;
            default: confirmMessage = `คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะเป็น ${newStatus}?`;
        }

        if (!confirm(confirmMessage)) return;

        const { error } = await supabase
            .from('stock_transfers')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            alert('ไม่สามารถอัปเดตสถานะได้: ' + error.message);
        } else {
            fetchTransfers();
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'APPROVED': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'COMPLETED': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'REJECTED': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'CANCELLED': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
            default: return 'text-slate-400';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return 'รอดำเนินการ';
            case 'APPROVED': return 'อนุมัติแล้ว';
            case 'COMPLETED': return 'เสร็จสมบูรณ์';
            case 'REJECTED': return 'ปฏิเสธ';
            case 'CANCELLED': return 'ยกเลิก';
            default: return status;
        }
    };

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">ประวัติการโอนย้ายสินค้า</h1>
                        <p className="text-slate-400 text-sm mt-1">จัดการการโอนย้ายสินค้าระหว่างสาขา</p>
                    </div>
                    <Link
                        href="/dashboard/inventory/transfer/new"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        สร้างรายการใหม่
                    </Link>
                </div>
            </header>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${filterStatus === status
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                }`}
                        >
                            {status === 'ALL' ? 'ทั้งหมด' : getStatusLabel(status)}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : transfers.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">ไม่พบรายการโอนย้าย</h3>
                        <p className="text-slate-400">เริ่มสร้างรายการโอนย้ายสินค้าใหม่ได้เลย</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {transfers.map((transfer) => (
                            <div key={transfer.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 md:p-6 transition-all hover:bg-slate-800 hover:border-slate-600">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(transfer.status)}`}>
                                                {getStatusLabel(transfer.status)}
                                            </span>
                                            <span className="text-slate-500 text-sm">
                                                {new Date(transfer.created_at).toLocaleDateString('th-TH')} {new Date(transfer.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-white font-medium text-lg mb-1">
                                            <span>{transfer.source_branch?.name || 'ไม่ระบุ'}</span>
                                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                            <span>{transfer.destination_branch?.name || 'ไม่ระบุ'}</span>
                                        </div>
                                        <div className="text-slate-400 text-sm flex items-center gap-2">
                                            <span className="text-blue-400 font-medium">{transfer.product?.name}</span>
                                            <span>•</span>
                                            <span>จำนวน: {transfer.quantity}</span>
                                            {transfer.product?.sku && <span className="text-slate-500">({transfer.product.sku})</span>}
                                        </div>
                                        {transfer.notes && (
                                            <div className="mt-2 text-slate-500 text-sm italic">
                                                "{transfer.notes}"
                                            </div>
                                        )}
                                        {transfer.created_by_profile && (
                                            <div className="mt-1 text-slate-600 text-xs">
                                                ทำรายการโดย: {transfer.created_by_profile.first_name} {transfer.created_by_profile.last_name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {transfer.status === 'PENDING' && (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateStatus(transfer.id, 'APPROVED')}
                                                    className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    อนุมัติ (Approve)
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(transfer.id, 'REJECTED')}
                                                    className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    ปฏิเสธ (Reject)
                                                </button>
                                            </>
                                        )}
                                        {transfer.status === 'APPROVED' && (
                                            <button
                                                onClick={() => handleUpdateStatus(transfer.id, 'COMPLETED')}
                                                className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                ยืนยันรับของ (Complete)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
