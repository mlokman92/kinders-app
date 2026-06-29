import { supabase } from './supabase';

/** Private bucket for student profile photos (signed URLs only). */
const BUCKET = 'student-photos';

/**
 * Upload a student profile photo and return its STORAGE PATH (not a URL).
 * Mirrors the mobile app's `uploadStudentPhoto`: writes under `${uid}/…` so
 * the storage RLS (writes scoped to the uploader's folder) is satisfied.
 */
export async function uploadStudentPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Create a short-lived signed URL for a stored photo path, or null on failure. */
export async function getStudentPhotoUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

/**
 * Batch-create signed URLs for many stored photo paths in one request.
 * Returns a map of path → signed URL (paths that fail to sign are omitted).
 */
export async function getStudentPhotoUrls(
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresInSeconds);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

/** Private bucket for journal entry photos/videos (signed URLs only). */
const ENTRY_MEDIA_BUCKET = 'entry-media';

/**
 * Batch-create signed URLs for many entry-media paths in one request.
 * Returns a map of path → signed URL (paths that fail to sign are omitted).
 * Mirrors the mobile app's `getEntryMediaUrls`.
 */
export async function getEntryMediaUrls(
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(ENTRY_MEDIA_BUCKET).createSignedUrls(unique, expiresInSeconds);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

// Center logos are stored inline (data-URI) via update_center_settings — see
// lib/image.ts. No Storage bucket is involved for logos.
