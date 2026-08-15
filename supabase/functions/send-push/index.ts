import { createClient } from 'jsr:@supabase/supabase-js@2';

// Called by a Supabase Database Webhook on INSERT into `direct_messages` and
// `events`. Looks up who should be notified, then posts to Expo's push API.
// Payload shape is the standard Supabase webhook body:
// { type: 'INSERT', table, schema, record, old_record }

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: 'default';
};

Deno.serve(async (req) => {
  // Shared secret set as a custom header on the Database Webhook, so random
  // requests to this URL can't spam pushes. See setup notes for how it's set.
  const expected = Deno.env.get('SEND_PUSH_WEBHOOK_SECRET');
  if (expected && req.headers.get('x-webhook-secret') !== expected) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const table = payload.table as string;
  const record = payload.record as Record<string, any>;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const messages: PushMessage[] = [];

  if (table === 'direct_messages') {
    const { data: recipient } = await supabase
      .from('profiles')
      .select('push_token, push_enabled')
      .eq('id', record.recipient_id)
      .single();

    if (recipient?.push_enabled && recipient.push_token) {
      const { data: sender } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', record.sender_id)
        .single();

      messages.push({
        to: recipient.push_token,
        title: sender?.display_name || sender?.username || 'New message',
        body: String(record.content ?? '').slice(0, 120),
        data: { type: 'message', senderId: record.sender_id },
        sound: 'default',
      });
    }
  } else if (table === 'events') {
    const { data: recipients } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('push_enabled', true)
      .not('push_token', 'is', null)
      .neq('id', record.created_by);

    for (const r of recipients ?? []) {
      messages.push({
        to: r.push_token,
        title: 'New event',
        body: record.title ? `${record.title} was just posted` : 'A new event was just posted',
        data: { type: 'event', eventId: record.id },
        sound: 'default',
      });
    }
  }

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { 'content-type': 'application/json' },
  });
});
