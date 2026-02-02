import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey, apiSuccess, apiError, logApiRequest } from '@/utils/api-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v1/reports/summary - สรุปยอดขาย
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.context) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // ยอดขาย
    const { data: salesData } = await supabaseAdmin
        .from('orders')
        .select('total_amount, status')
        .eq('organization_id', auth.context.organizationId)
        .eq('status', 'COMPLETED')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

    const totalSales = salesData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const orderCount = salesData?.length || 0;

    // นับสินค้า
    const { count: productCount } = await supabaseAdmin
        .from('products')
        .select('id', { count: 'exact' })
        .eq('organization_id', auth.context.organizationId)
        .eq('is_active', true);

    // สินค้าคงคลังต่ำ
    const { data: lowStockData } = await supabaseAdmin
        .from('product_stocks')
        .select(`
            quantity, min_quantity,
            products!inner (organization_id, name)
        `)
        .eq('products.organization_id', auth.context.organizationId);

    const lowStockCount = lowStockData?.filter(
        (item: { quantity: number; min_quantity: number | null }) =>
            item.quantity <= (item.min_quantity || 10)
    ).length || 0;

    const responseTime = Date.now() - startTime;
    await logApiRequest(
        auth.context.apiKeyId,
        auth.context.organizationId,
        '/api/v1/reports/summary',
        'GET',
        200,
        { startDate, endDate },
        responseTime,
        request
    );

    return apiSuccess({
        period: { start_date: startDate, end_date: endDate },
        sales: {
            total_amount: totalSales,
            order_count: orderCount,
            average_order: orderCount > 0 ? totalSales / orderCount : 0
        },
        inventory: {
            active_products: productCount || 0,
            low_stock_count: lowStockCount
        }
    });
}
