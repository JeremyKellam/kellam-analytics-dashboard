const { createClient } = require('@supabase/supabase-js');

let supabase;
function getClient() {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

async function uploadFile(bucket, fileName, fileBuffer, contentType) {
  const { data, error } = await getClient().storage
    .from(bucket)
    .upload(fileName, fileBuffer, { contentType, upsert: true });
  if (error) throw error;
  return data.path;
}

async function getFileUrl(bucket, filePath) {
  const { data, error } = await getClient().storage
    .from(bucket)
    .createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function deleteFile(bucket, filePath) {
  const { error } = await getClient().storage
    .from(bucket)
    .remove([filePath]);
  if (error) throw error;
}

module.exports = { uploadFile, getFileUrl, deleteFile };
