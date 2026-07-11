import crypto from 'crypto';

/**
 * Daily-salted visitor identity — the product's core privacy invariant.
 *
 * The salt is a random 32 bytes that lives ONLY in memory and is rotated (the
 * old value discarded) the moment the UTC day changes. Because yesterday's salt
 * is unrecoverable, the same visitor hashed on two different days produces two
 * unrelatable hashes — visitors are un-linkable across days by design, so no
 * PII is ever stored. The raw IP/User-Agent are hashed and immediately dropped;
 * only the resulting hash is persisted.
 */

let currentSalt: Buffer = crypto.randomBytes(32);
let currentDay: string = utcDayKey(new Date());

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/** Return the current daily salt, rotating (and destroying the old one) on a UTC day change. */
function getDailySalt(): Buffer {
  const today = utcDayKey(new Date());
  if (today !== currentDay) {
    currentSalt = crypto.randomBytes(32); // previous salt is dropped → yesterday is unrecoverable
    currentDay = today;
  }
  return currentSalt;
}

/**
 * Derive a stable-for-the-day visitor id from the request fingerprint.
 * The same (project, ip, ua) yields the same id within a day and a different
 * id the next day. Inputs are never stored — only the returned hash is.
 */
export function computeVisitorId(projectId: string, ip: string, userAgent: string): string {
  return crypto
    .createHash('sha256')
    .update(getDailySalt())
    .update('|')
    .update(projectId)
    .update('|')
    .update(ip)
    .update('|')
    .update(userAgent)
    .digest('hex');
}
