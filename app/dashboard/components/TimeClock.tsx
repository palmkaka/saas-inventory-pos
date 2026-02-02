'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function TimeClock() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'IDLE' | 'ON_DUTY'>('IDLE');
    const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

    // Fetch initial status
    useEffect(() => {
        async function checkStatus() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check for active entry (status = 'ON_DUTY')
            const { data: entry } = await supabase
                .from('time_entries')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'ON_DUTY')
                .single();

            if (entry) {
                setStatus('ON_DUTY');
                setCurrentEntryId(entry.id);
                setStartTime(new Date(entry.clock_in));
            } else {
                setStatus('IDLE');
            }
            setLoading(false);
        }
        checkStatus();
    }, [supabase]);

    // Timer for elapsed time
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'ON_DUTY' && startTime) {
            interval = setInterval(() => {
                const now = new Date();
                const diff = now.getTime() - startTime.getTime();
                
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setElapsedTime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status, startTime]);

    const handleClockIn = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, branch_id')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Profile not found');

            const { data: entry, error } = await supabase
                .from('time_entries')
                .insert({
                    organization_id: profile.organization_id,
                    user_id: user.id,
                    branch_id: profile.branch_id, // Default to assigned branch
                    status: 'ON_DUTY',
                    clock_in: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) throw error;

            setStatus('ON_DUTY');
            setCurrentEntryId(entry.id);
            setStartTime(new Date(entry.clock_in));
        } catch (error: any) {
            alert('Error clocking in: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!confirm('ยืนยันการลงเวลาเลิกงาน?')) return;
        
        setLoading(true);
        try {
            const { error } = await supabase
                .from('time_entries')
                .update({
                    clock_out: new Date().toISOString(),
                    status: 'COMPLETED'
                })
                .eq('id', currentEntryId);

            if (error) throw error;

            setStatus('IDLE');
            setCurrentEntryId(null);
            setStartTime(null);
            setElapsedTime('00:00:00');
        } catch (error: any) {
            alert('Error clocking out: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="animate-pulse h-32 bg-slate-800 rounded-xl"></div>;
    }

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
                <h3 className="text-slate-400 font-medium mb-1">ระบบลงเวลาทำงาน</h3>
                
                {status === 'ON_DUTY' ? (
                    <>
                        <div className="text-4xl font-bold text-white tracking-widest font-mono my-4">
                            {elapsedTime}
                        </div>
                        <p className="text-emerald-400 text-sm mb-6 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            กำลังปฏิบัติงาน (เข้างาน {startTime?.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})})
                        </p>
                        <button
                            onClick={handleClockOut}
                            disabled={loading}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all transform hover:scale-105 active:scale-95"
                        >
                            ลงเวลาเลิกงาน (Clock Out)
                        </button>
                    </>
                ) : (
                    <>
                        <div className="text-4xl font-bold text-slate-500 tracking-widest font-mono my-4 opacity-50">
                            --:--:--
                        </div>
                        <p className="text-slate-400 text-sm mb-6">คุณยังไม่ได้ลงเวลาเข้างาน</p>
                        <button
                            onClick={handleClockIn}
                            disabled={loading}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-95"
                        >
                            ลงเวลาเข้างาน (Clock In)
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
