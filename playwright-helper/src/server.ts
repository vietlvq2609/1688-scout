// Helper HTTP server (Express). createApp() builds the configured app without
// binding a port so tests can listen on an ephemeral port; startServer() is
// only invoked when this module is executed directly.
import express from 'express';
import cors from 'cors';
import type { ErrorRequestHandler, Express, RequestHandler } from 'express';
import type http from 'node:http';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { PORT, VERSION, PLAINTEXT_BODY_LIMIT, httpErrorPayload } from './constants.js';
import { corsOptions } from './cors.js';
import { createStatusRouter } from './routes/status.js';
import { createSessionCheckRouter } from './routes/session-check.js';
import type { SignedInChecker } from './session.js';

/** Test seam: lets tests replace the 1688 session checker with a fake. */
export interface CreateAppOptions {
  checkSignedIn?: SignedInChecker;
}

/** Build the configured Express app (CORS allow-list, 10MB JSON bodies, API routes). */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(express.json({ limit: PLAINTEXT_BODY_LIMIT }));
  app.use(createStatusRouter());
  app.use(createSessionCheckRouter(options.checkSignedIn));

  // JSON 404 — never the default HTML page.
  const notFound: RequestHandler = (_req, res) => {
    res.status(404).json(httpErrorPayload('NOT_FOUND', 'Không tìm thấy tài nguyên'));
  };
  app.use(notFound);

  // JSON error handler that never leaks stack traces or internal messages.
  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    // Only expose the message for client errors; server errors stay generic.
    const message =
      status < 500 && err instanceof Error && err.message
        ? err.message
        : 'Lỗi nội bộ của helper';
    res.status(status).json(httpErrorPayload('HELPER_ERROR', message));
  };
  app.use(errorHandler);

  return app;
}

/** Start listening on the configured port and log the address. */
export function startServer(): http.Server {
  const app = createApp();
  return app.listen(PORT, () => {
    console.log(`[1688-scout-helper] v${VERSION} đang chạy tại http://localhost:${PORT}`);
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  startServer();
}
