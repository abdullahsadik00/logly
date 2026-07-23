/**
 * Derive the acquisition `source` for a visit, SERVER-SIDE, from data Logly
 * already observed on the collect Event — never from client-supplied fields.
 *
 * Rule (single source of truth, used by the revenue read model):
 *   1. utm_source from the landing page URL, else
 *   2. the referrer's hostname, else
 *   3. 'direct'.
 *
 * `page` is the full landing URL stored on the Event (e.g.
 * "https://acme.com/pricing?utm_source=twitter"). `referrer` is the raw
 * document.referrer the SDK sent, or null.
 */
export function deriveSource(page: string | null, referrer: string | null): string {
  if (page) {
    try {
      const utm = new URL(page).searchParams.get('utm_source');
      if (utm && utm.trim()) return utm.trim().toLowerCase();
    } catch {
      // Malformed URL — fall through to referrer.
    }
  }
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      if (host) return host.toLowerCase();
    } catch {
      // Not a parseable URL — ignore.
    }
  }
  return 'direct';
}
