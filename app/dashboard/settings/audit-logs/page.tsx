import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AuditLogClient from './AuditLogClient';

interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    table_name: string;
    record_id: string | null;
    old_value: any;
    new_value: any;
    created_at: string;
    profiles: {
        full_name: string | null;
        email: string;
    } | null;
}

async function getAuditLogs() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { logs: [], currentUserRole: null };
    }

    // เฉพาะ Owner และ Manager เท่านั้นที่เห็น Audit Logs
    if (profile.role !== 'owner' && profile.role !== 'manager') {
        return { error: 'Unauthorized' };
    }

    const { data: logs, error } = await supabase
        .from('audit_logs')
        .select(`
            id,
            user_id,
            action,
            table_name,
            record_id,
            old_value,
            new_value,
            created_at,
            profiles (
                full_name,
                email
            )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching audit logs:', error);
        return { logs: [], currentUserRole: profile.role };
    }

    const formattedLogs = logs?.map((log: any) => ({
        ...log,
        profiles: Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
    })) || [];

    return {
        logs: formattedLogs,
        currentUserRole: profile.role
    };
}

export default async function AuditLogPage() {
    const data = await getAuditLogs();

    if ('error' in data) {
        if (data.error === 'Not authenticated') {
            redirect('/');
        }
        if (data.error === 'Unauthorized') {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-md">
                        <h2 className="text-xl font-bold text-red-400 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
                        <p className="text-slate-300">เฉพาะ Owner และ Manager เท่านั้นที่สามารถดู Audit Logs ได้</p>
                    </div>
                </div>
            );
        }
    }

    const { logs, currentUserRole } = data as any;

    return (
        <div className="min-h-screen bg-slate-900">
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">ประวัติการใช้งาน (Audit Logs)</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            บันทึกการเปลี่ยนแปลงข้อมูลทั้งหมดในระบบ
                        </p>
                    </div>
                </div>
            </header>

            <main className="p-6">
                <AuditLogClient logs={logs || []} currentUserRole={currentUserRole} />
            </main>
        </div>
    );
}
