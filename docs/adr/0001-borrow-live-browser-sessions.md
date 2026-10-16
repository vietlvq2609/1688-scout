# Borrow the seller's live browser sessions instead of signing in from the helper

1688 only offers image search to a signed-in visitor, and its session expires in roughly
half an hour, so a helper that owns its own login would make the seller re-scan a QR code
throughout the day. Instead the extension reads the cookies from the seller's own Chrome
and hands them to the helper at scan time, exactly as it does for Shopee; the helper never
signs in, never stores a session, and the session it uses is as fresh as the seller's own
browsing.

## Considered Options

**Helper owns the login (`POST /api/login`, headful QR, persisted `storageState`).** The
session would be born in the same browser that runs the scans, which is the safest from an
anti-bot point of view. Rejected because of expiry: the seller would re-authenticate
routinely, and every re-login is a chance for the scan to fail mid-way.

**Reverse-engineer 1688's MTop `sign` and call the API directly.** Rejected: the signature
depends on a short-lived `_m_h5_tk` token, the algorithm is obfuscated and changes, and a
failure would be silent.

## Consequences

- The helper has no login surface: `/api/login`, `1688-auth.json` and its auth module are
  gone, and the client setup loses a step.
- The extension needs `*://*.1688.com/*` host permission so it can read that cookie jar.
- A dead session is now detected *before* a scan starts (`POST /api/session-check`) rather
  than mid-scan, and recovery is "sign in at login.1688.com in your browser", which needs
  no helper involvement.
- Risk accepted: the session was created in the seller's real Chrome and is replayed in the
  helper's browser, so if 1688 binds sessions to a fingerprint the session may be rejected.
  This is what the session check exists to reveal, and the fallback is a Playwright profile
  the seller signs into once, not a QR flow per scan.
