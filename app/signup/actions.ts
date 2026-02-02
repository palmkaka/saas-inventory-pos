'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';

export async function signup(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const fullName = formData.get('fullName') as string;
    const companyName = formData.get('companyName') as string;

    if (!email || !password || !fullName || !companyName) {
        return { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
    }

    if (password !== confirmPassword) {
        return { error: 'รหัสผ่านไม่ตรงกัน' };
    }

    if (password.length < 6) {
        return { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
    }

    const supabaseAdmin = createAdminClient();

    try {
        // 1. Create Auth User (Auto-confirmed, No Email Sent)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm
            user_metadata: { full_name: fullName }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('ไม่สามารถสร้างบัญชีได้');

        // 2. Create Organization
        const slug = companyName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36);

        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name: companyName,
                slug: slug,
                status: 'pending' // Default to pending for manual approval
            })
            .select('id')
            .single();

        if (orgError) throw orgError;

        // 3. Create Profile (Owner)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authData.user.id,
                organization_id: org.id,
                role: 'owner',
                full_name: fullName,
                is_active: true
            });

        if (profileError) throw profileError;

        // 4. Create Main Branch for the Organization
        const { error: branchError } = await supabaseAdmin
            .from('branches')
            .insert({
                organization_id: org.id,
                name: 'สาขาหลัก',
                address: '',
                is_main: true
            });

        if (branchError) {
            console.error('Branch creation error:', branchError);
            // Non-blocking - org can still function
        }

        return { success: true };

    } catch (error: any) {
        console.error('Signup error:', error);
        return { error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
    }
}
