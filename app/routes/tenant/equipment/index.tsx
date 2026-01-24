import { useState } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { equipment } from "../../../../lib/db/schema";
import { eq, or, ilike, sql, count, and } from "drizzle-orm";
import { UpgradePrompt } from "../../../components/ui/UpgradePrompt";
import { BarcodeScannerModal } from "../../../components/BarcodeScannerModal";

export const meta: MetaFunction = () => [{ title: "Equipment - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const status = url.searchParams.get("status") || "";

  // Build query with organization filter
  const baseCondition = eq(equipment.organizationId, ctx.org.id);

  // Build filter conditions
  let whereCondition = baseCondition;

  if (search) {
    const searchCondition = or(
      ilike(equipment.name, `%${search}%`),
      ilike(equipment.brand, `%${search}%`),
      ilike(equipment.model, `%${search}%`)
    );
    whereCondition = sql`${baseCondition} AND ${searchCondition}`;
  }

  if (category) {
    const categoryCondition = eq(equipment.category, category);
    whereCondition = search
      ? sql`${whereCondition} AND ${categoryCondition}`
      : sql`${baseCondition} AND ${categoryCondition}`;
  }

  if (status) {
    const statusCondition = eq(equipment.status, status);
    whereCondition = search || category
      ? sql`${whereCondition} AND ${statusCondition}`
      : sql`${baseCondition} AND ${statusCondition}`;
  }

  // Get filtered equipment
  const equipmentList = await db
    .select()
    .from(equipment)
    .where(whereCondition)
    .orderBy(equipment.name);

  // Get stats from all equipment (not filtered)
  const allEquipment = await db
    .select()
    .from(equipment)
    .where(baseCondition);

  const stats = {
    total: allEquipment.length,
    available: allEquipment.filter((e) => e.status === "available").length,
    rented: allEquipment.filter((e) => e.status === "rented").length,
    maintenance: allEquipment.filter((e) => e.status === "maintenance").length,
    retired: allEquipment.filter((e) => e.status === "retired").length,
  };

  // Count rentable equipment
  const rentableCount = allEquipment.filter((e) => e.isRentable).length;

  return {
    equipment: equipmentList,
    stats,
    search,
    category,
    status,
    // Freemium data for equipment rentals
    hasEquipmentRentals: ctx.limits.hasEquipmentRentals,
    isPremium: ctx.isPremium,
    rentableCount,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "barcode-lookup") {
    const barcode = formData.get("barcode") as string;
    if (!barcode) {
      return { error: "No barcode provided" };
    }

    // Look up equipment by barcode
    const [foundEquipment] = await db
      .select()
      .from(equipment)
      .where(
        and(
          eq(equipment.organizationId, ctx.org.id),
          eq(equipment.barcode, barcode)
        )
      )
      .limit(1);

    if (foundEquipment) {
      return { found: true, equipmentId: foundEquipment.id, equipmentName: foundEquipment.name };
    } else {
      return { found: false, error: `No equipment found with barcode: ${barcode}` };
    }
  }

  return null;
}

const categoryLabels: Record<string, string> = {
  bcd: "BCD",
  regulator: "Regulator",
  wetsuit: "Wetsuit",
  mask: "Mask",
  fins: "Fins",
  tank: "Tank",
  computer: "Dive Computer",
  other: "Other",
};

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  rented: "bg-blue-100 text-blue-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  retired: "bg-gray-100 text-gray-600",
};

const conditionColors: Record<string, string> = {
  excellent: "text-green-600",
  good: "text-blue-600",
  fair: "text-yellow-600",
  poor: "text-red-600",
};

