export interface Config {
  port: number;
  host: string;
  databasePath: string;
  dryRun: boolean;

  // GitHub
  githubToken: string;
  githubWebhookSecret: string;
  githubOwner: string;
  githubRepo: string;

  // Orchestrator auth
  orchestratorToken: string;

  // VK (Vibe Kanban)
  vkBaseUrl: string;
  vkProjectId: string;
  vkRepoId: string;

  // Hostinger
  hostingerApiToken: string;
  devVpsId: number;
  testVpsId: number;
  prodVpsId: number;

  // Agent settings
  maxFixCycles: number;
  agentTimeoutMs: number;
  agentPollIntervalMs: number;

  // Deploy polling
  deployPollIntervalMs: number;
  deployTimeoutMs: number;
}

export function loadConfig(): Config {
  const dryRun = (process.env.DRY_RUN || "false") === "true";

  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) {
      if (dryRun) return `PLACEHOLDER_${key}`;
      throw new Error(`Missing required env var: ${key}`);
    }
    return val;
  };

  const optional = (key: string, fallback: string): string =>
    process.env[key] || fallback;

  const optionalInt = (key: string, fallback: number): number => {
    const val = process.env[key];
    return val ? parseInt(val, 10) : fallback;
  };

  return {
    port: optionalInt("PORT", 4000),
    host: optional("HOST", "0.0.0.0"),
    databasePath: optional("DATABASE_PATH", "./data/orchestrator.db"),
    dryRun,

    githubToken: required("GITHUB_TOKEN"),
    githubWebhookSecret: required("WEBHOOK_SECRET"),
    githubOwner: optional("GITHUB_OWNER", "shooter51"),
    githubRepo: optional("GITHUB_REPO", "divestreams-v2"),

    orchestratorToken: required("ORCHESTRATOR_TOKEN"),

    vkBaseUrl: optional(
      "VK_BASE_URL",
      "https://toms-mac-studio-1.taile2f004.ts.net:9090"
    ),
    vkProjectId: optional(
      "VK_PROJECT_ID",
      "500e93c8-662d-4f9e-8745-ac4c259ead3c"
    ),
    vkRepoId: optional(
      "VK_REPO_ID",
      "2e2baa81-971b-4735-a0cc-d445d4338e00"
    ),

    hostingerApiToken: required("HOSTINGER_API_TOKEN"),
    devVpsId: optionalInt("DEV_VPS_ID", 1296511),
    testVpsId: optionalInt("TEST_VPS_ID", 1271895),
    prodVpsId: optionalInt("PROD_VPS_ID", 1239852),

    maxFixCycles: optionalInt("MAX_FIX_CYCLES", 3),
    agentTimeoutMs: optionalInt("AGENT_TIMEOUT_MS", 15 * 60 * 1000), // 15 min
    agentPollIntervalMs: optionalInt("AGENT_POLL_INTERVAL_MS", 30_000), // 30s
    deployPollIntervalMs: optionalInt("DEPLOY_POLL_INTERVAL_MS", 10_000), // 10s
    deployTimeoutMs: optionalInt("DEPLOY_TIMEOUT_MS", 120_000), // 2 min
  };
}
