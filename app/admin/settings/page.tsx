import { createClient } from '@/utils/supabase/server';
import { Settings, CreditCard, LayoutGrid } from 'lucide-react';
import AddPlanModal from './AddPlanModal';
import EditPlanModal from './EditPlanModal';
import DeletePlanButton from './DeletePlanButton';
import GeneralConfigurationEditor from './GeneralConfigurationEditor';
import { getSystemSettings } from './actions';

async function getSubscriptionPlans() {
    const supabase = await createClient();
    const { data } = await supabase.from('subscription_plans').select('*').order('sort_order');
    return data || [];
}

export default async function AdminSettingsPage() {
    const plansPromise = getSubscriptionPlans();
    const settingsPromise = getSystemSettings();

    const [plans, settings] = await Promise.all([plansPromise, settingsPromise]);

    return (
        <div className="p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-white">ตั้งค่าระบบ (System Settings)</h1>
                <p className="text-slate-400 mt-2">จัดการการตั้งค่าพื้นฐานและแพ็กเกจสมาชิก</p>
            </header>

            {/* Subscription Plans Section */}
            <section>
                <div className="flex items-center gap-2 mb-4 text-white text-xl font-semibold border-b border-slate-800 pb-2">
                    <CreditCard className="text-rose-500" />
                    <h2>Subscription Plans (แพ็กเกจราคา)</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.map((plan) => (
                        <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-rose-500/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white capitalize">{plan.display_name}</h3>
                                    {plan.is_active && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                            <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Active</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <EditPlanModal plan={plan} />
                                    <DeletePlanButton planId={plan.id} />
                                </div>
                            </div>

                            <div className="mb-6">
                                <span className="text-3xl font-bold text-white">฿{plan.price}</span>
                                <span className="text-slate-500 text-sm"> / {plan.billing_period}</span>
                            </div>

                            <div className="space-y-2 text-sm text-slate-400">
                                <div className="flex justify-between">
                                    <span>Products:</span>
                                    <span className="text-slate-200">{plan.max_products === -1 ? 'Unlimited' : plan.max_products}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Branches:</span>
                                    <span className="text-slate-200">{plan.max_branches === -1 ? 'Unlimited' : plan.max_branches}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Staff:</span>
                                    <span className="text-slate-200">{plan.max_employees === -1 ? 'Unlimited' : plan.max_employees}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add New Plan Button/Modal */}
                    <AddPlanModal />
                </div>
            </section>

            {/* Global Config Section */}
            <section>
                <div className="flex items-center gap-2 mb-4 text-white text-xl font-semibold border-b border-slate-800 pb-2">
                    <Settings className="text-slate-500" />
                    <h2>General Configuration</h2>
                </div>
                <GeneralConfigurationEditor settings={settings} />
            </section>
        </div>
    );
}
