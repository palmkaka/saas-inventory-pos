'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface NotifySettings {
    line_notify_token: string | null;
    notify_daily_sales: boolean;
    notify_low_stock: boolean;
    notify_large_orders: boolean;
    notify_clock_in_out: boolean;
    large_order_threshold: number;
}

export default function LineNotifySettingsPage() {
    const supabase = createClient();
    const [settings, setSettings] = useState<NotifySettings>({
        line_notify_token: '',
        notify_daily_sales: true,
        notify_low_stock: true,
        notify_large_orders: false,
        notify_clock_in_out: false,
        large_order_threshold: 5000
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [showToken, setShowToken] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
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

        const { data: org } = await supabase
            .from('organizations')
            .select('line_notify_token, notify_daily_sales, notify_low_stock, notify_large_orders, notify_clock_in_out, large_order_threshold')
            .eq('id', profile.organization_id)
            .single();

        if (org) {
            setSettings({
                line_notify_token: org.line_notify_token || '',
                notify_daily_sales: org.notify_daily_sales ?? true,
                notify_low_stock: org.notify_low_stock ?? true,
                notify_large_orders: org.notify_large_orders ?? false,
                notify_clock_in_out: org.notify_clock_in_out ?? false,
                large_order_threshold: org.large_order_threshold ?? 5000
            });
        }
        setLoading(false);
    }

    async function saveSettings() {
        if (!organizationId) return;
        setSaving(true);

        const { error } = await supabase
            .from('organizations')
            .update({
                line_notify_token: settings.line_notify_token || null,
                notify_daily_sales: settings.notify_daily_sales,
                notify_low_stock: settings.notify_low_stock,
                notify_large_orders: settings.notify_large_orders,
                notify_clock_in_out: settings.notify_clock_in_out,
                large_order_threshold: settings.large_order_threshold
            })
            .eq('id', organizationId);

        setSaving(false);
        if (error) {
            alert('บันทึกไม่สำเร็จ: ' + error.message);
        } else {
            alert('✅ บันทึกเรียบร้อย!');
        }
    }

    async function testNotify() {
        if (!settings.line_notify_token) {
            alert('กรุณากรอก LINE Notify Token ก่อน');
            return;
        }
        setTesting(true);

        try {
            const response = await fetch('/api/line-notify/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: settings.line_notify_token })
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ ส่งข้อความทดสอบสำเร็จ! ตรวจสอบ LINE ของคุณ');
            } else {
                alert('❌ ส่งไม่สำเร็จ: ' + result.error);
            }
        } catch {
            alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }

        setTesting(false);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white">กำลังโหลด...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">💬 LINE Notify</h1>
                    <p className="text-slate-400">ตั้งค่าการแจ้งเตือนผ่าน LINE</p>
                </div>

                {/* How to get token */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                    <h3 className="font-bold text-blue-400 mb-2">📝 วิธีรับ LINE Notify Token</h3>
                    <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                        <li>ไปที่ <a href="https://notify-bot.line.me/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">notify-bot.line.me</a></li>
                        <li>Login ด้วย LINE account</li>
                        <li>ไปที่ &quot;My page&quot; → &quot;Generate token&quot;</li>
                        <li>เลือกกลุ่มที่ต้องการรับแจ้งเตือน หรือ &quot;1-on-1 chat&quot;</li>
                        <li>คัดลอก Token มาใส่ด้านล่าง</li>
                    </ol>
                </div>

                {/* Token Input */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
                    <label className="block text-slate-400 text-sm mb-2">LINE Notify Token</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={settings.line_notify_token || ''}
                                onChange={e => setSettings({ ...settings, line_notify_token: e.target.value })}
                                placeholder="ใส่ Token ที่ได้จาก LINE Notify"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white pr-12"
                            />
                            <button
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                {showToken ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <button
                            onClick={testNotify}
                            disabled={testing || !settings.line_notify_token}
                            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg"
                        >
                            {testing ? '⏳' : '🔔'} ทดสอบ
                        </button>
                    </div>
                </div>

                {/* Notification Settings */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
                    <h3 className="font-bold mb-4">🔔 ประเภทการแจ้งเตือน</h3>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900">
                            <div>
                                <div className="font-medium">📊 สรุปยอดขายประจำวัน</div>
                                <div className="text-slate-400 text-sm">แจ้งสรุปยอดขายทุกวันเวลา 00:00</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.notify_daily_sales}
                                onChange={e => setSettings({ ...settings, notify_daily_sales: e.target.checked })}
                                className="w-5 h-5 rounded accent-blue-600"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900">
                            <div>
                                <div className="font-medium">⚠️ สต็อกใกล้หมด</div>
                                <div className="text-slate-400 text-sm">แจ้งเตือนเมื่อสินค้าเหลือน้อยกว่าขั้นต่ำ</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.notify_low_stock}
                                onChange={e => setSettings({ ...settings, notify_low_stock: e.target.checked })}
                                className="w-5 h-5 rounded accent-blue-600"
                            />
                        </label>

                        <div className="p-3 bg-slate-900/50 rounded-lg">
                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <div className="font-medium">🎉 ออเดอร์ใหญ่</div>
                                    <div className="text-slate-400 text-sm">แจ้งเตือนเมื่อมีออเดอร์เกินยอดที่กำหนด</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.notify_large_orders}
                                    onChange={e => setSettings({ ...settings, notify_large_orders: e.target.checked })}
                                    className="w-5 h-5 rounded accent-blue-600"
                                />
                            </label>
                            {settings.notify_large_orders && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-slate-400 text-sm">ยอดขั้นต่ำ:</span>
                                    <input
                                        type="number"
                                        value={settings.large_order_threshold}
                                        onChange={e => setSettings({ ...settings, large_order_threshold: parseInt(e.target.value) || 0 })}
                                        className="w-32 bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white"
                                    />
                                    <span className="text-slate-400 text-sm">บาท</span>
                                </div>
                            )}
                        </div>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900">
                            <div>
                                <div className="font-medium">🕐 พนักงานลงเวลา</div>
                                <div className="text-slate-400 text-sm">แจ้งเตือนเมื่อพนักงานเข้า/ออกงาน</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.notify_clock_in_out}
                                onChange={e => setSettings({ ...settings, notify_clock_in_out: e.target.checked })}
                                className="w-5 h-5 rounded accent-blue-600"
                            />
                        </label>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-lg"
                >
                    {saving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
                </button>
            </div>
        </div>
    );
}
