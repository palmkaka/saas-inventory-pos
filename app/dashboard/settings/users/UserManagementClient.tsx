'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

import { createUser, getStaffCredential, deleteUser } from './actions';
import { Key } from 'lucide-react';

interface User {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at: string;
}

interface Branch {
    id: string;
    name: string;
}

interface Props {
    users: User[];
    currentUserRole: string | null;
    organizationId: string;
    branches: Branch[];
}

const ROLES = [
    { value: 'owner', label: 'เจ้าของ (Owner)', color: 'text-purple-400' },
    { value: 'manager', label: 'ผู้จัดการ (Manager)', color: 'text-blue-400' },
    { value: 'accountant', label: 'ฝ่ายบัญชี (Accountant)', color: 'text-green-400' },
    { value: 'hr', label: 'ฝ่ายบุคคล (HR)', color: 'text-yellow-400' },
    { value: 'sales', label: 'ฝ่ายขาย (Sales)', color: 'text-pink-400' },
    { value: 'inventory', label: 'ฝ่ายคลัง (Inventory)', color: 'text-indigo-400' },
    { value: 'staff', label: 'พนักงานทั่วไป (Staff)', color: 'text-slate-400' },
];

export default function UserManagementClient({ users: initialUsers, currentUserRole, organizationId, branches }: Props) {
    const supabase = createClient();
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('staff');
    const [newUserBranch, setNewUserBranch] = useState('');
    const [useUsername, setUseUsername] = useState(false); // Toggle for dummy email

    const getRoleLabel = (role: string) => {
        return ROLES.find(r => r.value === role)?.label || role;
    };

    const getRoleColor = (role: string) => {
        return ROLES.find(r => r.value === role)?.color || 'text-slate-400';
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!confirm('คุณต้องการเปลี่ยนบทบาทของผู้ใช้งานนี้หรือไม่?')) {
            return;
        }

        setLoading(true);
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } else {
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            alert('เปลี่ยนบทบาทสำเร็จ!');
        }
        setLoading(false);
    };

    const handleAddUser = async () => {
        if (!newUserEmail || !newUserName || !newUserPassword) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        if (['sales', 'inventory', 'manager'].includes(newUserRole) && !newUserBranch && newUserRole !== 'manager') {
            // Manager might be HQ, but let's encourage branch explicitly if not owner
            // For strictness: Sales/Inventory MUST have branch.
            if (['sales', 'inventory'].includes(newUserRole)) {
                alert('ตำแหน่งนี้จำเป็นต้องระบุสาขา');
                return;
            }
        }

        setLoading(true);

        // Calculate final email
        let finalEmail = newUserEmail;
        if (useUsername) {
            // Validate username characters (alphanumeric only to stay safe)
            const usernameRegex = /^[a-zA-Z0-9._-]+$/;
            if (!usernameRegex.test(newUserEmail)) {
                alert('ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ, ตัวเลข, . หรือ _ เท่านั้น');
                setLoading(false);
                return;
            }
            finalEmail = `${newUserEmail}@no-email.local`.toLowerCase();
        }

        const formData = new FormData();
        formData.append('email', finalEmail);
        formData.append('password', newUserPassword);
        formData.append('fullName', newUserName);
        formData.append('role', newUserRole);
        formData.append('organizationId', organizationId);
        formData.append('branchId', newUserBranch);

        try {
            const result = await createUser(formData);

            if (result.error) {
                alert('เกิดข้อผิดพลาด: ' + result.error);
            } else {
                if (result.warning) {
                    alert(result.warning);
                } else {
                    const message = useUsername
                        ? `เพิ่มผู้ใช้งานสำเร็จ!\n\nUsername: ${newUserEmail}\nPassword: ${newUserPassword}`
                        : 'เพิ่มผู้ใช้งานสำเร็จ! สามารถนำอีเมลและรหัสผ่านไปเข้าสู่ระบบได้ทันที';

                    alert(message);
                }

                setShowAddModal(false);
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserName('');
                setNewUserRole('staff');
                setNewUserBranch('');
                setUseUsername(false);

                // Refresh user list
                window.location.reload();
            }
        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, userEmail: string) => {
        if (!confirm(`คุณต้องการลบผู้ใช้งาน ${userEmail} ออกจากระบบอย่างถาวรหรือไม่?`)) {
            return;
        }

        setLoading(true);
        try {
            const result = await deleteUser(userId);
            if (result.error) {
                alert('เกิดข้อผิดพลาด: ' + result.error);
            } else {
                setUsers(users.filter(u => u.id !== userId));
                alert('ลบผู้ใช้งานสำเร็จ!');
            }
        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleViewPassword = async (userId: string, userName: string) => {
        setLoading(true);
        const result = await getStaffCredential(userId);
        setLoading(false);

        if (result.error) {
            alert(`ไม่สามารถดูรหัสผ่านได้: ${result.error}`);
        } else if (result.password) {
            prompt(`รหัสผ่านของ ${userName}:`, result.password);
        } else {
            alert('ไม่พบข้อมูลรหัสผ่าน (อาจเป็นผู้ใช้งานเก่าที่ไม่ได้ถูกบันทึกไว้)');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
                <div className="text-slate-300">
                    <span className="text-2xl font-bold text-white">{users.length}</span> ผู้ใช้งาน
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    เพิ่มผู้ใช้งาน
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                ชื่อ-อีเมล
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                บทบาท
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                วันที่เพิ่ม
                            </th>
                            {currentUserRole === 'owner' && (
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    จัดการ
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="text-white font-medium">{user.full_name || 'ไม่ระบุชื่อ'}</div>
                                        <div className="text-slate-400 text-sm">{user.email}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {currentUserRole === 'owner' ? (
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            disabled={loading}
                                            className={`bg-slate-700 border border-slate-600 rounded px-3 py-1 ${getRoleColor(user.role)} font-medium`}
                                        >
                                            {ROLES.map(role => (
                                                <option key={role.value} value={role.value}>
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className={`${getRoleColor(user.role)} font-medium`}>
                                            {getRoleLabel(user.role)}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-400">
                                    {new Date(user.created_at).toLocaleDateString('th-TH')}
                                </td>
                                {currentUserRole === 'owner' && (
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleViewPassword(user.id, user.full_name || user.email)}
                                                disabled={loading}
                                                className="p-1 px-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded transition-colors group"
                                                title="ดูรหัสผ่าน"
                                            >
                                                <Key className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.email)}
                                                disabled={loading}
                                                className="p-1 px-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-red-400 rounded transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold text-white mb-4">เพิ่มผู้ใช้งานใหม่</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    ชื่อ-นามสกุล
                                </label>
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                    placeholder="นาย A"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-slate-300 text-sm font-medium">
                                        {useUsername ? 'ชื่อผู้ใช้ (Username)' : 'อีเมล (Email)'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUseUsername(!useUsername);
                                            setNewUserEmail(''); // Clear input on switch
                                        }}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                                    >
                                        {useUsername ? 'ใช้ Email ปกติ' : 'ไม่มี Email?'}
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={useUsername ? "text" : "email"}
                                        value={newUserEmail}
                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        placeholder={useUsername ? "เช่น somchai (ไม่ต้องมี @)" : "user@example.com"}
                                    />
                                    {useUsername && (
                                        <div className="absolute right-3 top-2.5 text-slate-400 text-sm pointer-events-none">
                                            @no-email.local
                                        </div>
                                    )}
                                </div>
                                {useUsername && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        * ระบบจะสร้างอีเมลจำลองให้โดยอัตโนมัติ พนักงานสามารถใช้ชื่อผู้ใช้นี้เข้าสู่ระบบได้เลย
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    รหัสผ่านเริ่มต้น
                                </label>
                                <input
                                    type="password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                    placeholder="กำหนดรหัสผ่าน..."
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    บทบาท
                                </label>
                                <select
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                >
                                    {ROLES.map(role => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Branch Selection - Condition: Not Owner/Accountant/HR (unless requested) */}
                            {/* But simpliest is: Show for everyone, Optional for some */}
                            {/* Let's show it always, but enforce for Sales/Inventory */}
                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    สังกัดสาขา
                                    {['sales', 'inventory'].includes(newUserRole) && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                <select
                                    value={newUserBranch}
                                    onChange={(e) => setNewUserBranch(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                >
                                    <option value="">
                                        {newUserRole === 'owner' ? 'ไม่สังกัดสาขา (สำนักงานใหญ่)' : 'เลือกสาขา...'}
                                    </option>
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    {newUserRole === 'owner' ? 'เจ้าของกิจการสามารถดูได้ทุกสาขาอยู่แล้ว' : 'ระบุสาขาที่พนักงานคนนี้ประจำอยู่'}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleAddUser}
                                disabled={loading}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้งาน'}
                            </button>
                            <button
                                onClick={() => setShowAddModal(false)}
                                disabled={loading}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
