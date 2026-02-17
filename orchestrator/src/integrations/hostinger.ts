import type { Config } from "../config.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("hostinger");

export class HostingerClient {
  private apiToken: string;
  private dryRun: boolean;

  constructor(config: Config) {
    this.apiToken = config.hostingerApiToken;
    this.dryRun = config.dryRun;
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `https://api.hostinger.com${path}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hostinger API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async getVpsStatus(vpsId: number) {
    return this.fetch(`/api/vps/v1/virtual-machines/${vpsId}`);
  }

  async getProjectContainers(vpsId: number, projectName: string) {
    return this.fetch(
      `/api/vps/v1/virtual-machines/${vpsId}/projects/${projectName}/containers`
    );
  }

  async pollUntilReady(
    vpsId: number,
    projectName: string,
    pollIntervalMs: number,
    timeoutMs: number
  ): Promise<boolean> {
    log.info(
      { vpsId, projectName, timeoutMs, dryRun: this.dryRun },
      "Polling for deploy readiness"
    );
    if (this.dryRun) return true;

    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const containers = (await this.getProjectContainers(
          vpsId,
          projectName
        )) as Array<{ state: string; name: string }>;

        const allRunning = containers.every((c) => c.state === "running");
        if (allRunning) {
          log.info({ vpsId, projectName }, "All containers running");
          return true;
        }
      } catch {
        // ignore transient errors during polling
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    log.error({ vpsId, projectName, timeoutMs }, "Deploy poll timed out");
    return false;
  }
}
