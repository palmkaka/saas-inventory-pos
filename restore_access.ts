
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach((line: string) => {
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

async function restore() {
    const email = 'phuwaratnan7607@gmail.com';
    console.log(`Searching for user: ${email}...`);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('List users error:', error);
        return;
    }

    const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log(`Found user ID: ${user.id}`);

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'owner' })
        .eq('id', user.id);

    if (updateError) {
        console.error('Update Profile Error:', updateError);
    } else {
        console.log('✅ Successfully restored role to OWNER');
    }
}

restore();
