import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function inspectAndReset() {
  const { data: sampleProfile } = await supabase.from('profiles').select('*').limit(1);
  console.log('Sample profile columns:', sampleProfile ? Object.keys(sampleProfile[0] || {}) : 'None');

  const updatePayload = {};
  if (sampleProfile && sampleProfile[0]) {
    const keys = Object.keys(sampleProfile[0]);
    if (keys.includes('bonus_points')) updatePayload.bonus_points = 0;
    if (keys.includes('points')) updatePayload.points = 0;
    if (keys.includes('score')) updatePayload.score = 0;
    if (keys.includes('rating')) updatePayload.rating = 0;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { data, error } = await supabase.from('profiles').update(updatePayload).neq('id', '00000000-0000-0000-0000-000000000000').select('id, full_name');
    console.log('Updated profiles with:', updatePayload, 'Count:', data?.length, 'Error:', error);
  } else {
    console.log('No numeric points column found on profiles table directly.');
  }

  // Also check submissions, attendance, etc.
  const { count: subsCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true });
  const { count: attCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
  const { count: evalCount } = await supabase.from('member_evaluations').select('*', { count: 'exact', head: true });
  console.log(`Current DB records that generate points: Submissions: ${subsCount}, Attendance: ${attCount}, Member Evaluations: ${evalCount}`);
}

inspectAndReset().catch(console.error);
