-- Migration: LINE Notify Settings
-- Description: เพิ่ม columns สำหรับ LINE Notify ในตาราง organizations
-- Created: 2026-01-31

-- เพิ่ม columns สำหรับ LINE Notify
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS line_notify_token TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_daily_sales BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_large_orders BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_clock_in_out BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS large_order_threshold DECIMAL(12, 2) DEFAULT 5000;

-- Comments
COMMENT ON COLUMN organizations.line_notify_token IS 'LINE Notify access token';
COMMENT ON COLUMN organizations.notify_daily_sales IS 'แจ้งเตือนสรุปยอดขายประจำวัน';
COMMENT ON COLUMN organizations.notify_low_stock IS 'แจ้งเตือนสต็อกใกล้หมด';
COMMENT ON COLUMN organizations.notify_large_orders IS 'แจ้งเตือนออเดอร์ใหญ่';
COMMENT ON COLUMN organizations.notify_clock_in_out IS 'แจ้งเตือนพนักงานลงเวลา';
COMMENT ON COLUMN organizations.large_order_threshold IS 'ยอดขั้นต่ำสำหรับแจ้งเตือนออเดอร์ใหญ่';
