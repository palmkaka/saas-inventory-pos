import { createClient } from '@/utils/supabase/server';
import { FileText, Search, User, Database, Clock, ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';

async function getAuditLogs(filter: string = '') {
    const supabase = await createClient();

    let query = supabase
        .from('audit_logs')
        .select(`
            *,
            profiles:user_id ( email, first_name, last_name ),
            organizations:organization_id ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (filter) {
        query = query.or(`table_name.ilike.%${filter}%, action.ilike.%${filter}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching audit logs:', error);
        return [];
    }
    return data || [];
}

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams: { q?: string };
}) {
    const query = searchParams.q || '';
    const logs = await getAuditLogs(query);

    const getActionColor = (action: string) => {
        switch (action.toLowerCase()) {
            case 'create': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'update': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'delete': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    return (
        <div className="p-8 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <FileText className="text-blue-400" />
                        Audit Logs
                    </h1>
                    <p className="text-slate-400 mt-2">ประวัติการใช้งานระบบและการแก้ไขข้อมูล</p>
                </div>
            </header>

            {/* Search Filter */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <form className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            name="q"
                            defaultValue={query}
                            placeholder="ค้นหาตาม Action หรือ Table Name..."
                            className="w-full bg-slate-800 border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                        ค้นหา
                    </button>
                    {query && (
                        <a href="/admin/logs" className="flex items-center justify-center px-4 py-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                            ล้างค่า
                        </a>
                    )}
                </form>
            </div>

            {/* Logs Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/50 text-slate-400 text-sm">
                            <tr>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Resource</th>
                                <th className="px-6 py-4">Changes</th>
                                <th className="px-6 py-4">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-6 py-4 align-top">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border uppercase ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-2 text-white">
                                            <User size={14} className="text-slate-500" />
                                            <span>{log.profiles?.email || 'Unknown User'}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 ml-6">
                                            Org: {log.organizations?.name || 'N/A'}
                                        </div>
                                        {log.ip_address && (
                                            <div className="text-xs text-slate-600 ml-6 mt-1 font-mono">
                                                IP: {log.ip_address}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-2 text-slate-300 font-mono">
                                            <Database size={14} className="text-slate-600" />
                                            {log.table_name}
                                        </div>
                                        <div className="text-xs text-slate-600 ml-6">ID: {log.record_id?.slice(0, 8)}...</div>
                                    </td>
                                    <td className="px-6 py-4 align-top max-w-md">
                                        <div className="space-y-2">
                                            {log.old_value && (
                                                <div className="bg-red-950/20 border border-red-900/30 rounded p-2 text-xs font-mono text-red-300/80 overflow-x-auto">
                                                    <div className="flex items-center gap-1 mb-1 text-red-500 font-bold uppercase text-[10px]">
                                                        Old Value
                                                    </div>
                                                    <pre>{JSON.stringify(log.old_value, null, 2)}</pre>
                                                </div>
                                            )}
                                            {log.new_value && (
                                                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded p-2 text-xs font-mono text-emerald-300/80 overflow-x-auto">
                                                    <div className="flex items-center gap-1 mb-1 text-emerald-500 font-bold uppercase text-[10px]">
                                                        New Value
                                                    </div>
                                                    <pre>{JSON.stringify(log.new_value, null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top whitespace-nowrap text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} />
                                            {new Date(log.created_at).toLocaleString('th-TH')}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        ไม่พบประวัติการใช้งาน
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
