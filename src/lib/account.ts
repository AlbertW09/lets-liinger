import { supabase } from '../supabaseClient';

// Permanently deletes the signed-in user's account by invoking the
// `delete-account` edge function (which runs with the service role and cascades
// all their data). On success we also sign out locally so the root layout
// routes back to /auth.
export async function deleteAccount(): Promise<{ error?: string }> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    return { error: error.message ?? 'Could not delete your account.' };
  }
  if (data && (data as any).error) {
    return { error: (data as any).error };
  }

  // The account is gone; clear the local session too.
  await supabase.auth.signOut();
  return {};
}
