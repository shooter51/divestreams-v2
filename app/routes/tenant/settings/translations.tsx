import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { requireOrgContext, requireRole } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { tours, products } from "../../../../lib/db/schema";
import { trainingCourses } from "../../../../lib/db/schema/training";
import { contentTranslations } from "../../../../lib/db/schema/translations";
import { eq, and } from "drizzle-orm";
import { upsertContentTranslation } from "../../../../lib/db/translations.server";
import { enqueueTranslation } from "../../../../lib/jobs/index";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS } from "../../../i18n/types";
import { useT } from "../../../i18n/use-t";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Translations - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);

  const rows = await db
    .select()
    .from(contentTranslations)
    .where(eq(contentTranslations.organizationId, ctx.org.id))
    .orderBy(
      contentTranslations.entityType,
      contentTranslations.entityId,
      contentTranslations.locale,
      contentTranslations.field
    );

  // Collect unique entity keys to fetch source texts
  const entityKeys = new Set<string>();
  for (const row of rows) {
    entityKeys.add(`${row.entityType}:${row.entityId}`);
  }

  // Fetch source texts for all entities
  const sourceTexts: Record<string, Record<string, string | null>> = {};
  for (const key of entityKeys) {
    const [entityType, entityId] = key.split(":");
    sourceTexts[key] = await getEntitySourceTexts(ctx.org.id, entityType, entityId);
  }

  return { translations: rows, sourceTexts };
}

async function getEntitySourceTexts(
  orgId: string,
  entityType: string,
  entityId: string,
): Promise<Record<string, string | null>> {
  if (entityType === "tour") {
    const [row] = await db
      .select({ name: tours.name, description: tours.description })
      .from(tours)
      .where(and(eq(tours.id, entityId), eq(tours.organizationId, orgId)))
      .limit(1);
    return row ? { name: row.name, description: row.description } : {};
  }
  if (entityType === "course") {
    const [row] = await db
      .select({ name: trainingCourses.name, description: trainingCourses.description })
      .from(trainingCourses)
      .where(and(eq(trainingCourses.id, entityId), eq(trainingCourses.organizationId, orgId)))
      .limit(1);
    return row ? { name: row.name, description: row.description } : {};
  }
  if (entityType === "product") {
    const [row] = await db
      .select({ name: products.name, description: products.description })
      .from(products)
      .where(and(eq(products.id, entityId), eq(products.organizationId, orgId)))
      .limit(1);
    return row ? { name: row.name, description: row.description } : {};
  }
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update") {
    const id = formData.get("id") as string;
    const value = formData.get("value") as string;

    // Look up the existing row to get the key fields
    const [row] = await db
      .select()
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.id, id),
          eq(contentTranslations.organizationId, ctx.org.id)
        )
      )
      .limit(1);

    if (!row) {
      return { error: "Translation not found" };
    }

    await upsertContentTranslation(
      ctx.org.id,
      row.entityType,
      row.entityId,
      row.locale,
      row.field,
      value,
      "manual"
    );

    return { success: true };
  }

  if (intent === "retranslate") {
    const entityType = formData.get("entityType") as string;
    const entityId = formData.get("entityId") as string;

    // Fetch source entity text for retranslation
    const sourceTexts = await getEntitySourceTexts(ctx.org.id, entityType, entityId);
    const fields = Object.entries(sourceTexts)
      .filter(([, text]) => text?.trim())
      .map(([field, text]) => ({ field, text: text! }));

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      await enqueueTranslation({
        orgId: ctx.org.id,
        entityType,
        entityId,
        fields,
        targetLocale: locale,
      });
    }

    return { success: true };
  }

  if (intent === "translate-all") {
    // Fetch all translatable entities for this org
    const allTours = await db
      .select({ id: tours.id, name: tours.name, description: tours.description })
      .from(tours)
      .where(eq(tours.organizationId, ctx.org.id));

    const allCourses = await db
      .select({ id: trainingCourses.id, name: trainingCourses.name, description: trainingCourses.description })
      .from(trainingCourses)
      .where(eq(trainingCourses.organizationId, ctx.org.id));

    const allProducts = await db
      .select({ id: products.id, name: products.name, description: products.description })
      .from(products)
      .where(eq(products.organizationId, ctx.org.id));

    let enqueued = 0;

    const enqueueEntity = async (entityType: string, entity: { id: string; name: string; description: string | null }) => {
      const fields = [
        { field: "name", text: entity.name },
        ...(entity.description?.trim() ? [{ field: "description", text: entity.description }] : []),
      ];
      if (fields.length === 0) return;
      for (const locale of SUPPORTED_LOCALES) {
        if (locale === DEFAULT_LOCALE) continue;
        await enqueueTranslation({
          orgId: ctx.org.id,
          entityType,
          entityId: entity.id,
          fields,
          targetLocale: locale,
        });
        enqueued++;
      }
    };

    for (const tour of allTours) await enqueueEntity("tour", tour);
    for (const course of allCourses) await enqueueEntity("course", course);
    for (const product of allProducts) await enqueueEntity("product", product);

    return { success: true, enqueued };
  }

  return { error: "Unknown action" };
}

