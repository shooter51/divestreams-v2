import Fastify from "fastify";
import type { Config } from "./config.js";
import type { StateMachineEngine } from "./state-machine/engine.js";
import type { GitHubClient } from "./integrations/github.js";
import type { GateEvaluator } from "./gates/evaluator.js";
import type { FixAgent } from "./agents/fix-agent.js";
import type { JudgeAgent } from "./agents/judge-agent.js";
import type { VKClient } from "./integrations/vk.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { logger } from "./utils/logger.js";

export interface ServerDeps {
  config: Config;
  engine: StateMachineEngine;
  github: GitHubClient;
  evaluator: GateEvaluator;
  fixAgent: FixAgent;
  judgeAgent: JudgeAgent;
  vk: VKClient;
}

export async function createServer(deps: ServerDeps) {
  const app = Fastify({
    logger: false, // We use our own pino instance
    bodyLimit: 10 * 1024 * 1024, // 10MB for webhook payloads
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.debug(
      { method: request.method, url: request.url },
      "Incoming request"
    );
  });

  // Register routes
  registerWebhookRoutes(app, deps);
  registerApiRoutes(app, deps);
  registerDashboardRoutes(app);

  return app;
}
