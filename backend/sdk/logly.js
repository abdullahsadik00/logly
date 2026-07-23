/*!
 * Logly tracking SDK
 * ------------------
 * A tiny, dependency-free, cookieless analytics beacon.
 *
 * Embed:
 *   <script async src="https://<your-logly-host>/sdk/logly.min.js"
 *           data-tracking-id="YOUR_TRACKING_ID"></script>
 *
 * Custom events (after the script has loaded):
 *   window.logly.track('Signup', { plan: 'pro' });
 *
 * Privacy note: this SDK sets NO cookies and stores NO durable identifier.
 * A per-tab session id is kept in sessionStorage only — it is ephemeral
 * (cleared when the tab closes), never shared across sites, and never a
 * persistent user id. The visitor identity is derived server-side from a
 * daily-rotating salted hash and is unrelatable across days by design.
 */
(function () {
  'use strict';

  // Resolve our own <script> tag. `document.currentScript` is the reliable
  // path for synchronous execution; for `async`/deferred loads it can be null,
  // so we fall back to querying for the tag that carries the tracking id.
  var self =
    document.currentScript ||
    document.querySelector('script[data-tracking-id]');

  if (!self) {
    console.warn('[logly] could not locate the SDK <script> tag; not tracking.');
    return;
  }

  var trackingId = self.getAttribute('data-tracking-id');
  if (!trackingId) {
    console.warn('[logly] missing data-tracking-id attribute; not tracking.');
    return;
  }

  // The collector lives on the same origin the SDK was served from, so a
  // single `src` host configures everything. Fall back to the current page
  // origin if the script src can't be parsed (e.g. inlined during tests).
  var origin;
  try {
    origin = new URL(self.src).origin;
  } catch (_e) {
    origin = window.location.origin;
  }
  var endpoint = origin + '/api/collect/' + encodeURIComponent(trackingId);

  // --- Ephemeral per-tab session id (sessionStorage, not a cookie) ---------
  var SESSION_KEY = 'logly_sid';
  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    // RFC4122-ish fallback for older browsers.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function sessionId() {
    try {
      var id = window.sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = uuid();
        window.sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (_e) {
      // sessionStorage blocked (private mode / sandboxed): fall back to a
      // fresh per-call id. Sessions just won't coalesce — acceptable.
      return uuid();
    }
  }

  // --- Transport -----------------------------------------------------------
  // We POST JSON and rely on the collector's OPTIONS handler for the CORS
  // preflight. `keepalive` lets the request outlive a page unload (the reason
  // navigator.sendBeacon exists) without sendBeacon's text/plain-only limit,
  // which would break our application/json body.
  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      }).catch(function () {
        /* swallow — analytics must never break the host page */
      });
    } catch (_e) {
      /* no-op */
    }
  }

  function base(type) {
    var p = {
      type: type,
      page: window.location.href,
      sessionId: sessionId(),
    };
    if (document.referrer) p.referrer = document.referrer;
    return p;
  }

  function trackPageview() {
    send(base('pageview'));
  }

  function track(name, props) {
    if (!name) return;
    var p = base('custom');
    p.eventName = String(name).slice(0, 100);
    if (props && typeof props === 'object') p.eventProps = props;
    send(p);
  }

  // --- SPA navigation: fire a pageview on client-side route changes --------
  var lastHref = window.location.href;
  function onRouteChange() {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    trackPageview();
  }
  (function patchHistory() {
    var push = window.history.pushState;
    var replace = window.history.replaceState;
    if (typeof push === 'function') {
      window.history.pushState = function () {
        var r = push.apply(this, arguments);
        onRouteChange();
        return r;
      };
    }
    if (typeof replace === 'function') {
      window.history.replaceState = function () {
        var r = replace.apply(this, arguments);
        onRouteChange();
        return r;
      };
    }
    window.addEventListener('popstate', onRouteChange);
  })();

  // --- Public API + replay of any queued pre-load calls --------------------
  // Supports an optional stub snippet: window.logly = { q: [] };
  // window.logly.q.push(['EventName', {..}]) before the SDK loads.
  var queued = window.logly && Array.isArray(window.logly.q) ? window.logly.q : null;
  window.logly = { track: track, trackPageview: trackPageview };
  if (queued) {
    queued.forEach(function (args) {
      try {
        track.apply(null, args);
      } catch (_e) {
        /* ignore malformed queued call */
      }
    });
  }

  // Initial pageview.
  trackPageview();
})();
