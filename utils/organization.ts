import { createClient } from '@/utils/supabase/server'

/**
 * ดึง organization_id ของ User ที่ Login อยู่
 * ใช้สำหรับ Filter ข้อมูลให้เห็นเฉพาะองค์กรตัวเอง
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
    const supabase = await createClient()

    // ดึงข้อมูล User ที่ Login
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    // ดึง Profile เพื่อเอา organization_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    return profile?.organization_id || null
}

/**
 * ดึงข้อมูลองค์กรปัจจุบัน
 */
export async function getCurrentOrganization() {
    const supabase = await createClient()
    const orgId = await getCurrentOrganizationId()

    if (!orgId) {
        return null
    }

    const { data: organization } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()

    return organization
}

/**
 * ตรวจสอบว่า User เป็น Platform Admin หรือไม่
 */
export async function isPlatformAdmin(): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return false
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single()

    return profile?.is_platform_admin || false
}

/**
 * ตรวจสอบว่า User เป็น Support Staff หรือไม่
 */
export async function isSupportStaff(): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return false
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_support_staff')
        .eq('id', user.id)
        .single()

    return profile?.is_support_staff || false
}
