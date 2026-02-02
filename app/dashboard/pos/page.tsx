'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import ReceiptTemplate from './ReceiptTemplate';
import BarcodeScanner from '../components/BarcodeScanner';

interface Product {
    id: string;
    name: string;
    sku: string | null;
    barcode?: string | null;
    selling_price: number;
    current_stock: number;
    category_name: string | null;
    image_url: string | null;
}

interface CartItem extends Product {
    quantity: number;
}

interface Organization {
    name: string;
    address?: string;
    phone?: string;
    tax_id?: string;
    logo_url?: string;
}

interface CompletedOrder {
    id: string;
    items: Array<{
        product_id: string;
        name: string;
        quantity: number;
        price: number;
    }>;
    total_amount: number;
    created_at: string;
}

interface Customer {
    id: string;
    phone: string;
    name: string;
    points: number;
}

interface LoyaltySettings {
    loyalty_enabled: boolean;
    points_per_currency: number;
    points_to_currency: number;
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
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);

    // Customer & Loyalty states
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [searchingCustomer, setSearchingCustomer] = useState(false);
    const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);

    // Shift state
    const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
    const [checkingShift, setCheckingShift] = useState(true);

    // Barcode Scanner state
    const [showScanner, setShowScanner] = useState(false);

    const [branchId, setBranchId] = useState<string | null>(null);

    // Fetch products
    useEffect(() => {
        async function fetchProducts() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserId(user.id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, branch_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) return;

            setOrganizationId(profile.organization_id);

            // Determine Branch
            // Priority: Active Shift Branch > Profile Branch > Main Branch
            let currentBranchId = profile.branch_id;

            // Fetch organization details
            const { data: orgData } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', profile.organization_id)
                .single();

            // Check for active shift
            const { data: shiftData } = await supabase
                .from('shifts')
                .select('id, branch_id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (shiftData) {
                setActiveShiftId(shiftData.id);
                if (shiftData.branch_id) {
                    currentBranchId = shiftData.branch_id;
                }
            }
            setCheckingShift(false);

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

            if (orgData) {
                setOrganization(orgData);
                setLoyaltySettings({
                    loyalty_enabled: orgData.loyalty_enabled ?? true,
                    points_per_currency: orgData.points_per_currency ?? 100,
                    points_to_currency: orgData.points_to_currency ?? 10
                });
            }

            const { data: productsData, error: productError } = await supabase
                .from('products')
                .select(`
                    id,
                    name,
                    sku,
                    barcode,
                    selling_price,
                    image_url,
                    categories (name)
                `)
                .eq('organization_id', profile.organization_id)
                .order('name');

            if (productError) {
                console.error('Error fetching products:', productError);
                setLoading(false);
                return;
            }

            // 2. Fetch stocks for this branch
            let stocksData: Record<string, number> = {};
            if (currentBranchId) {
                const { data: stocks } = await supabase
                    .from('product_stocks')
                    .select('product_id, quantity')
                    .eq('branch_id', currentBranchId);

                if (stocks) {
                    stocks.forEach(s => {
                        stocksData[s.product_id] = s.quantity;
                    });
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedProducts: Product[] = (productsData || []).map((p: any) => {
                const quantity = stocksData[p.id] || 0;

                return {
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    barcode: p.barcode,
                    selling_price: p.selling_price,
                    current_stock: quantity,
                    category_name: Array.isArray(p.categories)
                        ? p.categories[0]?.name || null
                        : p.categories?.name || null,
                    image_url: p.image_url || null,
                };
            }).filter(p => p.current_stock > 0);

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
                p.barcode?.toLowerCase().includes(query) ||
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

    // Handle barcode scan
    const handleBarcodeScan = useCallback((barcode: string) => {
        setShowScanner(false);
        const product = products.find(
            p => p.barcode === barcode || p.sku === barcode
        );
        if (product) {
            addToCart(product);
        } else {
            alert(`ไม่พบสินค้าที่มี Barcode/SKU: ${barcode}`);
        }
    }, [products, addToCart]);

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

    // Calculate subtotal
    const subtotal = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);

    // Calculate discount from points
    const discountFromPoints = loyaltySettings
        ? Math.floor(pointsToRedeem / loyaltySettings.points_to_currency)
        : 0;

    // Final total after discount
    const total = Math.max(0, subtotal - discountFromPoints);

    // Calculate points to be earned
    const pointsToEarn = loyaltySettings && loyaltySettings.loyalty_enabled
        ? Math.floor(total / loyaltySettings.points_per_currency)
        : 0;

    // Search customers by phone
    const searchCustomer = async (phone: string) => {
        if (!phone || phone.length < 3 || !organizationId) return;

        setSearchingCustomer(true);
        const { data, error } = await supabase
            .from('customers')
            .select('id, phone, name, points')
            .eq('organization_id', organizationId)
            .ilike('phone', `%${phone}%`)
            .limit(5);

        if (!error && data) {
            setCustomerResults(data);
        }
        setSearchingCustomer(false);
    };

    // Select customer
    const selectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch('');
        setCustomerResults([]);
        setShowCustomerSearch(false);
        setPointsToRedeem(0);
    };

    // Clear customer
    const clearCustomer = () => {
        setSelectedCustomer(null);
        setPointsToRedeem(0);
    };

    // Checkout
    const handleCheckout = async () => {
        if (cart.length === 0 || !organizationId || !userId || !branchId) return;

        setCheckingOut(true);

        try {
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    organization_id: organizationId,
                    seller_id: userId,
                    branch_id: branchId,
                    total_amount: total,
                    payment_method: 'CASH',
                    status: 'COMPLETED',
                    customer_id: selectedCustomer?.id || null,
                    points_earned: selectedCustomer ? pointsToEarn : 0,
                    points_redeemed: pointsToRedeem,
                    discount_amount: discountFromPoints,
                    shift_id: activeShiftId
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
                organization_id: organizationId
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Deduct from product_stocks
            for (const item of cart) {
                const { data: currentStock, error: fetchError } = await supabase
                    .from('product_stocks')
                    .select('quantity')
                    .eq('product_id', item.id)
                    .eq('branch_id', branchId)
                    .single();

                if (fetchError || !currentStock) {
                    console.error('Stock fetch error:', fetchError);
                    continue;
                }

                const newQuantity = currentStock.quantity - item.quantity;

                const { error: stockError } = await supabase
                    .from('product_stocks')
                    .update({ quantity: newQuantity })
                    .eq('product_id', item.id)
                    .eq('branch_id', branchId);

                if (stockError) console.error('Stock update error:', stockError);
            }

            // === COMMISSION CALCULATION ===
            try {
                const { data: commissionSettings } = await supabase
                    .from('commission_settings')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .eq('is_active', true);

                if (commissionSettings && commissionSettings.length > 0) {
                    const commissionRecords: {
                        organization_id: string;
                        user_id: string;
                        order_id: string;
                        commission_setting_id: string;
                        sale_amount: number;
                        commission_amount: number;
                        period_month: string;
                        status: string;
                    }[] = [];

                    const now = new Date();
                    const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

                    for (const item of cart) {
                        const itemTotal = item.selling_price * item.quantity;
                        let appliedSetting = commissionSettings.find(s => s.applies_to === 'PRODUCT' && s.product_id === item.id);

                        if (!appliedSetting) {
                            const { data: product } = await supabase
                                .from('products')
                                .select('category_id')
                                .eq('id', item.id)
                                .single();

                            if (product?.category_id) {
                                appliedSetting = commissionSettings.find(s => s.applies_to === 'CATEGORY' && s.category_id === product.category_id);
                            }
                        }

                        if (!appliedSetting) {
                            appliedSetting = commissionSettings.find(s => s.applies_to === 'ALL');
                        }

                        if (appliedSetting) {
                            let commissionAmount = 0;
                            if (appliedSetting.commission_type === 'PERCENTAGE') {
                                commissionAmount = (itemTotal * appliedSetting.rate) / 100;
                            } else {
                                commissionAmount = appliedSetting.rate * item.quantity;
                            }

                            if (commissionAmount > 0) {
                                commissionRecords.push({
                                    organization_id: organizationId,
                                    user_id: userId,
                                    order_id: order.id,
                                    commission_setting_id: appliedSetting.id,
                                    sale_amount: itemTotal,
                                    commission_amount: commissionAmount,
                                    period_month: periodMonth,
                                    status: 'PENDING'
                                });
                            }
                        }
                    }

                    if (commissionRecords.length > 0) {
                        await supabase.from('commission_records').insert(commissionRecords);
                    }
                }
            } catch (commErr) {
                console.error('Commission calculation error:', commErr);
            }
            // === END COMMISSION ===

            setProducts((prev) =>
                prev.map((p) => {
                    const cartItem = cart.find((c) => c.id === p.id);
                    if (cartItem) {
                        return { ...p, current_stock: p.current_stock - cartItem.quantity };
                    }
                    return p;
                }).filter((p) => p.current_stock > 0)
            );

            const receiptData: CompletedOrder = {
                id: order.id,
                items: cart.map(item => ({
                    product_id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.selling_price
                })),
                total_amount: total,
                created_at: new Date().toISOString()
            };

            setCompletedOrder(receiptData);
            setShowSuccess(true);
            setShowReceipt(true);
            setCart([]);
            setSelectedCustomer(null);
            setPointsToRedeem(0);
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

            {/* Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScanner
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                />
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
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ค้นหาสินค้า / Barcode..."
                                    className="w-full pl-12 pr-4 py-3 lg:py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 text-base lg:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <button
                                onClick={() => setShowScanner(true)}
                                className="px-4 py-3 lg:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-colors"
                                title="สแกน Barcode"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                <span className="hidden lg:inline">สแกน</span>
                            </button>
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
                                        <div className="w-full aspect-square bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                            {inCart && (
                                                <div className="absolute top-2 right-2 w-6 h-6 lg:w-8 lg:h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs lg:text-sm shadow-lg z-10">
                                                    {inCart.quantity}
                                                </div>
                                            )}
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <svg className="w-8 h-8 lg:w-12 lg:h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            )}
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
                    <div className="p-3 lg:p-4 border-t border-slate-700/50 bg-slate-800 space-y-3">
                        {/* Customer Selection */}
                        <div className="bg-slate-700/30 rounded-lg p-3">
                            {selectedCustomer ? (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-white font-medium text-sm">{selectedCustomer.name}</div>
                                        <div className="text-slate-400 text-xs">{selectedCustomer.phone}</div>
                                        <div className="text-blue-400 text-xs font-medium">{selectedCustomer.points.toLocaleString()} แต้ม</div>
                                    </div>
                                    <button onClick={clearCustomer} className="text-red-400 text-xs hover:text-red-300">ยกเลิก</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="🔍 ค้นหาลูกค้า (เบอร์โทร)..."
                                        value={customerSearch}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                            searchCustomer(e.target.value);
                                        }}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
                                    />
                                    {customerResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg overflow-hidden z-10">
                                            {customerResults.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => selectCustomer(c)}
                                                    className="w-full px-3 py-2 text-left hover:bg-slate-600 transition-colors"
                                                >
                                                    <div className="text-white text-sm">{c.name}</div>
                                                    <div className="text-slate-400 text-xs">{c.phone} • {c.points} แต้ม</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Points Redemption */}
                        {selectedCustomer && selectedCustomer.points > 0 && loyaltySettings && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-blue-400 text-sm">ใช้แต้มแลกส่วนลด</span>
                                    <span className="text-blue-300 text-xs">({loyaltySettings.points_to_currency} แต้ม = 1 บาท)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={selectedCustomer.points}
                                        value={pointsToRedeem}
                                        onChange={(e) => setPointsToRedeem(Math.min(Number(e.target.value), selectedCustomer.points))}
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white text-sm"
                                    />
                                    <button
                                        onClick={() => setPointsToRedeem(selectedCustomer.points)}
                                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                    >
                                        ใช้ทั้งหมด
                                    </button>
                                </div>
                                {discountFromPoints > 0 && (
                                    <div className="text-emerald-400 text-sm mt-2">ส่วนลด: {formatCurrency(discountFromPoints)}</div>
                                )}
                            </div>
                        )}

                        {/* Totals */}
                        <div className="space-y-1">
                            {discountFromPoints > 0 && (
                                <>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">ราคาสินค้า</span>
                                        <span className="text-slate-300">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-emerald-400">ส่วนลดแต้ม</span>
                                        <span className="text-emerald-400">-{formatCurrency(discountFromPoints)}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">รวมสุทธิ</span>
                                <span className="text-white font-bold text-2xl">{formatCurrency(total)}</span>
                            </div>
                            {selectedCustomer && pointsToEarn > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-blue-400">แต้มที่จะได้รับ</span>
                                    <span className="text-blue-400 font-medium">+{pointsToEarn} แต้ม</span>
                                </div>
                            )}
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

            {/* Receipt Modal */}
            {showReceipt && completedOrder && organization && (
                <ReceiptTemplate
                    orderId={completedOrder.id}
                    items={completedOrder.items}
                    totalAmount={completedOrder.total_amount}
                    organization={organization}
                    createdAt={completedOrder.created_at}
                    onClose={() => setShowReceipt(false)}
                />
            )}

            {/* No Active Shift Modal */}
            {!checkingShift && !activeShiftId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full mx-4 text-center">
                        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">กรุณาเริ่มกะงานก่อน</h2>
                        <p className="text-slate-400 mb-6">
                            คุณจำเป็นต้องเริ่มกะการทำงาน (Clock In) ก่อนที่จะทำการขายสินค้าได้
                        </p>
                        <a
                            href="/dashboard/shifts"
                            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                        >
                            ไปหน้าเริ่มกะงาน
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
