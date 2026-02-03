import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { validateApiKey, apiSuccess, apiError, logApiRequest } from '@/utils/api-auth';

// GET /api/v1/inventory - ดึงข้อมูลสต็อก
export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const supabaseAdmin = createAdminClient();

    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.context) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const lowStock = searchParams.get('low_stock') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
        .from('product_stocks')
        .select(`
            id, quantity, min_quantity,
            products (id, name, sku, barcode, selling_price),
            branches (id, name)
        `, { count: 'exact' })
        .eq('products.organization_id', auth.context.organizationId)
        .order('quantity')
        .range(offset, offset + limit - 1);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error, count } = await query;

    let inventory = data || [];

    // Filter low stock if requested
    if (lowStock) {
        inventory = inventory.filter((item: { quantity: number; min_quantity: number | null }) =>
            item.quantity <= (item.min_quantity || 10)
        );
    }

    const responseTime = Date.now() - startTime;
    await logApiRequest(
        auth.context.apiKeyId,
        auth.context.organizationId,
        '/api/v1/inventory',
        'GET',
        error ? 500 : 200,
        { branchId, lowStock, limit, offset },
        responseTime,
        request
    );

    if (error) {
        return apiError('Failed to fetch inventory', 500);
    }

    return apiSuccess({
        inventory,
        pagination: {
            total: count,
            limit,
            offset,
            hasMore: offset + limit < (count || 0)
        }
    });
}

// PATCH /api/v1/inventory - อัพเดทสต็อก
export async function PATCH(request: NextRequest) {
    const startTime = Date.now();
    const supabaseAdmin = createAdminClient();

    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.context) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!auth.context.permissions.includes('write')) {
        return apiError('Write permission required', 403);
    }

    const body = await request.json();
    const { product_id, branch_id, quantity, adjustment_type } = body;

    if (!product_id || !branch_id || quantity === undefined) {
        return apiError('product_id, branch_id, and quantity are required', 400);
    }

    // ดึงสต็อกปัจจุบัน
    const { data: currentStock } = await supabaseAdmin
        .from('product_stocks')
        .select('quantity')
        .eq('product_id', product_id)
        .eq('branch_id', branch_id)
        .single();

    let newQuantity = quantity;
    if (adjustment_type === 'add') {
        newQuantity = (currentStock?.quantity || 0) + quantity;
    } else if (adjustment_type === 'subtract') {
        newQuantity = Math.max(0, (currentStock?.quantity || 0) - quantity);
    }

    const { data, error } = await supabaseAdmin
        .from('product_stocks')
        .upsert({
            product_id,
            branch_id,
            quantity: newQuantity
        }, {
            onConflict: 'product_id,branch_id'
        })
        .select()
        .single();

    const responseTime = Date.now() - startTime;
    await logApiRequest(
        auth.context.apiKeyId,
        auth.context.organizationId,
        '/api/v1/inventory',
        'PATCH',
        error ? 500 : 200,
        body,
        responseTime,
        request
    );

    if (error) {
        return apiError('Failed to update inventory: ' + error.message, 500);
    }

    return apiSuccess({ stock: data, new_quantity: newQuantity });
}
