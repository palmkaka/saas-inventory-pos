import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey, apiSuccess, apiError, logApiRequest } from '@/utils/api-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v1/orders - ดึงรายการออเดอร์
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.context) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabaseAdmin
        .from('orders')
        .select(`
            id, order_number, status, payment_method,
            subtotal, discount_amount, tax_amount, total_amount,
            customer_id, branch_id, shift_id,
            created_at, updated_at,
            order_items (
                id, product_id, quantity, unit_price, total_price,
                products (name, sku)
            )
        `, { count: 'exact' })
        .eq('organization_id', auth.context.organizationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) {
        query = query.eq('status', status);
    }

    if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
    }

    if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data, error, count } = await query;

    const responseTime = Date.now() - startTime;
    await logApiRequest(
        auth.context.apiKeyId,
        auth.context.organizationId,
        '/api/v1/orders',
        'GET',
        error ? 500 : 200,
        { limit, offset, status, startDate, endDate },
        responseTime,
        request
    );

    if (error) {
        return apiError('Failed to fetch orders', 500);
    }

    return apiSuccess({
        orders: data,
        pagination: {
            total: count,
            limit,
            offset,
            hasMore: offset + limit < (count || 0)
        }
    });
}
