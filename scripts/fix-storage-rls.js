const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envConfig[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixStorageRLS() {
    console.log('Applying Storage RLS Policies...');

    // Run SQL to fix storage policies
    const sql = `
    -- Drop existing policies if they exist (to avoid conflicts)
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their org images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their org images" ON storage.objects;
    
    -- Allow public read access to product images
    CREATE POLICY "Public Access"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'products' );
    
    -- Allow ALL authenticated users to upload (simplified policy)
    CREATE POLICY "Authenticated users can upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'products' );
    
    -- Allow users to update images in products bucket
    CREATE POLICY "Users can update their org images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING ( bucket_id = 'products' );
    
    -- Allow users to delete images in products bucket
    CREATE POLICY "Users can delete their org images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'products' );
  `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error applying policies via RPC:', error.message);
        console.log('');
        console.log('กรุณา Copy SQL ด้านล่างนี้ไปรันใน Supabase SQL Editor:');
        console.log('='.repeat(60));
        console.log(sql);
        console.log('='.repeat(60));
    } else {
        console.log('Storage RLS Policies applied successfully!');
    }
}

fixStorageRLS();
