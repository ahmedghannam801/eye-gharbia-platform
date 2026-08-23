import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, full_name, email, role, committee, department, status, membership_code');
  if (error) {
    console.error('Error fetching profiles:', error);
    process.exit(1);
  }

  console.log(`Total profiles in Supabase: ${profiles.length}`);
  
  // Breakdown by role & status
  const roleCount = {};
  const statusCount = {};
  profiles.forEach(p => {
    roleCount[p.role] = (roleCount[p.role] || 0) + 1;
    statusCount[p.status] = (statusCount[p.status] || 0) + 1;
  });

  console.log('Roles:', roleCount);
  console.log('Statuses:', statusCount);

  // Check for duplicate emails or null fields
  const emailMap = {};
  const duplicates = [];
  profiles.forEach(p => {
    if (!p.email) return;
    const lower = p.email.toLowerCase().trim();
    if (emailMap[lower]) {
      duplicates.push({ email: lower, id1: emailMap[lower], id2: p.id, name: p.full_name });
    } else {
      emailMap[lower] = p.id;
    }
  });

  console.log('Duplicates found:', duplicates);
}

main();
