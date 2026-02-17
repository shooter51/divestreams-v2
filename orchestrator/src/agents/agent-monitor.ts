import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { agentSessions } from "../db/schema.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("agent-monitor");

export interface AgentMonitorOptions {
  pollIntervalMs: number;
  timeoutMs: number;
  onComplete: (session: { id: string; commitSha?: string }) => Promise<void>;
  onTimeout: (sessionId: string) => Promise<void>;
  onFailed: (sessionId: string, error: string) => Promise<void>;
}

// Active monitors — key is session ID
const activeMonitors = new Map<string, NodeJS.Timeout>();

export function startMonitoring(
  sessionId: string,
  options: AgentMonitorOptions
) {
  const timeoutAt = new Date(Date.now() + options.timeoutMs).toISOString();

  // Update timeout timestamp
  const db = getDb();
  db.update(agentSessions)
    .set({ timeoutAt })
    .where(eq(agentSessions.id, sessionId))
    .then(() => {
      log.info({ sessionId, timeoutAt }, "Agent monitoring started");
    });

  const interval = setInterval(async () => {
    try {
      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionId),
      });

      if (!session) {
        clearMonitor(sessionId);
        return;
      }

      // Check timeout
      if (new Date() > new Date(session.timeoutAt!)) {
        log.warn({ sessionId }, "Agent session timed out");
        await db
          .update(agentSessions)
          .set({ status: "timeout", completedAt: new Date().toISOString() })
          .where(eq(agentSessions.id, sessionId));
        clearMonitor(sessionId);
        await options.onTimeout(sessionId);
        return;
      }

      // Check if completed (status updated externally via webhook)
      if (session.status === "completed") {
        log.info({ sessionId }, "Agent session completed");
        clearMonitor(sessionId);
        await options.onComplete({
          id: sessionId,
          commitSha: session.fixCommitSha ?? undefined,
        });
        return;
      }

      if (session.status === "failed") {
        log.warn({ sessionId }, "Agent session failed");
        clearMonitor(sessionId);
        await options.onFailed(sessionId, "Agent reported failure");
        return;
      }
    } catch (err) {
      log.error({ sessionId, err }, "Agent monitor poll error");
    }
  }, options.pollIntervalMs);

  activeMonitors.set(sessionId, interval);
}

export function clearMonitor(sessionId: string) {
  const interval = activeMonitors.get(sessionId);
  if (interval) {
    clearInterval(interval);
    activeMonitors.delete(sessionId);
  }
}

export function clearAllMonitors() {
  for (const [id, interval] of activeMonitors) {
    clearInterval(interval);
  }
  activeMonitors.clear();
}
