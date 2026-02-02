import { NextRequest, NextResponse } from 'next/server';
import { sendLineNotify } from '@/utils/line-notify';

// POST /api/line-notify/test - ทดสอบส่ง LINE Notify
export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Token is required' },
                { status: 400 }
            );
        }

        const testMessage = `
🔔 ทดสอบการแจ้งเตือน
━━━━━━━━━━━━━━━━━━
✅ LINE Notify ทำงานปกติ!
🕐 เวลา: ${new Date().toLocaleString('th-TH')}

ระบบ: SaaS Inventory POS`;

        const result = await sendLineNotify(token, testMessage);

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Test notify error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
