-- Fix POS RLS: Add policies for order_items
-- Description: เพิ่ม Policy ให้ order_items และแก้ไขให้สามารถ insert ได้

-- 1. Policies for order_items
DROP POLICY IF EXISTS "Users can view org order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items" ON order_items;

CREATE POLICY "Users can view org order items"
ON order_items FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create order items"
ON order_items FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- 2. Ensure order_items has organization_id automatically if possible via trigger? 
-- No, better to send it from client or handle in trigger. 
-- But for now, we rely on client sending it.

-- 3. Check if orders policy needs update (Just in case)
-- Existing orders policy from 003 seems fine, but let's reinforce insert permission just in case Strict RLS messed it up.
DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Users can create orders"
ON orders FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
