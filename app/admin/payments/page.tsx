import { createAdminClient } from '@/utils/supabase/admin';
import { BadgeCheck, XCircle, Clock, Search, Image as ImageIcon, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import PaymentVerificationModal from './PaymentVerificationModal';

async function getPayments(filter: 'pending' | 'all' = 'pending') {
    const supabase = createAdminClient();

    let query = supabase
        .from('payment_transactions')
        .select(`
            *,
            organizations ( name, subscription_plan )
        `)
        .order('created_at', { ascending: false });

    if (filter === 'pending') {
        query = query.eq('status', 'pending');
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching payments:', error);
        return [];
    }
    return data || [];
}

export default async function AdminPaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const params = await searchParams;
    const tab = (params.tab as 'pending' | 'all') || 'pending';
    const payments = await getPayments(tab);

    // Calculate Stats
    const totalPending = payments.filter(p => p.status === 'pending').length;

    return (
        <div className="p-8 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <BadgeCheck className="text-emerald-400" />
                        ตรวจสอบการชำระเงิน
                    </h1>
                    <p className="text-slate-400 mt-2">อนุมัติรายการโอนเงินและต่ออายุสมาชิก</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-800">
                <a
                    href="/admin/payments?tab=pending"
                    className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${tab === 'pending'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                >
                    <Clock size={16} />
                    รอตรวจสอบ
                    {/* Badge for Pending Count would go here if we fetched all */}
                </a>
                <a
                    href="/admin/payments?tab=all"
                    className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${tab === 'all'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                >
                    <Search size={16} />
                    ประวัติทั้งหมด
                </a>
            </div>

            {/* Payment Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-slate-400 text-sm">
                            <tr>
                                <th className="px-6 py-4">ร้านค้า</th>
                                <th className="px-6 py-4">ยอดโอน</th>
                                <th className="px-6 py-4">วันที่แจ้ง</th>
                                <th className="px-6 py-4">สลิป</th>
                                <th className="px-6 py-4">สถานะ</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {payments.map((tx) => (
                                <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{tx.organizations?.name || 'Unknown Org'}</div>
                                        <div className="text-xs text-slate-500">Plan: {tx.organizations?.subscription_plan}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-emerald-400">฿{tx.amount.toLocaleString()}</div>
                                        <div className="text-xs text-slate-500">{tx.type}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-sm">
                                        {new Date(tx.payment_date).toLocaleString('th-TH')}
                                    </td>
                                    <td className="px-6 py-4">
                                        {tx.slip_url ? (
                                            <a
                                                href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payment-slips/${tx.slip_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                                            >
                                                <ImageIcon size={14} /> ดูรูป
                                            </a>
                                        ) : (
                                            <span className="text-slate-600 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {tx.status === 'pending' && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold">รอตรวจสอบ</span>}
                                        {tx.status === 'approved' && <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold">อนุมัติแล้ว</span>}
                                        {tx.status === 'rejected' && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">ปฏิเสธ</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {tx.status === 'pending' && (
                                            <PaymentVerificationModal transaction={tx} />
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        ไม่พบรายการแจ้งชำระเงิน
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