interface TranslationRow {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  locale: string;
  field: string;
  value: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

function groupByEntity(
  translations: TranslationRow[]
): Map<string, TranslationRow[]> {
  const map = new Map<string, TranslationRow[]>();
  for (const row of translations) {
    const key = `${row.entityType}:${row.entityId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return map;
}

export default function TranslationsPage() {
  const { translations, sourceTexts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const grouped = groupByEntity(translations as TranslationRow[]);
  const t = useT();

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.translations.title")}</h1>
          <p className="text-foreground-muted mt-1">
            {t("tenant.translations.description")}
          </p>
        </div>
        <fetcher.Form method="post">
          <CsrfInput />
          <input type="hidden" name="intent" value="translate-all" />
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            disabled={fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting"
              ? t("tenant.translations.translating")
              : t("tenant.translations.translateAll")}
          </button>
        </fetcher.Form>
      </div>

      {fetcher.data && "enqueued" in fetcher.data && (
        <div className="mb-4 p-3 bg-success-muted text-success rounded-lg text-sm">
          {t("tenant.translations.enqueued", { count: String(fetcher.data.enqueued) })}
        </div>
      )}

      {translations.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-8 text-center text-foreground-muted">
          {t("tenant.translations.empty")}
        </div>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([entityKey, rows]) => {
            const [entityType, entityId] = entityKey.split(":");
            const entitySource = sourceTexts[entityKey] || {};
            const entityName = entitySource.name || entityId;
            return (
              <div key={entityKey} className="bg-surface-raised rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      {entityType}
                    </span>
                    <p className="text-sm font-medium">{entityName}</p>
                  </div>
                  <fetcher.Form method="post">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="retranslate" />
                    <input type="hidden" name="entityType" value={entityType} />
                    <input type="hidden" name="entityId" value={entityId} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                      disabled={fetcher.state === "submitting"}
                    >
                      {t("tenant.translations.retranslate")}
                    </button>
                  </fetcher.Form>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-foreground-muted border-b border-surface-overlay">
                      <th className="pb-2 font-medium">{t("tenant.translations.field")}</th>
                      <th className="pb-2 font-medium">{t("tenant.translations.locale")}</th>
                      <th className="pb-2 font-medium">{t("tenant.translations.original")}</th>
                      <th className="pb-2 font-medium">{t("tenant.translations.value")}</th>
                      <th className="pb-2 font-medium">{t("tenant.translations.source")}</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-overlay">
                    {rows.map((row) => (
                      <EditableRow key={row.id} row={row as TranslationRow} originalText={entitySource[row.field] || ""} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditableRow({ row, originalText }: { row: TranslationRow; originalText: string }) {
  const fetcher = useFetcher<typeof action>();
  const t = useT();

  return (
    <tr>
      <td className="py-2 pr-4 font-mono text-xs text-foreground-muted">{row.field}</td>
      <td className="py-2 pr-4">
        <span className="text-xs bg-surface-overlay rounded px-1.5 py-0.5">
          {LOCALE_LABELS[row.locale as keyof typeof LOCALE_LABELS] ?? row.locale}
        </span>
      </td>
      <td className="py-2 pr-4 text-foreground-muted max-w-[200px] truncate" title={originalText}>
        {originalText}
      </td>
      <td className="py-2 pr-4">
        <fetcher.Form method="post" className="flex gap-2 items-center">
          <CsrfInput />
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="id" value={row.id} />
          <input
            type="text"
            name="value"
            defaultValue={row.value}
            className="w-full border border-surface-overlay rounded px-2 py-1 text-sm bg-background"
          />
          <button
            type="submit"
            className="px-2 py-1 text-xs bg-brand text-white rounded hover:opacity-90 whitespace-nowrap disabled:opacity-50"
            disabled={fetcher.state === "submitting"}
          >
            {t("tenant.translations.save")}
          </button>
        </fetcher.Form>
      </td>
      <td className="py-2 pr-4">
        <span
          className={`text-xs rounded-full px-2 py-0.5 ${
            row.source === "manual"
              ? "bg-success-muted text-success"
              : "bg-surface-overlay text-foreground-muted"
          }`}
        >
          {row.source}
        </span>
      </td>
    </tr>
  );
}
