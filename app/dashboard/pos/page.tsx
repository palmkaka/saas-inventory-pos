'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Product {
    id: string;
    name: string;
    sku: string | null;
    selling_price: number;
    current_stock: number;
    category_name: string | null;
}

interface CartItem extends Product {
    quantity: number;
}

export default function POSPage() {
    const supabase = createClient();

    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [checkingOut, setCheckingOut] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch products
    useEffect(() => {
        async function fetchProducts() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserId(user.id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) return;

            setOrganizationId(profile.organization_id);

            const { data } = await supabase
                .from('products')
                .select(`
          id,
          name,
          sku,
          selling_price,
          current_stock,
          categories (name)
        `)
                .eq('organization_id', profile.organization_id)
                .gt('current_stock', 0)
                .order('name');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedProducts: Product[] = (data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                selling_price: p.selling_price,
                current_stock: p.current_stock,
                category_name: Array.isArray(p.categories)
                    ? p.categories[0]?.name || null
                    : p.categories?.name || null,
            }));

            setProducts(transformedProducts);
            setFilteredProducts(transformedProducts);
            setLoading(false);
        }

        fetchProducts();
    }, [supabase]);

    // Filter products by search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProducts(products);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = products.filter(
            (p) =>
                p.name.toLowerCase().includes(query) ||
                p.sku?.toLowerCase().includes(query) ||
                p.category_name?.toLowerCase().includes(query)
        );
        setFilteredProducts(filtered);
    }, [searchQuery, products]);

    // Add to cart
    const addToCart = useCallback((product: Product) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.current_stock) {
                    return prev;
                }
                return prev.map((item) =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    }, []);

    // Update quantity
    const updateQuantity = useCallback((productId: string, delta: number) => {
        setCart((prev) => {
            return prev
                .map((item) => {
                    if (item.id === productId) {
                        const newQty = item.quantity + delta;
                        if (newQty <= 0) return null;
                        if (newQty > item.current_stock) return item;
                        return { ...item, quantity: newQty };
                    }
                    return item;
                })
                .filter(Boolean) as CartItem[];
        });
    }, []);

    // Remove from cart
    const removeFromCart = useCallback((productId: string) => {
        setCart((prev) => prev.filter((item) => item.id !== productId));
    }, []);

    // Calculate total
    const total = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);

    // Checkout
    const handleCheckout = async () => {
        if (cart.length === 0 || !organizationId || !userId) return;

        setCheckingOut(true);

        try {
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    organization_id: organizationId,
                    seller_id: userId,
                    total_amount: total,
                    payment_method: 'CASH',
                    status: 'COMPLETED',
                })
                .select('id')
                .single();

            if (orderError) throw orderError;

            const orderItems = cart.map((item) => ({
                order_id: order.id,
                product_id: item.id,
                quantity: item.quantity,
                price_at_sale: item.selling_price,
                cost_at_sale: 0,
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            for (const item of cart) {
                const { error: stockError } = await supabase
                    .from('products')
                    .update({ current_stock: item.current_stock - item.quantity })
                    .eq('id', item.id);

                if (stockError) console.error('Stock update error:', stockError);
            }

            setProducts((prev) =>
                prev.map((p) => {
                    const cartItem = cart.find((c) => c.id === p.id);
                    if (cartItem) {
                        return { ...p, current_stock: p.current_stock - cartItem.quantity };
                    }
                    return p;
                }).filter((p) => p.current_stock > 0)
            );

            setShowSuccess(true);
            setCart([]);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Checkout error:', error);
            alert('การชำระเงินล้มเหลว กรุณาลองใหม่อีกครั้ง');
        } finally {
            setCheckingOut(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Success Alert */}
            {showSuccess && (
                <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-3 animate-pulse">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold text-lg">ชำระเงินสำเร็จ!</span>
                </div>
            )}

            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">ขายสินค้า</h1>
                        <p className="text-slate-400 text-sm mt-1">เลือกสินค้าเพื่อเพิ่มในตะกร้า</p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Products Section (Top/Left) */}
                <div className="flex-1 lg:w-2/3 p-4 overflow-y-auto order-1 lg:order-1 h-[60vh] lg:h-auto">
                    {/* Search Bar */}
                    <div className="mb-4">
                        <div className="relative">
                            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ค้นหาสินค้า..."
                                className="w-full pl-12 pr-4 py-3 lg:py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 text-base lg:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Products Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-slate-500 text-lg">
                                {searchQuery ? 'ไม่พบสินค้า' : 'ไม่มีสินค้า'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredProducts.map((product) => {
                                const inCart = cart.find((item) => item.id === product.id);
                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        disabled={inCart && inCart.quantity >= product.current_stock}
                                        className={`relative bg-slate-800/70 border rounded-xl p-3 lg:p-4 text-left transition-all duration-200 active:scale-95 ${inCart
                                            ? 'border-blue-500/50 bg-blue-500/10'
                                            : 'border-slate-700/50'
                                            } disabled:opacity-50`}
                                    >
                                        <div className="w-full aspect-square bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg mb-2 flex items-center justify-center">
                                            {inCart && (
                                                <div className="absolute top-2 right-2 w-6 h-6 lg:w-8 lg:h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs lg:text-sm shadow-lg z-10">
                                                    {inCart.quantity}
                                                </div>
                                            )}
                                            <svg className="w-8 h-8 lg:w-12 lg:h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>

                                        <h3 className="text-white font-medium text-sm lg:text-base line-clamp-1 mb-0.5">{product.name}</h3>
                                        <p className="text-blue-400 font-bold text-base lg:text-xl">{formatCurrency(product.selling_price)}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Cart Section (Bottom/Right) */}
                <div className="w-full lg:w-1/3 bg-slate-800/90 border-t lg:border-t-0 lg:border-l border-slate-700/50 flex flex-col order-2 lg:order-2 h-[40vh] lg:h-auto shadow-[0_-4px_20px_rgba(0,0,0,0.3)] lg:shadow-none z-20">
                    {/* Cart Header */}
                    <div className="p-3 lg:p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800">
                        <h2 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            ตะกร้า ({cart.length})
                        </h2>
                        <button
                            onClick={() => setCart([])}
                            disabled={cart.length === 0}
                            className="text-xs lg:text-sm text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                            ล้าง
                        </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="text-slate-500">ตะกร้าว่างเปล่า</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white text-sm font-medium truncate">{item.name}</h3>
                                        <p className="text-blue-400 text-sm font-bold">{formatCurrency(item.selling_price * item.quantity)}</p>
                                    </div>

                                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white">-</button>
                                        <span className="w-6 text-center text-white font-medium text-sm">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white" disabled={item.quantity >= item.current_stock}>+</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Cart Footer */}
                    <div className="p-3 lg:p-4 border-t border-slate-700/50 bg-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-slate-400">รวม</span>
                            <span className="text-white font-bold text-2xl">{formatCurrency(total)}</span>
                        </div>
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || checkingOut}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {checkingOut ? 'กำลังบันทึก...' : 'ชำระเงิน'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
