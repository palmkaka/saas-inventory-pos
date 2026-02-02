
import { createAdminClient } from '../utils/supabase/admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function restoreAdmin() {
    const email = 'phuwaratnan7607@gmail.com'; // Target email from screenshot
    const supabase = createAdminClient();

    console.log(`Searching for user: ${email}...`);

    // 1. Get User ID
    const { data: { users }, error: searchError } = await supabase.auth.admin.listUsers();

    if (searchError) {
        console.error('Search Error:', searchError);
        return;
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log(`Found user ID: ${user.id}`);

    // 2. Update Profile Role to 'owner'
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'owner' })
        .eq('id', user.id);

    if (updateError) {
        console.error('Update Profile Error:', updateError);
    } else {
        console.log('Successfully restored role to OWNER');
    }
}

restoreAdmin();
