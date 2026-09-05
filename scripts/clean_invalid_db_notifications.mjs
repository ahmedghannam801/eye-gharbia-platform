import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://uvckrjskcxpxphywrqdn.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Y2tyanNrY3hweHBoeXdycWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTI1MjcsImV4cCI6MjA5OTI4ODUyN30.X9T6_KbIr7IGlQC_ugJIF8E6xtLoFD7iYRxT3_a9f3w";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectAndClean() {
  console.log('Connecting to Supabase at:', supabaseUrl);

  // 1. Fetch ALL notifications using pagination
  let allNotifications = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: batch, error: batchErr } = await supabase
      .from('notifications')
      .select('*')
      .range(from, to);

    if (batchErr) {
      console.error('Error fetching notifications batch:', batchErr);
      break;
    }
    if (!batch || batch.length === 0) {
      hasMore = false;
    } else {
      allNotifications.push(...batch);
      if (batch.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  const notifications = allNotifications;
  console.log(`Fetched TOTAL ${notifications.length} notifications from Supabase.`);

  // 2. Fetch all submissions
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('*');

  if (subErr) {
    console.error('Error fetching submissions:', subErr.message || subErr);
    return;
  }
  console.log(`Found ${submissions?.length || 0} submissions in database.`);
  if (submissions && submissions.length > 0) {
    console.log('Sample submission record keys:', Object.keys(submissions[0]));
    console.log('Sample submission record 0:', submissions[0]);
  }

  // 3. Find invalid missed notifications
  const invalidNotifs = [];
  (notifications || []).forEach(n => {
    const isMissed = n.title?.includes('فاتك') || (n.type === 'error' && (n.message?.includes('انتهى الموعد النهائي') || n.message?.includes('تسليم')));
    if (isMissed && n.related_id) {
      const match = (submissions || []).find(s =>
        String(s.task_id || s.taskId).trim() === String(n.related_id).trim() &&
        String(s.member_id || s.memberId).trim() === String(n.user_id || n.userId).trim()
      );
      if (match) {
        invalidNotifs.push({
          id: n.id,
          user_id: n.user_id,
          title: n.title,
          related_id: n.related_id,
          submission_id: match.id,
          created_at: n.created_at
        });
      }
    }
  });

  console.log(`\nFound ${invalidNotifs.length} invalid 'missed deadline' notifications for members who submitted.`);
  if (invalidNotifs.length > 0) {
    console.log(JSON.stringify(invalidNotifs, null, 2));

    const idsToDelete = invalidNotifs.map(x => x.id);
    const { error: delErr } = await supabase
      .from('notifications')
      .delete()
      .in('id', idsToDelete);

    if (delErr) {
      console.error('Failed to delete invalid notifications from Supabase:', delErr.message || delErr);
    } else {
      console.log(`✅ Successfully deleted ${idsToDelete.length} invalid notifications directly from Supabase!`);
    }
  } else {
    console.log('✨ No invalid notifications found in Supabase currently.');
  }

  // 4. Also check if there are tasks and submissions, and if any submitted member lacks a confirmation notification
  console.log('\nChecking submitted members notifications...');
  let addedCount = 0;
  for (const s of (submissions || [])) {
    const taskId = s.task_id || s.taskId;
    const memberId = s.member_id || s.memberId;
    if (!taskId || !memberId) continue;

    const hasSuccessNotif = (notifications || []).some(n => 
      String(n.user_id || n.userId).trim() === String(memberId).trim() &&
      String(n.related_id).trim() === String(taskId).trim() &&
      (n.title?.includes('تم تسليم') || n.title?.includes('تسليم التكليف'))
    );

    if (!hasSuccessNotif) {
      const newNotif = {
        id: 'notif_sub_' + Math.random().toString(36).substring(2, 11),
        user_id: memberId,
        title: 'تم تسليم التكليف بنجاح ✅',
        message: 'تم تأكيد استلام ملف الحل الخاص بك للتكليف. بالتوفيق!',
        type: 'success',
        read: false,
        related_id: taskId,
        created_at: s.created_at || s.submitted_at || new Date().toISOString()
      };

      const { error: insertErr } = await supabase.from('notifications').insert(newNotif);
      if (!insertErr) {
        addedCount++;
      }
    }
  }

  if (addedCount > 0) {
    console.log(`✅ Added ${addedCount} missing submission confirmation notification(s) in Supabase for past submissions!`);
  } else {
    console.log('All members who submitted already have their status in order.');
  }
}

inspectAndClean().then(() => {
  console.log('\nAudit and cleanup finished.');
  process.exit(0);
}).catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
