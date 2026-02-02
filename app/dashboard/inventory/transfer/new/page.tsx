'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

interface Branch {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    sku: string | null;
    current_stock: number; // Stock at source branch
}

export default function NewTransferPage() {
    const supabase = createClient();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data needed
    const [branches, setBranches] = useState<Branch[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Form Selection
    const [sourceBranchId, setSourceBranchId] = useState<string>('');
    const [destBranchId, setDestBranchId] = useState<string>('');
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('');
    const [notes, setNotes] = useState('');

    const [userBranchId, setUserBranchId] = useState<string | null>(null);
    const [isOwnerOrManager, setIsOwnerOrManager] = useState(false);

    // Load initial data (User profile, Branches)
    useEffect(() => {
        async function loadInitialData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, branch_id, role')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) return;

            setUserBranchId(profile.branch_id);
            setIsOwnerOrManager(['owner', 'manager'].includes(profile.role));

            // Set default source branch
            if (profile.branch_id) {
                setSourceBranchId(profile.branch_id);
            }

            // Fetch Branches
            const { data: branchData } = await supabase
                .from('branches')
                .select('id, name, is_main')
                .eq('organization_id', profile.organization_id)
                .order('is_main', { ascending: false }) // Main first
                .order('name');

            if (branchData) {
                setBranches(branchData);
                // If user has no branch (e.g. owner), default to Main
                if (!profile.branch_id && branchData.length > 0) {
                    const main = branchData.find(b => b.is_main) || branchData[0];
                    setSourceBranchId(main.id);
                }
            }
        }
        loadInitialData();
    }, [supabase]);

    // Fetch Products when Source Branch changes
    useEffect(() => {
        async function fetchSourceProducts() {
            if (!sourceBranchId) {
                setProducts([]);
                return;
            }

            // Fetch products with stock > 0 at source branch
            const { data, error } = await supabase
                .from('products')
                .select(`
                    id, name, sku,
                    product_stocks!inner (quantity, branch_id)
                `)
                .eq('product_stocks.branch_id', sourceBranchId)
                .gt('product_stocks.quantity', 0)
                .order('name');

            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mapped = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    current_stock: p.product_stocks[0]?.quantity || 0
                }));
                setProducts(mapped);
            }
        }

        fetchSourceProducts();
    }, [sourceBranchId, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceBranchId || !destBranchId || !selectedProductId || !quantity) {
            setError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        if (sourceBranchId === destBranchId) {
            setError('สาขาต้นทางและปลายทางต้องไม่ซ้ำกัน');
            return;
        }

        const qty = parseInt(quantity);
        if (qty <= 0) {
            setError('จำนวนต้องมากกว่า 0');
            return;
        }

        const selectedProduct = products.find(p => p.id === selectedProductId);
        if (selectedProduct && qty > selectedProduct.current_stock) {
            setError(`สินค้าไม่เพียงพอ (มีอยู่: ${selectedProduct.current_stock})`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single();

            const { error: insertError } = await supabase
                .from('stock_transfers')
                .insert({
                    organization_id: profile?.organization_id,
                    source_branch_id: sourceBranchId,
                    destination_branch_id: destBranchId,
                    product_id: selectedProductId,
                    quantity: qty,
                    status: 'PENDING', // Require approval
                    notes: notes,
                    created_by: user?.id
                });

            if (insertError) throw insertError;

            setSuccess(true);
            setTimeout(() => {
                router.push('/dashboard/inventory/transfer');
            }, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/inventory/transfer"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">สร้างรายการโอนย้ายสินค้า</h1>
                        <p className="text-slate-400 text-sm mt-1">โอนย้ายสินค้าระหว่างสาขา</p>
                    </div>
                </div>
            </header>

            <div className="p-6 max-w-2xl mx-auto">
                {success && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-emerald-400">สร้างรายการสำเร็จ! กำลังกลับไปยังหน้ารายการ...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-400">{error}</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">

                        {/* Source Branch */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">จากสาขา (ต้นทาง)</label>
                            <select
                                value={sourceBranchId}
                                onChange={e => {
                                    setSourceBranchId(e.target.value);
                                    setSelectedProductId(''); // Reset product
                                }}
                                disabled={!isOwnerOrManager && !!userBranchId} // Restrict staff to own branch
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Destination Branch */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">ไปยังสาขา (ปลายทาง)</label>
                            <select
                                value={destBranchId}
                                onChange={e => setDestBranchId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option value="">เลือกสาขาปลายทาง...</option>
                                {branches.filter(b => b.id !== sourceBranchId).map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Product */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">เลือกสินค้า</label>
                            <select
                                value={selectedProductId}
                                onChange={e => setSelectedProductId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                disabled={!sourceBranchId}
                            >
                                <option value="">เลือกสินค้า...</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} (คงเหลือ: {p.current_stock})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">จำนวน</label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="0"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">หมายเหตุ (ไม่บังคับ)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="รายละเอียดเพิ่มเติม..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Link
                            href="/dashboard/inventory/transfer"
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-center transition-colors border border-slate-600"
                        >
                            ยกเลิก
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || !sourceBranchId || !destBranchId || !selectedProductId || !quantity}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'กำลังบันทึก...' : 'ยืนยันการโอนย้าย'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
