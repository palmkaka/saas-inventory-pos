import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DeleteButton } from './InventoryClient';
import { cookies } from 'next/headers';

interface Product {
    id: string;
    name: string;
    sku: string | null;
    selling_price: number;
    current_stock: number;
    category_name: string | null;
    image_url: string | null;
}

async function getProducts(branchId?: string) {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, branch_id, is_platform_admin, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { products: [], organizationId: null, branchName: null };
    }

    // Impersonation Logic
    let effectiveOrgId = profile.organization_id;
    if (profile.is_platform_admin) {
        const cookieStore = await cookies();
        const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;
        if (impersonatedOrgId) {
            effectiveOrgId = impersonatedOrgId;
        }
    }

    // Determine branch to show
    // If user has a branch_id (and not impersonating OR impersonating logic handled differently), use that.
    // For simplicity in this fix, if impersonating, we likely want the MAIN branch of the impersonated org, 
    // OR we need to fetch branches of that org.
    // The current logic uses profile.branch_id which refers to the ADMIN's branch (likely null or irrelevant).

    // Fetch all branches for switcher
    const { data: branches } = await supabase
        .from('branches')
        .select('id, name, is_main')
        .eq('organization_id', effectiveOrgId)
        .order('is_main', { ascending: false });

    // Determine target branch
    let targetBranchId: string | undefined = branchId;

    if (!targetBranchId) {
        // Default to Main Branch or First Branch
        const mainBranch = branches?.find(b => b.is_main) || branches?.[0];
        targetBranchId = mainBranch?.id;
    }

    // Fetch branch details for display
    let branchName = 'Unknown Branch';
    if (targetBranchId && branches) {
        const branch = branches.find(b => b.id === targetBranchId);
        if (branch) branchName = branch.name;
    }

    let query = supabase
        .from('products')
        .select(`
      id,
      name,
      sku,
      selling_price,
      image_url,
      categories (
        name
      ),
      product_stocks (
        quantity,
        branch_id
      )
    `)
        .eq('organization_id', effectiveOrgId);

    if (targetBranchId) {
        query = query.eq('product_stocks.branch_id', targetBranchId);
    }

    const { data: products, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching products:', error);
        return { products: [], organizationId: profile.organization_id, branchName, branches: [], currentBranchId: targetBranchId };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedProducts: Product[] = (products || []).map((p: any) => {
        // Find stock for the target branch
        const stockRecord = p.product_stocks?.find((s: any) => s.branch_id === targetBranchId);
        const quantity = stockRecord ? stockRecord.quantity : 0;

        return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            selling_price: p.selling_price,
            current_stock: quantity,
            category_name: Array.isArray(p.categories)
                ? p.categories[0]?.name || null
                : p.categories?.name || null,
            image_url: p.image_url || null,
        };
    });

    return {
        products: transformedProducts,
        organizationId: profile.organization_id,
        branchName,
        branches: branches || [],
        currentBranchId: targetBranchId
    };
}

export default async function InventoryPage({
    searchParams,
}: {
    searchParams: Promise<{ branchId?: string }>;
}) {
    const params = await searchParams;
    const result = await getProducts(params.branchId);

    if ('error' in result) {
        redirect('/');
    }

    const { products, organizationId, branchName, branches, currentBranchId } = result;

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
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            จัดการคลังสินค้า
                            {branches && branches.length > 0 && (
                                <div className="relative group">
                                    <button className="flex items-center gap-2 text-sm font-normal bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
                                        {branchName}
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-20">
                                        {branches.map(branch => (
                                            <Link
                                                key={branch.id}
                                                href={`/dashboard/inventory?branchId=${branch.id}`}
                                                className={`block px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${branch.id === currentBranchId ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300'}`}
                                            >
                                                {branch.name} {branch.is_main && '(Main)'}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">จัดการสินค้าและสต็อกของสาขานี้</p>
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
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/inventory/transfer"
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                โอนย้ายสินค้า
                            </Link>
                            <Link
                                href="/dashboard/inventory/new"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                เพิ่มสินค้า
                            </Link>
                        </div>
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
                    <>
                        {/* Card Grid View */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {products.map((product) => (
                                <div key={product.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all group">
                                    {/* Product Image */}
                                    <div className="aspect-square relative bg-slate-900/50">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>
                                        )}
                                        {/* Stock Badge */}
                                        <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-medium ${product.current_stock < 10
                                            ? 'bg-red-500/90 text-white'
                                            : product.current_stock < 50
                                                ? 'bg-yellow-500/90 text-white'
                                                : 'bg-emerald-500/90 text-white'
                                            }`}>
                                            {product.current_stock} ชิ้น
                                        </div>
                                        {/* Category Badge */}
                                        {product.category_name && (
                                            <div className="absolute top-2 left-2 px-2 py-1 bg-slate-900/80 text-slate-300 text-xs rounded-lg">
                                                {product.category_name}
                                            </div>
                                        )}
                                    </div>
                                    {/* Product Info */}
                                    <div className="p-4">
                                        <h3 className="text-white font-medium truncate" title={product.name}>{product.name}</h3>
                                        <p className="text-slate-500 text-sm mb-2">{product.sku || 'ไม่มี SKU'}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-blue-400 font-bold text-lg">{formatCurrency(product.selling_price)}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/dashboard/inventory/${product.id}`}
                                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="แก้ไข"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </Link>
                                                <DeleteButton productId={product.id} productName={product.name} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="mt-4 text-center">
                            <p className="text-slate-500 text-sm">
                                แสดง {products.length} สินค้า
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
