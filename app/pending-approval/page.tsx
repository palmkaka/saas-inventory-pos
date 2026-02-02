import { createClient } from '@/utils/supabase/server';
import { Clock, ShieldAlert, XCircle, LogOut, FileWarning } from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';

export default async function PendingApprovalPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Default status
    let status = 'pending';

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select(`
                is_active,
                organizations ( status )
            `)
            .eq('id', user.id)
            .single();

        // 1. Check user status
        if (profile?.is_active === false) {
            status = 'suspended';
        }
        // 2. Check org status
        else if (profile?.organizations) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const orgStatus = (profile.organizations as any).status;
            if (orgStatus) {
                status = orgStatus;
            }
        }
    }

    let content = {
        icon: <Clock size={48} />,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        title: 'รอการอนุมัติจากผู้ดูแลระบบ',
        subtitle: '(Pending Approval)',
        message: 'ขอบคุณที่สมัครใช้บริการ! บัญชีของคุณถูกสร้างเรียบร้อยแล้ว และกำลังอยู่ในระหว่างการตรวจสอบโดยทีมงาน',
        action: 'กรุณารอการติดต่อกลับ หรือ Log in ใหม่ภายหลังเมื่อได้รับการอนุมัติแล้ว'
    };

    if (status === 'suspended') {
        content = {
            icon: <ShieldAlert size={48} />,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            title: 'บัญชีถูกระงับชั่วคราว',
            subtitle: '(Account Suspended)',
            message: 'บัญชีร้านค้าของคุณถูกระงับการใช้งาน อาจเนื่องมาจากปัญหาการชำระเงิน หรือการผิดเงื่อนไขการใช้งาน',
            action: 'กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อตรวจสอบและแก้ไขสถานะ'
        };
    } else if (status === 'rejected') {
        content = {
            icon: <XCircle size={48} />,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            title: 'คำขอของคุณถูกปฏิเสธ',
            subtitle: '(Application Rejected)',
            message: 'ขออภัย ทีมงานไม่สามารถอนุมัติบัญชีร้านค้าของคุณได้ในขณะนี้',
            action: 'หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อ Support'
        };
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="relative">
                {/* Background Glow */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 ${content.color.replace('text-', 'bg-')}/20 blur-3xl rounded-full pointer-events-none`}></div>

                <div className="relative z-10 flex flex-col items-center max-w-lg text-center space-y-6">
                    {/* Icon */}
                    <div className={`w-24 h-24 rounded-full ${content.bg} ${content.color} flex items-center justify-center mb-4 ring-1 ring-white/10`}>
                        {content.icon}
                    </div>

                    {/* Text */}
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white">{content.title}</h1>
                        <p className={`text-lg font-medium ${content.color}`}>{content.subtitle}</p>
                    </div>

                    <p className="text-slate-400 leading-relaxed max-w-md">
                        {content.message}
                    </p>

                    {/* Action Box */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full shadow-lg">
                        <p className="text-slate-300 font-medium">{content.action}</p>
                    </div>

                    <div className="pt-8">
                        <SignOutButton />
                    </div>
                </div>
            </div>
        </div>
    );
}
