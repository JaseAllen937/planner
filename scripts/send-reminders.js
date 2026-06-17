// Sends the daily bundled reminder.
// Runs hourly via .github/workflows/reminders.yml.
//
// For each row in push_subscriptions: compute the current hour in that user's
// timezone. Unless FORCE_SEND=true, only proceed if that hour matches the
// row's reminder_hour. Then fetch their app_state.data.items, bucket by 0/1/3/7
// days out (skipping completed to-dos and someday items), build ONE bundled
// notification, and dispatch via web-push. On a 404/410 (subscription expired)
// delete the row.

const webpush = require('web-push');

const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FORCE_SEND
} = process.env;

const forceSend = String(FORCE_SEND).toLowerCase() === 'true';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars.');
  process.exit(1);
}

webpush.setVapidDetails(
  'mailto:agendaai@kjsvault.org',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supaHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

function ymdInTz(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const o = {};
  for (const p of parts) if (p.type !== 'literal') o[p.type] = p.value;
  return `${o.year}-${o.month}-${o.day}`;
}

function hourInTz(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', hour12: false
  }).formatToParts(date);
  const h = parts.find(p => p.type === 'hour');
  // Intl can return "24" for midnight in some locales — normalize.
  const n = Number(h.value);
  return n === 24 ? 0 : n;
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function fmt12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

async function supaGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: supaHeaders });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

async function supaDelete(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { method: 'DELETE', headers: supaHeaders });
  if (!r.ok) console.warn(`DELETE ${path} -> ${r.status}`);
}

function buildDigest(items, completionIdSet, todayYmd) {
  const targets = {
    [todayYmd]:               'today',
    [addDaysYmd(todayYmd, 1)]: 'day1',
    [addDaysYmd(todayYmd, 3)]: 'day3',
    [addDaysYmd(todayYmd, 7)]: 'day7'
  };
  const buckets = { today: [], day1: [], day3: [], day7: [] };
  for (const it of items) {
    if (!it || !it.date) continue;                                // skip someday
    if (it.trackCompletion && completionIdSet.has(it.id)) continue; // skip completed to-dos
    const bucket = targets[it.date];
    if (bucket) buckets[bucket].push(it);
  }
  const total = buckets.today.length + buckets.day1.length + buckets.day3.length + buckets.day7.length;
  if (total === 0) return null;

  const fmtItem = (it) => (it.time ? `${fmt12(it.time)} ` : '') + (it.title || '(untitled)');
  const lines = [];
  if (buckets.today.length) lines.push(`Today: ${buckets.today.map(fmtItem).join(', ')}`);
  if (buckets.day1.length)  lines.push(`Tomorrow: ${buckets.day1.map(fmtItem).join(', ')}`);
  if (buckets.day3.length)  lines.push(`In 3 days: ${buckets.day3.map(fmtItem).join(', ')}`);
  if (buckets.day7.length)  lines.push(`In 7 days: ${buckets.day7.map(fmtItem).join(', ')}`);
  return { title: 'Coming up', body: lines.join('\n'), total };
}

async function main() {
  const now = new Date();
  console.log(`Run at ${now.toISOString()} (forceSend=${forceSend})`);

  const subs = await supaGet('/push_subscriptions?select=*');
  console.log(`Found ${subs.length} subscription(s).`);

  let sent = 0, skippedHour = 0, skippedEmpty = 0, expired = 0, errored = 0;

  for (const row of subs) {
    const userId = row.user_id;
    const tz = row.timezone || 'UTC';
    const sub = row.subscription;
    if (!sub || typeof sub !== 'object') {
      console.log(`[${userId}] missing subscription, skipping`);
      continue;
    }

    if (!forceSend) {
      const userHour = hourInTz(now, tz);
      if (userHour !== row.reminder_hour) {
        skippedHour++;
        continue;
      }
    }

    let stateRows;
    try {
      stateRows = await supaGet(`/app_state?user_id=eq.${userId}&select=data`);
    } catch (e) {
      console.error(`[${userId}] state fetch failed: ${e.message}`);
      errored++;
      continue;
    }
    if (!stateRows.length) {
      console.log(`[${userId}] no app_state row, skipping`);
      continue;
    }
    const data = stateRows[0].data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const completionIds = new Set((data.completions || []).map(c => c.ref_id));

    const todayYmd = ymdInTz(now, tz);
    const digest = buildDigest(items, completionIds, todayYmd);
    if (!digest) {
      skippedEmpty++;
      console.log(`[${userId}] nothing due, skipping`);
      continue;
    }

    try {
      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title: digest.title,
          body:  digest.body,
          url:   './index.html?view=upcoming'
        })
      );
      sent++;
      console.log(`[${userId}] sent (${digest.total} item${digest.total === 1 ? '' : 's'})`);
    } catch (err) {
      const status = err.statusCode || err.status;
      if (status === 404 || status === 410) {
        await supaDelete(`/push_subscriptions?user_id=eq.${userId}`);
        expired++;
        console.log(`[${userId}] subscription expired (${status}), row deleted`);
      } else {
        errored++;
        console.error(`[${userId}] push failed: ${status || err.message}`);
      }
    }
  }

  console.log(`Done. sent=${sent} skipped(hour)=${skippedHour} skipped(empty)=${skippedEmpty} expired=${expired} errored=${errored}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
