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

async function createMainBranches() {
    console.log('Checking organizations without branches...');

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name');

    if (orgsError) {
        console.error('Error fetching organizations:', orgsError);
        return;
    }

    console.log(`Found ${orgs.length} organizations`);

    for (const org of orgs) {
        // Check if org has any branches
        const { data: branches, error: branchError } = await supabase
            .from('branches')
            .select('id')
            .eq('organization_id', org.id);

        if (branchError) {
            console.error(`Error checking branches for ${org.name}:`, branchError);
            continue;
        }

        if (branches.length === 0) {
            console.log(`Creating main branch for: ${org.name}`);

            const { error: insertError } = await supabase
                .from('branches')
                .insert({
                    organization_id: org.id,
                    name: 'สาขาหลัก',
                    address: '',
                    is_main: true
                });

            if (insertError) {
                console.error(`Error creating branch for ${org.name}:`, insertError);
            } else {
                console.log(`✅ Created main branch for ${org.name}`);
            }
        } else {
            console.log(`✓ ${org.name} already has ${branches.length} branch(es)`);
        }
    }

    console.log('Done!');
}

createMainBranches();
