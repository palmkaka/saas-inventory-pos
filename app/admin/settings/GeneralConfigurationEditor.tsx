'use client';

import { useState } from 'react';
import { updateSystemSetting } from './actions';
import { Loader2, Power, UserPlus } from 'lucide-react';

interface GeneralConfigurationEditorProps {
    settings: {
        maintenance_mode?: string;
        allow_signups?: string;
        [key: string]: string | undefined;
    };
}

export default function GeneralConfigurationEditor({ settings }: GeneralConfigurationEditorProps) {
    const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode === 'true');
    const [allowSignups, setAllowSignups] = useState(settings.allow_signups === 'true');
    const [loading, setLoading] = useState<string | null>(null);

    const handleToggle = async (key: string, currentValue: boolean, setter: (val: boolean) => void) => {
        setLoading(key);
        const newValue = !currentValue;

        try {
            const result = await updateSystemSetting(key, String(newValue));
            if (result.success) {
                setter(newValue);
            } else {
                alert('Failed to update setting: ' + result.error);
            }
        } catch (error) {
            console.error('Error toggling setting:', error);
            alert('An unexpected error occurred.');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="space-y-6">

                {/* Maintenance Mode */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium flex items-center gap-2">
                            <Power size={18} className="text-rose-500" />
                            Maintenance Mode
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                            ปิดปรับปรุงระบบชั่วคราว (User ทั่วไปจะเข้าไม่ได้ Admin เข้าได้ปกติ)
                        </p>
                    </div>
                    <button
                        onClick={() => handleToggle('maintenance_mode', maintenanceMode, setMaintenanceMode)}
                        disabled={loading === 'maintenance_mode'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${maintenanceMode ? 'bg-rose-600' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                        {loading === 'maintenance_mode' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 size={12} className="animate-spin text-white" />
                            </div>
                        )}
                    </button>
                </div>

                <div className="border-t border-slate-800" />

                {/* Allow Signups */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium flex items-center gap-2">
                            <UserPlus size={18} className="text-blue-500" />
                            Allow New Signups
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                            เปิดให้สมัครสมาชิกใหม่ (ถ้าปิด หน้าสมัครสมาชิกจะซ่อน)
                        </p>
                    </div>
                    <button
                        onClick={() => handleToggle('allow_signups', allowSignups, setAllowSignups)}
                        disabled={loading === 'allow_signups'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${allowSignups ? 'bg-blue-600' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowSignups ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                        {loading === 'allow_signups' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 size={12} className="animate-spin text-white" />
                            </div>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
