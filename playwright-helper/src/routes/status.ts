// GET /api/status — the helper's liveness + 1688 login probe.
// loggedIn is "a usable auth file exists"; ticket 03 deepens this by
// actually verifying the session against 1688.
import { Router } from 'express';
import { PORT, VERSION } from '../constants.js';
import { loadAuthState } from '../auth.js';

export function createStatusRouter(): Router {
  const router = Router();

  router.get('/api/status', async (_req, res) => {
    const authState = await loadAuthState();
    res.json({
      running: true,
      loggedIn: authState !== null,
      port: PORT,
      version: VERSION,
    });
  });

  return router;
}
