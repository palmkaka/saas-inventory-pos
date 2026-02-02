// LINE Notify Utility
// ใช้สำหรับส่งแจ้งเตือนผ่าน LINE Notify API

interface NotifyResult {
    success: boolean;
    message?: string;
    error?: string;
}

// ส่งข้อความแจ้งเตือนผ่าน LINE Notify
export async function sendLineNotify(
    token: string,
    message: string
): Promise<NotifyResult> {
    if (!token) {
        return { success: false, error: 'LINE Notify token is not configured' };
    }

    try {
        const response = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ message }),
        });

        if (response.ok) {
            return { success: true, message: 'Notification sent successfully' };
        } else {
            const data = await response.json();
            return { success: false, error: data.message || 'Failed to send notification' };
        }
    } catch (error) {
        console.error('LINE Notify error:', error);
        return { success: false, error: 'Failed to connect to LINE Notify' };
    }
}

// ส่งแจ้งเตือนพร้อมรูปภาพ
export async function sendLineNotifyWithImage(
    token: string,
    message: string,
    imageUrl: string
): Promise<NotifyResult> {
    if (!token) {
        return { success: false, error: 'LINE Notify token is not configured' };
    }

    try {
        const response = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                message,
                imageThumbnail: imageUrl,
                imageFullsize: imageUrl,
            }),
        });

        if (response.ok) {
            return { success: true, message: 'Notification sent successfully' };
        } else {
            const data = await response.json();
            return { success: false, error: data.message || 'Failed to send notification' };
        }
    } catch (error) {
        console.error('LINE Notify error:', error);
        return { success: false, error: 'Failed to connect to LINE Notify' };
    }
}

// ==========================================
// Pre-built notification templates
// ==========================================

// แจ้งเตือนสรุปยอดขายประจำวัน
export function formatDailySalesNotification(
    date: string,
    totalSales: number,
    orderCount: number,
    topProducts: { name: string; quantity: number }[]
): string {
    const formattedSales = new Intl.NumberFormat('th-TH').format(totalSales);
    let message = `\n📊 สรุปยอดขาย ${date}\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 ยอดขายรวม: ฿${formattedSales}\n`;
    message += `📦 จำนวนออเดอร์: ${orderCount} รายการ\n`;

    if (topProducts.length > 0) {
        message += `\n🏆 สินค้าขายดี:\n`;
        topProducts.slice(0, 3).forEach((p, i) => {
            message += `  ${i + 1}. ${p.name} (${p.quantity} ชิ้น)\n`;
        });
    }

    return message;
}

// แจ้งเตือนสต็อกใกล้หมด
export function formatLowStockNotification(
    products: { name: string; quantity: number; minQuantity: number }[]
): string {
    let message = `\n⚠️ แจ้งเตือนสต็อกใกล้หมด\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `พบ ${products.length} รายการที่ต้องสั่งเพิ่ม:\n\n`;

    products.slice(0, 10).forEach(p => {
        const status = p.quantity === 0 ? '🔴' : '🟡';
        message += `${status} ${p.name}\n`;
        message += `   เหลือ ${p.quantity} ชิ้น (ขั้นต่ำ ${p.minQuantity})\n`;
    });

    if (products.length > 10) {
        message += `\n...และอีก ${products.length - 10} รายการ`;
    }

    return message;
}

// แจ้งเตือนออเดอร์ใหม่ (สำหรับออเดอร์ใหญ่)
export function formatLargeOrderNotification(
    orderNumber: string,
    amount: number,
    itemCount: number,
    customerName?: string
): string {
    const formattedAmount = new Intl.NumberFormat('th-TH').format(amount);
    let message = `\n🎉 ออเดอร์ใหญ่!\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 เลขที่: ${orderNumber}\n`;
    message += `💵 ยอดรวม: ฿${formattedAmount}\n`;
    message += `📦 จำนวนสินค้า: ${itemCount} ชิ้น\n`;
    if (customerName) {
        message += `👤 ลูกค้า: ${customerName}\n`;
    }
    return message;
}

// แจ้งเตือนพนักงานลงเวลา
export function formatClockInNotification(
    employeeName: string,
    time: string,
    branch: string
): string {
    return `\n🕐 ${employeeName} ลงเวลาเข้างาน\n⏰ เวลา: ${time}\n📍 สาขา: ${branch}`;
}

// แจ้งเตือนพนักงานลงเวลาออก
export function formatClockOutNotification(
    employeeName: string,
    time: string,
    hoursWorked: number
): string {
    return `\n🕐 ${employeeName} ลงเวลาออกงาน\n⏰ เวลา: ${time}\n⏱️ ทำงาน: ${hoursWorked.toFixed(1)} ชั่วโมง`;
}
