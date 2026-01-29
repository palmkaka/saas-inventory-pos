import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    // Get user's profile with organization_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { products: [], organizationId: null };
    }

    // Fetch products with category join
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

    // Transform the data to flatten categories
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
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
                            <p className="text-slate-400 text-sm mt-1">Manage your products and stock levels</p>
                        </div>
                    </div>
                    <Link
                        href="/inventory/new"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Product
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto p-6">
                {!organizationId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <svg className="w-12 h-12 text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-lg font-semibold text-yellow-400 mb-2">No Organization</h2>
                        <p className="text-yellow-400/80">Please contact an administrator to assign you to an organization.</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <h2 className="text-xl font-semibold text-white mb-2">No Products Yet</h2>
                        <p className="text-slate-400 mb-6">Get started by adding your first product to the inventory.</p>
                        <Link
                            href="/inventory/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Your First Product
                        </Link>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-800 border-b border-slate-700/50 text-sm font-medium text-slate-400 uppercase tracking-wider">
                            <div className="col-span-4">Product</div>
                            <div className="col-span-2">SKU</div>
                            <div className="col-span-2">Category</div>
                            <div className="col-span-2 text-right">Price</div>
                            <div className="col-span-2 text-right">Stock</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-slate-700/50">
                            {products.map((product) => (
                                <div
                                    key={product.id}
                                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-700/30 transition-colors cursor-pointer"
                                >
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <span className="text-white font-medium">{product.name}</span>
                                    </div>
                                    <div className="col-span-2 flex items-center">
                                        <span className="text-slate-400 font-mono text-sm">{product.sku || '-'}</span>
                                    </div>
                                    <div className="col-span-2 flex items-center">
                                        <span className="px-2.5 py-1 bg-slate-700/50 text-slate-300 text-sm rounded-lg">
                                            {product.category_name || 'Uncategorized'}
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end">
                                        <span className="text-white font-medium">{formatCurrency(product.selling_price)}</span>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end">
                                        <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${product.current_stock < 10
                                            ? 'bg-red-500/20 text-red-400'
                                            : product.current_stock < 50
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {product.current_stock} units
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Table Footer */}
                        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50">
                            <p className="text-slate-500 text-sm">
                                Showing {products.length} product{products.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
