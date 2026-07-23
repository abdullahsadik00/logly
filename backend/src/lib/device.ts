/**
 * Coarse device classification from a User-Agent string.
 * Intentionally simple — analytics only needs mobile / tablet / desktop, and
 * the UA is used transiently (it is never stored; see lib/salt.ts).
 */
export function getDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/Mobile/i.test(ua)) return 'mobile';
  if (/Tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}
