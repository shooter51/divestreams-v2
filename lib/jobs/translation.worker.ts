import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { translateText } from "../translation/bedrock.server";
import { upsertContentTranslation } from "../db/translations.server";
import { db } from "../db";
import { contentTranslations } from "../db/schema/translations";
import { and, eq } from "drizzle-orm";
import { QUEUES } from "./index";
import { jobLogger } from "../logger";
import type { TranslationJobData } from "./index";

async function hasManualTranslation(
  orgId: string,
  entityType: string,
  entityId: string,
  locale: string,
  field: string
): Promise<boolean> {
  const rows = await db
    .select({ source: contentTranslations.source })
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.organizationId, orgId),
        eq(contentTranslations.entityType, entityType),
        eq(contentTranslations.entityId, entityId),
        eq(contentTranslations.locale, locale),
        eq(contentTranslations.field, field)
      )
    )
    .limit(1);

  return rows.length > 0 && rows[0].source === "manual";
}

async function processTranslationJob(data: TranslationJobData): Promise<void> {
  const { orgId, entityType, entityId, fields, targetLocale } = data;

  jobLogger.info(
    { orgId, entityType, entityId, targetLocale, fieldCount: fields.length },
    "Processing translation job"
  );

  for (const { field, text } of fields) {
    if (!text?.trim()) continue;

    // Skip if a manual translation already exists for this field/locale
    const isManual = await hasManualTranslation(
      orgId,
      entityType,
      entityId,
      targetLocale,
      field
    );
    if (isManual) {
      jobLogger.info(
        { orgId, entityType, entityId, targetLocale, field },
        "Skipping field — manual translation exists"
      );
      continue;
    }

    const translated = await translateText(text, "en", targetLocale);
    await upsertContentTranslation(
      orgId,
      entityType,
      entityId,
      targetLocale,
      field,
      translated,
      "auto"
    );

    jobLogger.info(
      { orgId, entityType, entityId, targetLocale, field },
      "Translation saved"
    );
  }
}

export function createTranslationWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker(
    QUEUES.TRANSLATION,
    async (job) => {
      await processTranslationJob(job.data as TranslationJobData);
    },
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    jobLogger.info({ jobId: job.id, queue: "translation" }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    jobLogger.error(
      { err, jobId: job?.id, queue: "translation" },
      "Job failed"
    );
  });

  return worker;
}
