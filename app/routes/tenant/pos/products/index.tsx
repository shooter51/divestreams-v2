/**
 * Products List
 *
 * Displays all products for the POS system with search and filtering.
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useSearchParams } from "react-router";
import { requireOrgContext, requireRole } from "../../../../../lib/auth/org-context.server";
import {
  getProducts,
  getProductCategories,
  deleteProduct,
  type Product,
} from "../../../../../lib/db/queries.server";
import { formatLabel } from "../../../../lib/format";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Products - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const [products, categories] = await Promise.all([
    getProducts(organizationId, { category, search, activeOnly: false }),
    getProductCategories(organizationId),
  ]);

  return { products, categories };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteProduct(organizationId, id);
    return { success: true };
  }

  return { error: "Invalid action" };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const categoryColors: Record<string, string> = {
  equipment: "bg-brand-muted text-brand",
  apparel: "bg-info-muted text-info",
  accessories: "bg-success-muted text-success",
  courses: "bg-accent-muted text-accent",
  rental: "bg-accent-muted text-accent",
};

export default function ProductsPage() {
  const { products, categories } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const t = useT();

  const categoryLabels: Record<string, string> = {
    regulator: t("tenant.pos.products.categoryRegulator"),
    bcd: t("tenant.pos.products.categoryBCD"),
    wetsuit: t("tenant.pos.products.categoryWetsuit"),
    mask: t("tenant.pos.products.categoryMask"),
    fins: t("tenant.pos.products.categoryFins"),
    tank: t("tenant.pos.products.categoryTank"),
    computer: t("tenant.pos.products.categoryComputer"),
    torch: t("tenant.pos.products.categoryTorch"),
    equipment: t("tenant.pos.products.categoryEquipment"),
    apparel: t("tenant.pos.products.categoryApparel"),
    accessories: t("tenant.pos.products.categoryAccessories"),
    courses: t("tenant.pos.products.categoryCourses"),
    rental: t("tenant.pos.products.categoryRental"),
    other: t("tenant.pos.products.categoryOther"),
  };

  const currentCategory = searchParams.get("category") || "";
  const currentSearch = searchParams.get("search") || "";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.pos.products.title")}</h1>
          <p className="text-sm text-foreground-muted">{t("tenant.pos.products.count", { count: products.length })}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/tenant/pos"
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("tenant.pos.products.backToPOS")}
          </Link>
          <Link
            to="/tenant/pos/products/new"
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            {t("tenant.pos.products.addProduct")}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-raised rounded-xl p-4 shadow-sm mb-6">
        <Form method="get" className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder={t("tenant.pos.products.searchPlaceholder")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>
          <select
            name="category"
            defaultValue={currentCategory}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
          >
            <option value="">{t("tenant.pos.products.allCategories")}</option>
            {categories.map((cat: string) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
          >
            {t("common.filter")}
          </button>
          {(currentCategory || currentSearch) && (
            <Link
              to="/tenant/pos/products"
              className="px-4 py-2 text-foreground-muted hover:text-foreground"
            >
              {t("tenant.pos.products.clear")}
            </Link>
          )}
        </Form>
      </div>

      {/* Products Table */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        {products.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-inset">
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tableProduct")}</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tableCategory")}</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tableSKU")}</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tablePrice")}</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tableStock")}</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tableStatus")}</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-foreground-muted">{t("tenant.pos.products.tableActions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: Product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-surface-inset">
                  <td className="px-6 py-4">
                    <Link
                      to={`/tenant/pos/products/${product.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.description && (
                      <p className="text-sm text-foreground-muted truncate max-w-xs">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        categoryColors[product.category] || "bg-surface-inset text-foreground"
                      }`}
                    >
                      {categoryLabels[product.category] || formatLabel(product.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground-muted">
                    {product.sku || "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {product.trackInventory ? (
                      <span
                        className={
                          product.stockQuantity <= product.lowStockThreshold
                            ? "text-accent font-medium"
                            : ""
                        }
                      >
                        {product.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-foreground-subtle">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.isActive
                          ? "bg-success-muted text-success"
                          : "bg-surface-inset text-foreground-muted"
                      }`}
                    >
                      {product.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/tenant/pos/products/${product.id}/edit`}
                        className="text-sm text-brand hover:underline"
                      >
                        {t("common.edit")}
                      </Link>
                      <Form method="post" className="inline">
                        <CsrfInput />
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={product.id} />
                        <button
                          type="submit"
                          onClick={(e) => {
                            if (!confirm(t("tenant.pos.products.confirmDelete"))) {
                              e.preventDefault();
                            }
                          }}
                          className="text-sm text-danger hover:underline"
                        >
                          {t("common.delete")}
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-foreground-muted mb-4">{t("tenant.pos.products.noProducts")}</p>
            <Link
              to="/tenant/pos/products/new"
              className="text-brand hover:underline"
            >
              {t("tenant.pos.products.addFirst")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
