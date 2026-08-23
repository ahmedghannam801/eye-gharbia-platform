import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function check() {
  console.log('Testing Supabase Cloud Read & Write Permissions with anon key...');
  
  // 1. Test profiles read & write
  const { data: testProfile, error: pErr } = await supabase.from('profiles').select('id, full_name, role').limit(1);
  console.log('Profiles read:', pErr ? `❌ Error: ${pErr.message}` : `✅ OK (found ${testProfile.length} rows)`);

  // 2. Test tasks read & write
  const { data: testTasks, error: tErr } = await supabase.from('tasks').select('id, name, status').limit(1);
  console.log('Tasks read:', tErr ? `❌ Error: ${tErr.message}` : `✅ OK (found ${testTasks.length} rows)`);

  // 3. Test meetings read
  const { data: testMeetings, error: mErr } = await supabase.from('meetings').select('id, title').limit(1);
  console.log('Meetings read:', mErr ? `❌ Error: ${mErr.message}` : `✅ OK (found ${testMeetings.length} rows)`);

  // 4. Test announcements read
  const { data: testAnnouncements, error: aErr } = await supabase.from('announcements').select('id, title').limit(1);
  console.log('Announcements read:', aErr ? `❌ Error: ${aErr.message}` : `✅ OK (found ${testAnnouncements.length} rows)`);

  // 5. Test notifications read
  const { data: testNotifs, error: nErr } = await supabase.from('notifications').select('id, title').limit(1);
  console.log('Notifications read:', nErr ? `❌ Error: ${nErr.message}` : `✅ OK (found ${testNotifs.length} rows)`);

  // 6. Test storage bucket
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('Storage buckets:', bErr ? `❌ Error: ${bErr.message}` : `✅ OK (${buckets?.map(b => b.name).join(', ')})`);
}

check();
