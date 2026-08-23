import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://uvckrjskcxpxphywrqdn.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Y2tyanNrY3hweHBoeXdycWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTI1MjcsImV4cCI6MjA5OTI4ODUyN30.X9T6_KbIr7IGlQC_ugJIF8E6xtLoFD7iYRxT3_a9f3w";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFreezeLifecycle() {
  console.log('Testing Freeze request upsert and approval flow in Supabase...');

  const { data: users, error: userErr } = await supabase.from('profiles').select('id, full_name, committee').limit(1);
  if (userErr || !users || users.length === 0) {
    console.error('Failed to get sample profile for test');
    return;
  }
  const sampleUser = users[0];

  const testId = 'frz-test-' + Date.now().toString(36);
  const testUserId = sampleUser.id;
  
  // 1. Create / Upsert
  const { data: insertData, error: insertError } = await supabase.from('excuses_freezes').upsert({
    id: testId,
    user_id: testUserId,
    user_name: 'QA Test User',
    governorate: 'الغربية',
    committee: 'HR',
    department: 'HR OF PR',
    request_type: 'Freeze',
    type: 'Freeze',
    reason: 'QA Verification test for persistence',
    start_date: '2026-09-01',
    end_date: '2026-09-15',
    status: 'Pending',
    created_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select();

  if (insertError) {
    console.error('❌ Insert failed:', insertError.message);
    process.exit(1);
  }
  console.log('✅ 1. Insert/Upsert test request successful:', insertData[0]?.id);

  // 2. Approve
  const { data: updateData, error: updateError } = await supabase.from('excuses_freezes').update({
    status: 'Approved',
    decision_notes: 'Approved during automated verification',
    admin_response: 'Approved during automated verification',
    reviewed_by: 'QA Admin',
    reviewed_at: new Date().toISOString(),
  }).eq('id', testId).select();

  if (updateError) {
    console.error('❌ Update failed:', updateError.message);
    process.exit(1);
  }
  console.log('✅ 2. Status updated to Approved in Supabase:', updateData[0]?.status);

  // 3. Read back and verify persistence
  const { data: verifyData, error: verifyError } = await supabase.from('excuses_freezes').select('*').eq('id', testId);
  if (verifyError || !verifyData || verifyData.length === 0) {
    console.error('❌ Read back failed');
    process.exit(1);
  }

  const record = verifyData[0];
  console.log('✅ 3. Verified record in database:', {
    id: record.id,
    status: record.status,
    admin_response: record.admin_response,
    reviewed_by: record.reviewed_by
  });

  if (record.status !== 'Approved') {
    console.error('❌ Record status is not Approved!');
    process.exit(1);
  }

  // 4. Clean up the QA test record
  await supabase.from('excuses_freezes').delete().eq('id', testId);
  console.log('✅ 4. Cleaned up QA test record:', testId);
  console.log('🎉 ALL FREEZE PERSISTENCE TESTS PASSED!');
}

testFreezeLifecycle().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