export default function EquipmentPage() {
  const {
    equipment,
    stats,
    search,
    category,
    status,
    hasEquipmentRentals,
    isPremium,
    rentableCount
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const fetcher = useFetcher<{ found?: boolean; equipmentId?: string; equipmentName?: string; error?: string }>();

  // Handle barcode scan result
  const handleBarcodeScan = (barcode: string) => {
    setShowBarcodeScanner(false);
    setBarcodeError(null);
    fetcher.submit(
      { intent: "barcode-lookup", barcode },
      { method: "post" }
    );
  };

  // Navigate to equipment details when barcode lookup succeeds
  if (fetcher.data?.found && fetcher.data.equipmentId) {
    window.location.href = `/tenant/equipment/${fetcher.data.equipmentId}`;
  }

  // Show error if barcode lookup failed
  if (fetcher.data?.error && !barcodeError) {
    setBarcodeError(fetcher.data.error);
    // Clear error after 5 seconds
    setTimeout(() => setBarcodeError(null), 5000);
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams);
    const q = formData.get("q") as string;
    if (q) params.set("q", q);
    else params.delete("q");
    setSearchParams(params);
  };

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  return (
    <div>
      {/* Show rental upgrade prompt if trying to use rentals without premium */}
      {!isPremium && rentableCount > 0 && (
        <div className="mb-6">
          <UpgradePrompt
            feature="Equipment Rentals"
            variant="inline"
          />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipment Inventory</h1>
          <p className="text-gray-500">{stats.total} items total</p>
        </div>
        <div className="flex gap-3">
          {/* Scan Barcode button */}
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan Barcode
          </button>
          {/* Rental management button - premium only */}
          {hasEquipmentRentals ? (
            <Link
              to="/tenant/equipment/rentals"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Manage Rentals
            </Link>
          ) : (
            <button
              className="px-4 py-2 border rounded-lg text-gray-400 cursor-not-allowed text-sm relative group"
              disabled
            >
              Manage Rentals
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                Premium feature
              </span>
            </button>
          )}
          <Link
            to="/tenant/equipment/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Equipment
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 ${
            !status ? "ring-2 ring-blue-500" : ""
          }`}
          onClick={() => setFilter("status", "")}
        >
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-gray-500 text-sm">Total</p>
        </div>
        <div
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-green-500 ${
            status === "available" ? "ring-2 ring-green-500" : ""
          }`}
          onClick={() => setFilter("status", "available")}
        >
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
          <p className="text-gray-500 text-sm">Available</p>
        </div>
        <div
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 ${
            status === "rented" ? "ring-2 ring-blue-500" : ""
          }`}
          onClick={() => setFilter("status", "rented")}
        >
          <p className="text-2xl font-bold text-blue-600">{stats.rented}</p>
          <p className="text-gray-500 text-sm">
            Rented
            {!hasEquipmentRentals && stats.rented > 0 && (
              <span className="ml-1 text-xs text-amber-500">(Premium)</span>
            )}
          </p>
        </div>
        <div
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-yellow-500 ${
            status === "maintenance" ? "ring-2 ring-yellow-500" : ""
          }`}
          onClick={() => setFilter("status", "maintenance")}
        >
          <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
          <p className="text-gray-500 text-sm">Maintenance</p>
        </div>
        <div
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-gray-500 ${
            status === "retired" ? "ring-2 ring-gray-500" : ""
          }`}
          onClick={() => setFilter("status", "retired")}
        >
          <p className="text-2xl font-bold text-gray-600">{stats.retired}</p>
          <p className="text-gray-500 text-sm">Retired</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1">
          <input
            type="search"
            name="q"
            placeholder="Search equipment..."
            defaultValue={search}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </form>
        <select
          value={category}
          onChange={(e) => setFilter("category", e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="bcd">BCD</option>
          <option value="regulator">Regulator</option>
          <option value="wetsuit">Wetsuit</option>
          <option value="mask">Mask</option>
          <option value="fins">Fins</option>
          <option value="tank">Tank</option>
          <option value="computer">Dive Computer</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Equipment List */}
      {equipment.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">No equipment found.</p>
          <Link
            to="/tenant/equipment/new"
            className="inline-block mt-4 text-blue-600 hover:underline"
          >
            Add your first equipment item
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-sm">Item</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Category</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Size</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Condition</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                <th className="text-right py-3 px-4 font-medium text-sm">Rental</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {equipment.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link
                      to={`/tenant/equipment/${item.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {item.brand} {item.model}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm">{categoryLabels[item.category]}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm">{item.size || "-"}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-sm ${item.condition ? conditionColors[item.condition] : ''}`}>
                      {item.condition || "Unknown"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[item.status]
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.isRentable ? (
                      <div>
                        <span className="text-sm">${Number(item.rentalPrice || 0).toFixed(2)}/day</span>
                        {!hasEquipmentRentals && (
                          <span className="ml-1 text-xs text-amber-500" title="Premium feature required for rentals">
                            *
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Premium rental notice */}
      {!isPremium && rentableCount > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          <span className="text-amber-500">*</span> Equipment rentals require a premium subscription.{" "}
          <Link to="/tenant/settings/billing" className="text-blue-600 hover:underline">
            Upgrade now
          </Link>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan Equipment Barcode"
        showConfirmation={false}
      />

      {/* Barcode Error Toast */}
      {barcodeError && (
        <div className="fixed bottom-4 left-4 bg-amber-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {barcodeError}
        </div>
      )}
    </div>
  );
}
