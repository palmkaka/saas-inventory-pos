-- Migration: Fix Orders Seller ID Constraint
-- Description: แก้ปัญหาลบ User ไม่ได้เพราะติด transaction ในตาราง orders (seller_id)
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Fix 'orders' table (seller_id)
    -- Find and drop any constraint on seller_id column
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'orders' AND column_name = 'seller_id'
    ) LOOP
        EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;

    -- 2. Fix 'customers' (created_by) if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'created_by') THEN
         FOR r IN (
            SELECT constraint_name
            FROM information_schema.constraint_column_usage
            WHERE table_name = 'customers' AND column_name = 'created_by'
        ) LOOP
            EXECUTE 'ALTER TABLE customers DROP CONSTRAINT ' || r.constraint_name;
        END LOOP;
        
        ALTER TABLE customers
            ADD CONSTRAINT customers_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES profiles(id)
            ON DELETE SET NULL;
    END IF;

END $$;

-- Re-add constraint for orders with SET NULL
ALTER TABLE orders
    ADD CONSTRAINT orders_seller_id_fkey
    FOREIGN KEY (seller_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
