'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface ApiKey {
    id: string;
    key_name: string;
    api_key: string;
    permissions: string[];
    is_active: boolean;
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
}

export default function ApiKeysPage() {
    const supabase = createClient();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read']);
    const [newKeyExpiry, setNewKeyExpiry] = useState('');
    const [generatedKey, setGeneratedKey] = useState<{ apiKey: string; apiSecret: string } | null>(null);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    useEffect(() => {
        fetchApiKeys();
    }, []);

    async function fetchApiKeys() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return;
        setOrganizationId(profile.organization_id);

        const { data } = await supabase
            .from('api_keys')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

        setApiKeys(data || []);
        setLoading(false);
    }

    async function createApiKey() {
        if (!organizationId || !newKeyName.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Generate keys client-side (in production, do this server-side)
        const apiKey = `sk_live_${generateRandomString(48)}`;
        const apiSecret = generateRandomString(64);
        const secretHash = await hashString(apiSecret);

        const { error } = await supabase.from('api_keys').insert({
            organization_id: organizationId,
            key_name: newKeyName,
            api_key: apiKey,
            secret_hash: secretHash,
            permissions: newKeyPermissions,
            expires_at: newKeyExpiry || null,
            created_by: user.id
        });

        if (!error) {
            setGeneratedKey({ apiKey, apiSecret });
            fetchApiKeys();
        } else {
            alert('ไม่สามารถสร้าง API Key ได้: ' + error.message);
        }
    }

    async function toggleKeyStatus(id: string, isActive: boolean) {
        await supabase
            .from('api_keys')
            .update({ is_active: !isActive })
            .eq('id', id);
        fetchApiKeys();
    }

    async function deleteKey(id: string) {
        if (!confirm('ยืนยันการลบ API Key นี้?')) return;
        await supabase.from('api_keys').delete().eq('id', id);
        fetchApiKeys();
    }

    function generateRandomString(length: number): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async function hashString(str: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        alert('คัดลอกแล้ว!');
    }

    const togglePermission = (perm: string) => {
        setNewKeyPermissions(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">🔑 API Keys</h1>
                    <p className="text-slate-400">จัดการ API Keys สำหรับการเชื่อมต่อระบบภายนอก</p>
                </div>
                <button
                    onClick={() => {
                        setIsModalOpen(true);
                        setNewKeyName('');
                        setNewKeyPermissions(['read']);
                        setNewKeyExpiry('');
                        setGeneratedKey(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                >
                    ➕ สร้าง API Key
                </button>
            </div>

            {/* API Documentation */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-bold mb-3">📚 API Endpoints</h2>
                <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">GET</span>
                        <code className="text-slate-300">/api/v1/products</code>
                        <span className="text-slate-500">- ดึงรายการสินค้า</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">POST</span>
                        <code className="text-slate-300">/api/v1/products</code>
                        <span className="text-slate-500">- สร้างสินค้าใหม่</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">GET</span>
                        <code className="text-slate-300">/api/v1/orders</code>
                        <span className="text-slate-500">- ดึงรายการออเดอร์</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">GET</span>
                        <code className="text-slate-300">/api/v1/inventory</code>
                        <span className="text-slate-500">- ดึงข้อมูลสต็อก</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">PATCH</span>
                        <code className="text-slate-300">/api/v1/inventory</code>
                        <span className="text-slate-500">- อัพเดทสต็อก</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">GET</span>
                        <code className="text-slate-300">/api/v1/reports/summary</code>
                        <span className="text-slate-500">- สรุปยอดขาย</span>
                    </div>
                </div>
                <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-2">🔐 Headers ที่ต้องส่ง:</p>
                    <code className="text-xs text-slate-300">
                        X-API-Key: sk_live_xxx...<br />
                        X-API-Secret: xxx...
                    </code>
                </div>
            </div>

            {/* API Keys Table */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
                ) : apiKeys.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        ยังไม่มี API Key กดปุ่ม "สร้าง API Key" เพื่อเริ่มต้น
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-400 uppercase">
                            <tr>
                                <th className="px-4 py-3">ชื่อ</th>
                                <th className="px-4 py-3">API Key</th>
                                <th className="px-4 py-3">สิทธิ์</th>
                                <th className="px-4 py-3">สถานะ</th>
                                <th className="px-4 py-3">ใช้ล่าสุด</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {apiKeys.map(key => (
                                <tr key={key.id} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-3 font-medium">{key.key_name}</td>
                                    <td className="px-4 py-3">
                                        <code className="text-slate-400 text-xs">
                                            {key.api_key.substring(0, 15)}...
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(key.api_key)}
                                            className="ml-2 text-blue-400 hover:text-blue-300"
                                        >
                                            📋
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        {key.permissions.map(p => (
                                            <span key={p} className="mr-1 px-2 py-0.5 bg-slate-700 rounded text-xs">
                                                {p}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${key.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {key.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">
                                        {key.last_used_at
                                            ? new Date(key.last_used_at).toLocaleDateString('th-TH')
                                            : 'ยังไม่เคยใช้'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => toggleKeyStatus(key.id, key.is_active)}
                                            className="text-amber-400 hover:text-amber-300 mr-2"
                                        >
                                            {key.is_active ? '⏸️' : '▶️'}
                                        </button>
                                        <button
                                            onClick={() => deleteKey(key.id)}
                                            className="text-red-400 hover:text-red-300"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Key Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
                        {generatedKey ? (
                            <>
                                <h3 className="text-xl font-bold text-white mb-4">✅ API Key สร้างเรียบร้อย!</h3>
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                                    <p className="text-amber-400 text-sm">
                                        ⚠️ กรุณาบันทึก Secret ไว้ เพราะจะแสดงเพียงครั้งเดียวเท่านั้น!
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">API Key:</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={generatedKey.apiKey}
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(generatedKey.apiKey)}
                                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">API Secret:</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={generatedKey.apiSecret}
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(generatedKey.apiSecret)}
                                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                                >
                                    ปิด
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-white mb-4">🔑 สร้าง API Key ใหม่</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">ชื่อ API Key</label>
                                        <input
                                            type="text"
                                            value={newKeyName}
                                            onChange={e => setNewKeyName(e.target.value)}
                                            placeholder="เช่น E-commerce Integration"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">สิทธิ์การใช้งาน</label>
                                        <div className="flex gap-2">
                                            {['read', 'write', 'admin'].map(perm => (
                                                <button
                                                    key={perm}
                                                    onClick={() => togglePermission(perm)}
                                                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${newKeyPermissions.includes(perm)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                        }`}
                                                >
                                                    {perm}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">วันหมดอายุ (ไม่บังคับ)</label>
                                        <input
                                            type="date"
                                            value={newKeyExpiry}
                                            onChange={e => setNewKeyExpiry(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={createApiKey}
                                        disabled={!newKeyName.trim()}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg font-bold"
                                    >
                                        สร้าง
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
