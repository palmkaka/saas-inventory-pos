
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach((line) => {
        const [key, ...values] = line.split('=');
        if (key && values) {
            process.env[key.trim()] = values.join('=').trim().replace(/^['"]|['"]$/g, '');
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Error: Could not load Supabase credentials from .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function checkStaffRole() {
    const email = 'test@gmail.com';
    console.log(`Checking role for: ${email}...`);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('List users error:', error);
        return;
    }

    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log(`Found user ID: ${user.id}`);

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('Profile Fetch Error:', profileError);
    } else {
        console.log('✅ Profile Found:');
        console.log(`- ID: ${profile.id}`);
        console.log(`- Full Name: ${profile.full_name}`);
        console.log(`- Role: ${profile.role}`);
        console.log(`- Org ID: ${profile.organization_id}`);
    }
}

checkStaffRole();
