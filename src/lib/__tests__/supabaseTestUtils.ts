// Shared helpers for mocking the Supabase client's fluent query builder in
// src/lib unit tests. Each lib module calls `jest.mock('../supabaseClient', …)`
// itself (jest.mock calls must live in the test file so they're hoisted
// correctly), then uses these helpers to configure what each chained call
// resolves to.

export interface QueryResult {
  data?: any;
  error?: any;
  count?: number | null;
}

// A fake PostgrestFilterBuilder: every chain method (`.select()`, `.eq()`,
// `.order()`, …) returns the same object so calls can be chained in any
// combination, and the object itself is "thenable" so `await` resolves to
// the configured result — matching how supabase-js's real builder works.
export function queryBuilder(result: QueryResult = { data: null }) {
  const builder: any = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike',
    'or', 'in', 'overlaps', 'order', 'limit',
    'single', 'maybeSingle',
  ];
  for (const method of methods) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected: any) => Promise.resolve(result).catch(onRejected);
  return builder;
}

// A fake realtime channel: `.on()` is chainable and records each
// registration so tests can invoke the captured callback directly;
// `.subscribe()` returns the channel, matching the real API.
export function channelBuilder() {
  const registrations: { event: string; filter: any; callback: (payload: any) => void }[] = [];
  const channel: any = {
    on: jest.fn((event: string, filter: any, callback: (payload: any) => void) => {
      registrations.push({ event, filter, callback });
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  channel.__registrations = registrations;
  return channel;
}
