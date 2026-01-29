import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DeleteButton } from './InventoryClient';

interface Product {
    id: string;
    name: string;
    sku: string | null;
    selling_price: number;
    current_stock: number;
    category_name: string | null;
}

async function getProducts() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { products: [], organizationId: null };
    }

    const { data: products, error } = await supabase
        .from('products')
        .select(`
      id,
      name,
      sku,
      selling_price,
      current_stock,
      categories (
        name
      )
    `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching products:', error);
        return { products: [], organizationId: profile.organization_id };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedProducts: Product[] = (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        selling_price: p.selling_price,
        current_stock: p.current_stock,
        category_name: Array.isArray(p.categories)
            ? p.categories[0]?.name || null
            : p.categories?.name || null,
    }));

    return { products: transformedProducts, organizationId: profile.organization_id };
}

export default async function InventoryPage() {
    const result = await getProducts();

    if ('error' in result) {
        redirect('/');
    }

    const { products, organizationId } = result;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">จัดการคลังสินค้า</h1>
                        <p className="text-slate-400 text-sm mt-1">จัดการสินค้าและสต็อกของคุณ</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/settings/categories"
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            จัดการหมวดหมู่
                        </Link>
                        <Link
                            href="/dashboard/inventory/new"
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มสินค้า
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6">
                {!organizationId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <svg className="w-12 h-12 text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-lg font-semibold text-yellow-400 mb-2">ไม่พบองค์กร</h2>
                        <p className="text-yellow-400/80">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้าองค์กร</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <h2 className="text-xl font-semibold text-white mb-2">ยังไม่มีสินค้า</h2>
                        <p className="text-slate-400 mb-6">เริ่มต้นโดยการเพิ่มสินค้าชิ้นแรกของคุณ</p>
                        <Link
                            href="/dashboard/inventory/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มสินค้าชิ้นแรก
                        </Link>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        {/* Table */}
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 border-b border-slate-700/50">
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase tracking-wider">สินค้า</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase tracking-wider">หมวดหมู่</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400 uppercase tracking-wider">ราคา</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400 uppercase tracking-wider">สต็อก</th>
                                    <th className="text-center px-6 py-4 text-sm font-medium text-slate-400 uppercase tracking-wider">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {products.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">{product.name}</p>
                                                    <p className="text-slate-500 text-sm">{product.sku || 'ไม่มี SKU'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-slate-700/50 text-slate-300 text-sm rounded-lg">
                                                {product.category_name || 'ไม่ระบุ'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white font-medium">{formatCurrency(product.selling_price)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${product.current_stock < 10
                                                ? 'bg-red-500/20 text-red-400'
                                                : product.current_stock < 50
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                {product.current_stock} ชิ้น
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Link
                                                    href={`/dashboard/inventory/${product.id}`}
                                                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="แก้ไขสินค้า"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </Link>
                                                <DeleteButton productId={product.id} productName={product.name} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50">
                            <p className="text-slate-500 text-sm">
                                แสดง {products.length} สินค้า
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
