-- Cleanup Zombie Users (Version 3 - Force Delete Everything)
-- Description: ลบข้อมูลทุกอย่างที่เกี่ยวข้องกับ User ID (Orders, Shifts, Profiles)
-- Date: 2026-01-31

DO $$
DECLARE
    target_user_ids UUID[] := ARRAY[
        '1a573481-d0d6-40d1-9b72-bbb540492036'::UUID,
        'ef8da7f8-2dba-4dc1-b1bd-55a124160980'::UUID
    ];
    user_id UUID;
BEGIN
    FOREACH user_id IN ARRAY target_user_ids
    LOOP
        -- 1. ลบรายการสินค้าใน Order ที่ User นี้เป็นคนขาย (ถ้ามี)
        DELETE FROM order_items 
        WHERE order_id IN (SELECT id FROM orders WHERE seller_id = user_id);

        -- 2. ลบ Orders ที่ User นี้เป็นคนขาย
        DELETE FROM orders WHERE seller_id = user_id;

        -- 3. ลบ Shifts (กะการทำงาน) ของ User นี้
        DELETE FROM shifts WHERE user_id = user_id;

        -- 4. ลบ Profiles (ตัวต้นตอ)
        DELETE FROM profiles WHERE id = user_id;
        
        RAISE NOTICE 'Cleaned up data for user: %', user_id;
    END LOOP;
END $$;

-- หลังจากรันคำสั่งนี้แล้ว ให้กลับไปที่ Supabase Dashboard > Authentication > Users แล้วกด Delete อีกครั้ง
