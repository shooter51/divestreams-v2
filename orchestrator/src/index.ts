import { loadConfig } from "./config.js";
import { initDb } from "./db/client.js";
import { StateMachineEngine } from "./state-machine/engine.js";
import { GateEvaluator } from "./gates/evaluator.js";
import { GitHubClient } from "./integrations/github.js";
import { VKClient } from "./integrations/vk.js";
import { FixAgent } from "./agents/fix-agent.js";
import { JudgeAgent } from "./agents/judge-agent.js";
import { registerSideEffects } from "./side-effects.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";
import { clearAllMonitors } from "./agents/agent-monitor.js";

async function main() {
  const config = loadConfig();

  logger.info(
    { dryRun: config.dryRun, port: config.port },
    "Starting Pipeline Orchestrator"
  );

  // Initialize database
  initDb(config.databasePath);

  // Initialize components
  const engine = new StateMachineEngine();
  const evaluator = new GateEvaluator();
  const github = new GitHubClient(config);
  const vk = new VKClient(config);
  const fixAgent = new FixAgent(config, vk, engine);
  const judgeAgent = new JudgeAgent(config, vk, engine);

  // Register state machine side effects
  registerSideEffects(engine, github, vk, fixAgent, judgeAgent, config);

  // Create and start server
  const app = await createServer({
    config,
    engine,
    github,
    evaluator,
    fixAgent,
    judgeAgent,
    vk,
  });

  await app.listen({ port: config.port, host: config.host });

  logger.info(
    { port: config.port, host: config.host, dryRun: config.dryRun },
    "Pipeline Orchestrator running"
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    clearAllMonitors();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
