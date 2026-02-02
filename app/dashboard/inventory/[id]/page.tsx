'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Category {
    id: string;
    name: string;
}

interface FieldDefinition {
    id: string;
    field_key: string;
    field_label: string;
    field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX';
    field_options: string[] | null;
    is_required: boolean;
}

interface ProductData {
    id: string;
    name: string;
    sku: string | null;
    cost_price: number;
    selling_price: number;
    current_stock: number;
    low_stock_threshold: number;
    category_id: string | null;
    attributes: Record<string, string | number | boolean>;
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = createClient();

    const [productId, setProductId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
    const [loadingFields, setLoadingFields] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        cost_price: '',
        selling_price: '',
        current_stock: '',
        low_stock_threshold: '5',
    });
    const [dynamicAttributes, setDynamicAttributes] = useState<Record<string, string | number | boolean>>({});

    // Branch state
    const [branchId, setBranchId] = useState<string | null>(null);

    // Unwrap params
    useEffect(() => {
        params.then((p) => setProductId(p.id));
    }, [params]);

    // Fetch product data and categories
    useEffect(() => {
        if (!productId) return;

        async function fetchData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, branch_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) return;

            // Determine Branch
            let currentBranchId = profile.branch_id;
            if (!currentBranchId) {
                const { data: mainBranch } = await supabase
                    .from('branches')
                    .select('id')
                    .eq('organization_id', profile.organization_id)
                    .eq('is_main', true)
                    .single();
                currentBranchId = mainBranch?.id;
            }
            setBranchId(currentBranchId);

            // Fetch categories
            const { data: cats } = await supabase
                .from('categories')
                .select('id, name')
                .eq('organization_id', profile.organization_id)
                .order('name');
            setCategories(cats || []);

            // 1. Fetch product first
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                setError('Product not found');
                setLoading(false);
                return;
            }

            // 2. Fetch stock if we have a branch
            let currentStock = 0;
            let lowStock = product.low_stock_threshold || 5;

            if (currentBranchId) {
                const { data: stock } = await supabase
                    .from('product_stocks')
                    .select('quantity, low_stock_threshold')
                    .eq('product_id', productId)
                    .eq('branch_id', currentBranchId)
                    .maybeSingle();

                if (stock) {
                    currentStock = stock.quantity;
                    lowStock = stock.low_stock_threshold;
                }
            }

            setFormData({
                name: product.name || '',
                sku: product.sku || '',
                cost_price: product.cost_price?.toString() || '',
                selling_price: product.selling_price?.toString() || '',
                current_stock: currentStock.toString(),
                low_stock_threshold: lowStock.toString(),
            });
            setSelectedCategory(product.category_id || '');
            setDynamicAttributes(product.attributes || {});
            setLoading(false);
        }

        fetchData();
    }, [productId, supabase]);

    // Fetch field definitions when category changes
    useEffect(() => {
        async function fetchFieldDefinitions() {
            if (!selectedCategory) {
                setFieldDefinitions([]);
                return;
            }

            setLoadingFields(true);
            const { data } = await supabase
                .from('category_field_definitions')
                .select('*')
                .eq('category_id', selectedCategory)
                .order('field_label');

            setFieldDefinitions(data || []);

            // Initialize missing attributes with defaults
            const newAttrs = { ...dynamicAttributes };
            (data || []).forEach((field) => {
                if (!(field.field_key in newAttrs)) {
                    if (field.field_type === 'CHECKBOX') {
                        newAttrs[field.field_key] = false;
                    } else {
                        newAttrs[field.field_key] = '';
                    }
                }
            });
            setDynamicAttributes(newAttrs);
            setLoadingFields(false);
        }

        fetchFieldDefinitions();
    }, [selectedCategory, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId || !branchId) return;

        setError(null);
        setSaving(true);

        try {
            const productData = {
                name: formData.name,
                sku: formData.sku || null,
                cost_price: parseFloat(formData.cost_price) || 0,
                selling_price: parseFloat(formData.selling_price) || 0,
                low_stock_threshold: parseInt(formData.low_stock_threshold) || 5, // Fallback on product level too
                category_id: selectedCategory || null,
                attributes: dynamicAttributes,
                // current_stock is removed from here
            };

            const { error: updateError } = await supabase
                .from('products')
                .update(productData)
                .eq('id', productId);

            if (updateError) throw updateError;

            // Upsert stock logic
            const currentStock = parseInt(formData.current_stock) || 0;
            const lowStock = parseInt(formData.low_stock_threshold) || 5;

            const { error: stockError } = await supabase
                .from('product_stocks')
                .upsert({
                    product_id: productId,
                    branch_id: branchId,
                    quantity: currentStock,
                    low_stock_threshold: lowStock
                }, { onConflict: 'product_id, branch_id' });

            if (stockError) throw stockError;

            setSuccess(true);
            setTimeout(() => {
                router.push('/dashboard/inventory');
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update product');
        } finally {
            setSaving(false);
        }
    };

    const renderDynamicField = (field: FieldDefinition) => {
        const value = dynamicAttributes[field.field_key] ?? '';

        switch (field.field_type) {
            case 'TEXT':
                return (
                    <input
                        type="text"
                        value={value as string}
                        onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.field_key]: e.target.value })}
                        required={field.is_required}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                );
            case 'NUMBER':
                return (
                    <input
                        type="number"
                        value={value as string}
                        onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.field_key]: e.target.value })}
                        required={field.is_required}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                );
            case 'DATE':
                return (
                    <input
                        type="date"
                        value={value as string}
                        onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.field_key]: e.target.value })}
                        required={field.is_required}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                );
            case 'SELECT':
                return (
                    <select
                        value={value as string}
                        onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.field_key]: e.target.value })}
                        required={field.is_required}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                        <option value="">Select {field.field_label}</option>
                        {field.field_options?.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                );
            case 'CHECKBOX':
                return (
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={value as boolean}
                            onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.field_key]: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-900/50 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-slate-300">Yes</span>
                    </label>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/inventory"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Edit Product</h1>
                        <p className="text-slate-400 text-sm mt-1">Update product details</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 max-w-4xl mx-auto">
                {success && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-emerald-400">Product updated successfully! Redirecting...</p>
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
                    {/* Basic Info */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Basic Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Product Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">SKU</label>
                                <input
                                    type="text"
                                    value={formData.sku}
                                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pricing & Stock
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Cost Price (฿)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.cost_price}
                                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Selling Price (฿) <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.selling_price}
                                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Current Stock</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.current_stock}
                                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Low Stock Alert</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.low_stock_threshold}
                                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    {selectedCategory && (
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                Category-Specific Fields
                            </h2>
                            {loadingFields ? (
                                <div className="flex items-center justify-center py-8">
                                    <svg className="animate-spin w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            ) : fieldDefinitions.length === 0 ? (
                                <p className="text-slate-500 text-center py-4">No custom fields defined for this category.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {fieldDefinitions.map((field) => (
                                        <div key={field.id}>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                {field.field_label}
                                                {field.is_required && <span className="text-red-400 ml-1">*</span>}
                                            </label>
                                            {renderDynamicField(field)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                        <Link
                            href="/dashboard/inventory"
                            className="px-6 py-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors font-medium"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
