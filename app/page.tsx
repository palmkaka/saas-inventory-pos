'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [signupsAllowed, setSignupsAllowed] = useState(true);

  useEffect(() => {
    async function checkSettings() {
      const supabase = createClient();
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();

      if (data && data.value === 'true') {
        setMaintenanceMode(true);
      }

      const { data: signupsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'allow_signups')
        .single();

      if (signupsData && signupsData.value === 'false') {
        setSignupsAllowed(false);
      }
    }
    checkSettings();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Auto-append dummy domain if username is entered
    let finalEmail = email;
    if (!email.includes('@')) {
      finalEmail = `${email}@no-email.local`;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: finalEmail,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Check Maintenance Mode
    if (maintenanceMode) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_platform_admin, role')
          .eq('id', user.id)
          .single();

        // Allow if Platform Admin OR explicitly whitelisted role (optional, for now strictly platform admin or maybe 'owner')
        // Let's stick to Platform Admin as per requirement "Admin เข้าได้ปกติ" implies Super Admin usually, 
        // but maybe "System Administrator" which is usually the Owner.
        // Let's check is_platform_admin.

        if (!profile?.is_platform_admin) {
          await supabase.auth.signOut();
          setError('ระบบอยู่ระหว่างการปิดปรับปรุง (Maintenance Mode)');
          setLoading(false);
          return;
        }
      }
    }

    // Redirect based on role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_platform_admin) {
        router.push('/admin');
        router.refresh();
        return;
      }
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg bg-white p-1">
              <img src="/logo.jpg" alt="EVOLUTION HRD" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white">EVOLUTION HRD SYSTEM</h1>
            <p className="text-slate-400 mt-2">เข้าสู่ระบบเพื่อจัดการธุรกิจของคุณ</p>
          </div>

          {/* Maintenance Alert */}
          {maintenanceMode && (
            <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-orange-400 font-medium text-sm">ปิดปรับปรุงระบบ</h3>
                <p className="text-orange-400/80 text-xs mt-1">
                  ระบบเปิดให้เฉพาะผู้ดูแลระบบเข้าใช้งานเท่านั้น ผู้ใช้งานทั่วไปจะไม่สามารถเข้าสู่ระบบได้
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">อีเมล หรือ ชื่อผู้ใช้</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="กรอกอีเมล หรือ ชื่อผู้ใช้"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบ</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            {signupsAllowed && (
              <p className="text-slate-500 text-sm">
                ยังไม่มีบัญชี? <a href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">สมัครสมาชิก</a>
              </p>
            )}
          </div>
        </div>

        {/* Bottom Text */}
        <p className="text-center text-slate-600 text-sm mt-6">
          © 2026 EVOLUTION HRD SYSTEM. สงวนลิขสิทธิ์
        </p>
      </div>
    </div>
  );
}
