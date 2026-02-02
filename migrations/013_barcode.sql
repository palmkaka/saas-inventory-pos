-- Migration: Barcode Support
-- Description: เพิ่ม barcode field ในตาราง products
-- Created: 2026-01-31

-- เพิ่ม column barcode ในตาราง products
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

-- สร้าง index สำหรับ barcode
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Comment
COMMENT ON COLUMN products.barcode IS 'รหัส Barcode/QR Code ของสินค้า';
