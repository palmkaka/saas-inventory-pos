import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// สร้าง Supabase admin client สำหรับ API
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ApiKeyData {
    id: string;
    organization_id: string;
    permissions: string[];
    is_active: boolean;
    expires_at: string | null;
}

export interface ApiContext {
    organizationId: string;
    apiKeyId: string;
    permissions: string[];
}

// ตรวจสอบ API Key
export async function validateApiKey(request: NextRequest): Promise<{
    valid: boolean;
    context?: ApiContext;
    error?: string;
}> {
    const apiKey = request.headers.get('X-API-Key');
    const apiSecret = request.headers.get('X-API-Secret');

    if (!apiKey || !apiSecret) {
        return { valid: false, error: 'Missing API Key or Secret' };
    }

    // ค้นหา API Key
    const { data: keyData, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, organization_id, secret_hash, permissions, is_active, expires_at')
        .eq('api_key', apiKey)
        .single();

    if (error || !keyData) {
        return { valid: false, error: 'Invalid API Key' };
    }

    const apiKeyData = keyData as ApiKeyData & { secret_hash: string };

    // ตรวจสอบว่า active
    if (!apiKeyData.is_active) {
        return { valid: false, error: 'API Key is inactive' };
    }

    // ตรวจสอบหมดอายุ
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
        return { valid: false, error: 'API Key has expired' };
    }

    // ตรวจสอบ secret
    const secretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');
    if (secretHash !== apiKeyData.secret_hash) {
        return { valid: false, error: 'Invalid API Secret' };
    }

    // อัพเดท last_used_at
    await supabaseAdmin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKeyData.id);

    return {
        valid: true,
        context: {
            organizationId: apiKeyData.organization_id,
            apiKeyId: apiKeyData.id,
            permissions: apiKeyData.permissions
        }
    };
}

// Log API request
export async function logApiRequest(
    apiKeyId: string | null,
    organizationId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    requestBody: unknown,
    responseTimeMs: number,
    request: NextRequest
) {
    await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        organization_id: organizationId,
        endpoint,
        method,
        status_code: statusCode,
        request_body: requestBody,
        response_time_ms: responseTimeMs,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
    });
}

// Response helpers
export function apiSuccess(data: unknown, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}

// สร้าง API Key ใหม่
export function generateApiKey(): { apiKey: string; apiSecret: string; secretHash: string } {
    const apiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const apiSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');

    return { apiKey, apiSecret, secretHash };
}
