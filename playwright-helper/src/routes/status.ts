// GET /api/status — the helper's liveness probe. The session is the client's
// to hold, so 1688 sign-in state is reported by POST /api/session-check.
import { Router } from 'express';
import { PORT, VERSION } from '../constants.js';

export function createStatusRouter(): Router {
  const router = Router();

  router.get('/api/status', (_req, res) => {
    res.json({
      running: true,
      port: PORT,
      version: VERSION,
    });
  });

  return router;
}
