import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function testUpload() {
  const content = 'Test content from EYE Platform ' + new Date().toISOString();
  const fileName = `test-${Date.now()}.txt`;
  
  const { data, error } = await supabase.storage
    .from('eye-bucket')
    .upload(`tests/${fileName}`, Buffer.from(content), {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) {
    console.error('❌ Storage upload failed:', error);
  } else {
    console.log('✅ Storage upload success:', data);
    const { data: urlData } = supabase.storage.from('eye-bucket').getPublicUrl(`tests/${fileName}`);
    console.log('Public URL:', urlData.publicUrl);
  }
}

testUpload();
