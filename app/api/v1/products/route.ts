import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey, apiSuccess, apiError, logApiRequest } from '@/utils/api-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v1/products - ดึงรายการสินค้า
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.context) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = supabaseAdmin
        .from('products')
        .select(`
            id, name, sku, barcode, description, 
            cost_price, selling_price, 
            is_active, created_at, updated_at,
            categories (id, name)
        `, { count: 'exact' })
        .eq('organization_id', auth.context.organizationId)
        .order('name')
        .range(offset, offset + limit - 1);

    if (category) {
        query = query.eq('category_id', category);
    }

    if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    const responseTime = Date.now() - startTime;
    await logApiRequest(
        auth.context.apiKeyId,
        auth.context.organizationId,
        '/api/v1/products',
        'GET',
        error ? 500 : 200,
        { limit, offset, category, search },
        responseTime,
        request
    );

    if (error) {
        return apiError('Failed to fetch products', 500);
    }

    return apiSuccess({
        products: data,
        pagination: {
            total: count,
            limit,
            offset,
            hasMore: offset + limit < (count || 0)
        }
    });
}

// POST /api/v1/products - สร้างสินค้าใหม่
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.context) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!auth.context.permissions.includes('write')) {
        return apiError('Write permission required', 403);
    }

    const body = await request.json();
    const { name, sku, barcode, description, cost_price, selling_price, category_id } = body;

    if (!name || selling_price === undefined) {
        return apiError('name and selling_price are required', 400);
    }

    const { data, error } = await supabaseAdmin
        .from('products')
        .insert({
            organization_id: auth.context.organizationId,
            name,
            sku,
            barcode,
            description,
            cost_price: cost_price || 0,
            selling_price,
            category_id,
            is_active: true
        })
        .select()
        .single();

    const responseTime = Date.now() - startTime;
    await logApiRequest(
        auth.context.apiKeyId,
        auth.context.organizationId,
        '/api/v1/products',
        'POST',
        error ? 500 : 201,
        body,
        responseTime,
        request
    );

    if (error) {
        return apiError('Failed to create product: ' + error.message, 500);
    }

    return apiSuccess(data, 201);
}
