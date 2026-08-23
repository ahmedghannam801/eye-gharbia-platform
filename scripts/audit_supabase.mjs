import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://uvckrjskcxpxphywrqdn.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Y2tyanNrY3hweHBoeXdycWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTI1MjcsImV4cCI6MjA5OTI4ODUyN30.X9T6_KbIr7IGlQC_ugJIF8E6xtLoFD7iYRxT3_a9f3w";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'profiles',
  'tasks',
  'submissions',
  'announcements',
  'notifications',
  'activity_logs',
  'meetings',
  'attendance',
  'excuses_freezes',
  'issued_certificates',
  'work_plans',
  'volunteer_ideas',
  'member_evaluations',
  'leader_feedbacks',
  'disciplinary_records',
  'live_workshops',
  'academy_courses',
  'reward_items',
  'reward_purchases',
  'weekly_quizzes',
  'weekly_challenges',
  'memory_wall',
  'occasions',
  'issued_posters',
  'push_subscriptions',
  'org_settings',
  'monthly_performance'
];

async function runAudit() {
  console.log('====================================================');
  console.log('🔍 SUPABASE PLATFORM AUDIT - TABLE & CLOUD CHECK');
  console.log('====================================================\n');

  const results = [];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        results.push({
          table,
          status: '❌ Error / Blocked',
          count: 0,
          details: error.message
        });
      } else {
        const rowCount = count !== null ? count : (data ? data.length : 0);
        const columns = data && data.length > 0 ? Object.keys(data[0]).slice(0, 5).join(', ') + '...' : '(Empty table)';

        results.push({
          table,
          status: '✅ Active & Reachable',
          count: rowCount,
          details: columns
        });
      }
    } catch (err) {
      results.push({
        table,
        status: '❌ Exception',
        count: 0,
        details: err.message
      });
    }
  }

  console.table(results);
}

runAudit();
