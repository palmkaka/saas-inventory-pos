-- 1. Add image_url column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create products storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- We need to enable RLS on storage.objects if not already enabled (usually is by default in Supabase)

-- Policy: Allow public read access to product images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- Policy: Allow authenticated users to upload product images
-- Restrict to their own organization path to keep things tidy (optional but good practice)
-- folder structure: organization_id/product_image.jpg
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'products' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: Allow users to update/delete their own org's images
CREATE POLICY "Users can update their org images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'products' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their org images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'products' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles WHERE id = auth.uid()
  )
);
