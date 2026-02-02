'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function createUser(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as string;
    const organizationId = formData.get('organizationId') as string;
    const branchId = formData.get('branchId') as string;

    if (!email || !password || !fullName || !role || !organizationId) {
        return { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
    }

    // Branch ID validation: Sales, Inventory, and Branch Manager MUST have a branch
    if (['sales', 'inventory', 'manager'].includes(role) && !branchId && role !== 'manager') {
        // Note: Manager can be NULL (HQ), but let's encourage explicit 'HQ' selection if UI supports it, 
        // or just allow null for HQ Manager. For strictness requested by user, 
        // let's assume UI handles "All Branches" as special value or null.
        // However, Sales/Inventory MUST have branch.
        if (['sales', 'inventory'].includes(role) && !branchId) {
            return { error: 'กรุณาระบุสาขาสำหรับตำแหน่งนี้' };
        }
    }

    const supabaseAdmin = createAdminClient();

    try {
        let userId: string;

        // 1. Try to create User
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });

        if (userError) {
            // If user already exists, we'll try to update them instead
            if (userError.message.includes('already been registered')) {
                // Find the existing user
                const { data: { users }, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

                if (!existingUser) {
                    throw new Error('User exists but could not be found via admin API');
                }

                userId = existingUser.id;

                // Check if existing user is an OWNER
                const { data: existingProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('role')
                    .eq('id', userId)
                    .single();

                const isOwner = existingProfile?.role === 'owner';
                const finalRole = isOwner ? 'owner' : role; // Protect OWNER role

                // Update password and metadata for existing user (don't downgrade owners)
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    password: password,
                    user_metadata: { full_name: fullName },
                    email_confirm: true
                });

                if (updateError) throw updateError;

                // 2. Upsert Profile
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .upsert({
                        id: userId,
                        email: email,
                        full_name: fullName,
                        role: finalRole, // Use protected role
                        organization_id: organizationId,
                        branch_id: branchId || null, // Update branch
                    }, { onConflict: 'id' });

                if (profileError) throw profileError;

                // 3. Store Credentials (for Owner visibility) - ADDED THIS BLOCK
                const { error: credError } = await supabaseAdmin
                    .from('staff_credentials')
                    .upsert({
                        user_id: userId,
                        organization_id: organizationId,
                        email: email,
                        plain_password: password
                    }, { onConflict: 'user_id' });

                if (credError) {
                    console.error('Failed to save staff credentials:', credError);
                    return { success: true, warning: 'สร้างผู้ใช้งานสำเร็จ แต่บันทึกรหัสผ่านไม่ผ่าน: ' + credError.message };
                }

                revalidatePath('/dashboard/settings/users');
                return { success: true };
            } else {
                throw userError;
            }
        } else if (userData.user) {
            userId = userData.user.id;

            // 2. Upsert Profile (For new users)
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    email: email,
                    full_name: fullName,
                    role: role,
                    organization_id: organizationId,
                    branch_id: branchId || null, // Insert branch
                    is_active: true
                }, { onConflict: 'id' });

            if (profileError) throw profileError;

            // 3. Store Credentials (for Owner visibility requirement)
            // Only store if NOT owner (Owner shouldn't see their own password in plain text elsewhere ideally, or maybe they do? Let's stick to staff per request but storing all is easier for logic)
            // The request said "Users", so we store for all created via this flow.
            const { error: credError } = await supabaseAdmin
                .from('staff_credentials')
                .upsert({
                    user_id: userId,
                    organization_id: organizationId,
                    email: email,
                    plain_password: password
                }, { onConflict: 'user_id' });

            if (credError) {
                console.error('Failed to save staff credentials:', credError);
                return { success: true, warning: 'สร้างผู้ใช้งานสำเร็จ แต่บันทึกรหัสผ่านไม่ผ่าน: ' + credError.message };
            }

            revalidatePath('/dashboard/settings/users');
            return { success: true };
        } else {
            throw new Error('Failed to create user');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Create user error:', error);
        return { error: error.message };
    }
}

export async function getStaffCredential(userId: string) {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();

    // 1. Verify Requestor
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

    if (!requesterProfile || (requesterProfile.role !== 'owner' && requesterProfile.role !== 'OWNER')) {
        return { error: 'Access Denied: Only Owners can view passwords' };
    }

    // 2. Fetch Credential (Bypass RLS to be safe, since we manually checked)
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
        .from('staff_credentials')
        .select('plain_password, organization_id')
        .eq('user_id', userId)
        .maybeSingle(); // Prevent "Cannot coerce" error

    if (error) return { error: error.message };
    if (!data) return { error: 'Password not found' };

    // 3. Safety Check: Same Organization
    if (data.organization_id !== requesterProfile.organization_id) {
        return { error: 'Access Denied: Different Organization' };
    }

    return { password: data.plain_password };
}

export async function deleteUser(userId: string) {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();

    // 1. Verify Requestor is Owner
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

    if (!requesterProfile || (requesterProfile.role !== 'owner' && requesterProfile.role !== 'OWNER')) {
        return { error: 'Access Denied: Only Owners can delete users' };
    }

    // 2. Perform Delete via Admin
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabaseAdmin = createAdminClient();

    // Verify target user is in same org (optional safety, but Auth delete is global by ID. 
    // We strictly should check if target user belongs to requester's org to prevent cross-tenant deletion attacks if ID is guessed)
    const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    // If profile gone but auth exists? Proceed to delete auth anyway if we can confirm it's "our" user? 
    // If profile is gone, we can't easily check org. But for this specific bug (orphaned auth), 
    // maybe we skip this check or check metadata? 
    // Let's stick to Profile check. If Profile is gone (phantom), we might need to rely on the Owner trusting the ID they clicked.

    if (targetProfile && targetProfile.organization_id !== requesterProfile.organization_id) {
        return { error: 'Access Denied: User belongs to another organization' };
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) return { error: error.message };

    revalidatePath('/dashboard/settings/users');
    return { success: true };
}
