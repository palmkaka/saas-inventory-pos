'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Helper to get the correct supabase client (bypass RLS if impersonating)
async function getSupabaseClient(targetOrgId?: string) {
    const supabase = await createClient(); // Authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return supabase;

    // Check if platform admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin, organization_id')
        .eq('id', user.id)
        .single();

    // If Admin and impersonating
    if (profile?.is_platform_admin) {
        const cookieStore = await cookies();
        const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;

        // If targetOrgId provided, ensure it matches impersonation or user is God
        if (impersonatedOrgId && (!targetOrgId || targetOrgId === impersonatedOrgId)) {
            // Create Service Role Client
            return createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
        }
    }

    return supabase;
}

export async function fetchPayrollPeriods(orgId: string) {
    if (!orgId) return { data: [], error: 'No Organization ID' };

    const supabase = await getSupabaseClient(orgId);

    // If using Service Role, we must filter manually? No, RLS is bypassed, so we MUST filter by WHERE.
    // If using Standard Client, RLS filters automatically, but we add eq() for safety.

    const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('organization_id', orgId)
        .order('period_start', { ascending: false });

    if (error) {
        console.error('fetchPayrollPeriods error:', error);
        return { data: [], error: error.message };
    }
    return { data };
}

export async function fetchPayrollRecords(periodId: string, orgId: string) {
    const supabase = await getSupabaseClient(orgId);

    const { data, error } = await supabase
        .from('payroll_records')
        .select(`
            *,
            profile:profiles(first_name, last_name, email)
        `)
        .eq('period_id', periodId)
        .order('net_salary', { ascending: false });

    if (error) {
        console.error('fetchPayrollRecords error:', error);
        return { data: [], error: error.message };
    }
    return { data };
}

export async function createPayrollPeriod(data: any, orgId: string) {
    const supabase = await getSupabaseClient(orgId);

    // If using Admin Client, we need to know who created it for 'created_by' field?
    // 'created_by' refers to auth.users.id
    // If using Service Role, auth.uid() is null usually.
    // So we might need to fetch the real user ID from the session first if we want to record 'created_by'.
    // However, the `getSupabaseClient` logic gets the session user anyway.

    // Let's get the real user ID to insert.
    const cookieStore = await cookies();
    const standardSupabase = await createClient();
    const { data: { user } } = await standardSupabase.auth.getUser();

    const { error } = await supabase.from('payroll_periods').insert({
        ...data,
        organization_id: orgId,
        created_by: user?.id
    });

    if (error) {
        throw new Error(error.message);
    }

    return { success: true };
}

export async function markPeriodAsPaid(periodId: string, orgId: string) {
    const supabase = await getSupabaseClient(orgId);

    const { error } = await supabase
        .from('payroll_periods')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('id', periodId);

    if (error) throw new Error(error.message);
    return { success: true };
}


// Calculation Logic - Ported from Client
export async function calculatePayrollAction(periodId: string, periodStart: string, periodEnd: string, orgId: string) {
    const supabase = await getSupabaseClient(orgId);

    try {
        // Fetch employees
        const { data: salaries } = await supabase
            .from('employee_salaries')
            .select('*')
            .eq('organization_id', orgId);

        if (!salaries || salaries.length === 0) {
            return { error: 'ไม่พบข้อมูลเงินเดือนพนักงาน' };
        }

        // Fetch data
        const { data: timeEntries } = await supabase
            .from('time_entries')
            .select('user_id, work_duration_minutes')
            .eq('organization_id', orgId)
            .eq('status', 'COMPLETED')
            .gte('clock_in', `${periodStart}T00:00:00`)
            .lte('clock_in', `${periodEnd}T23:59:59`);

        const { data: commissions } = await supabase
            .from('commission_records')
            .select('user_id, commission_amount')
            .eq('organization_id', orgId)
            .gte('created_at', `${periodStart}T00:00:00`)
            .lte('created_at', `${periodEnd}T23:59:59`);

        const { data: loans } = await supabase
            .from('employee_loans')
            .select('*')
            .eq('organization_id', orgId)
            .eq('status', 'ACTIVE');

        // Calculate
        const payrollRecords = [];

        for (const salary of salaries) {
            // Hours
            const userTimeEntries = (timeEntries || []).filter((t: any) => t.user_id === salary.user_id);
            const totalMinutes = userTimeEntries.reduce((sum: number, t: any) => sum + (t.work_duration_minutes || 0), 0);
            const hoursWorked = totalMinutes / 60;
            const daysWorked = Math.ceil(hoursWorked / 8);

            // Base Salary
            let baseSalary = 0;
            if (salary.salary_type === 'MONTHLY') {
                baseSalary = salary.base_amount;
            } else if (salary.salary_type === 'DAILY') {
                baseSalary = salary.base_amount * daysWorked;
            } else if (salary.salary_type === 'HOURLY') {
                baseSalary = salary.base_amount * hoursWorked;
            }

            // Commission
            const userCommissions = (commissions || []).filter((c: any) => c.user_id === salary.user_id);
            const commissionTotal = userCommissions.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);

            // Allowances
            const positionAllowance = salary.position_allowance || 0;
            const diligenceAllowance = salary.diligence_allowance || 0;
            const otherAllowance = salary.other_allowance || 0;

            // Earnings
            const totalEarnings = baseSalary + commissionTotal + positionAllowance + diligenceAllowance + otherAllowance;

            // Deductions
            let socialSecurity = 0;
            if (salary.social_security_enabled) {
                socialSecurity = Math.min(totalEarnings * 0.05, 750);
            }

            let withholdingTax = 0;
            if (salary.withholding_tax_enabled && totalEarnings > 26000) {
                withholdingTax = (totalEarnings - 26000) * 0.05;
            }

            const userLoans = (loans || []).filter((l: any) => l.user_id === salary.user_id);
            const loanDeduction = userLoans.reduce((sum: number, l: any) => sum + (l.monthly_deduction || 0), 0);

            const totalDeductions = socialSecurity + withholdingTax + loanDeduction;
            const netSalary = totalEarnings - totalDeductions;

            payrollRecords.push({
                organization_id: orgId,
                period_id: periodId,
                user_id: salary.user_id,
                base_salary: baseSalary,
                hours_worked: hoursWorked,
                days_worked: daysWorked,
                position_allowance: positionAllowance,
                diligence_allowance: diligenceAllowance,
                other_allowance: otherAllowance,
                commission_total: commissionTotal,
                total_earnings: totalEarnings,
                social_security: socialSecurity,
                withholding_tax: withholdingTax,
                loan_deduction: loanDeduction,
                other_deduction: 0,
                total_deductions: totalDeductions,
                net_salary: netSalary
            });
        }

        // Delete old
        await supabase.from('payroll_records').delete().eq('period_id', periodId);

        // Insert new
        if (payrollRecords.length > 0) {
            await supabase.from('payroll_records').insert(payrollRecords);
        }

        // Update status
        await supabase
            .from('payroll_periods')
            .update({ status: 'CALCULATED', calculated_at: new Date().toISOString() })
            .eq('id', periodId);

        return { success: true };

    } catch (error: any) {
        console.error('Calculation Error:', error);
        return { error: error.message };
    }
}
