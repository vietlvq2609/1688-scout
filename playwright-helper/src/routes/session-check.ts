// POST /api/session-check — validate a handed-off 1688 cookie jar.
// Body: { cookies: ChromeCookie[] } → { signedIn: boolean }.
// The checker is injectable so route tests stay browser-free.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ChromeCookie } from '../../../src/core/types.js';
import { httpErrorPayload } from '../constants.js';
import { checkSignedIn } from '../session.js';
import type { SignedInChecker } from '../session.js';

export function createSessionCheckRouter(
  check: SignedInChecker = checkSignedIn,
): Router {
  const router = Router();

  const handler: RequestHandler = async (req, res, next) => {
    const cookies = (req.body as { cookies?: unknown } | undefined)?.cookies;
    if (!Array.isArray(cookies)) {
      res
        .status(400)
        .json(httpErrorPayload('INVALID_REQUEST', 'Thiếu danh sách cookie của 1688'));
      return;
    }
    try {
      const signedIn = await check(cookies as ChromeCookie[]);
      res.json({ signedIn });
    } catch (err) {
      next(err);
    }
  };

  router.post('/api/session-check', handler);
  return router;
}
