import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { getEquipment } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Equipment - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const status = url.searchParams.get("status") || "";

  // Get all equipment first for stats, then filter for display
  const allEquipment = await getEquipment(tenant.schemaName, {});
  const equipment = await getEquipment(tenant.schemaName, {
    search: search || undefined,
    category: category || undefined,
    status: status || undefined,
  });

  const stats = {
    total: allEquipment.length,
    available: allEquipment.filter((e) => e.status === "available").length,
    rented: allEquipment.filter((e) => e.status === "rented").length,
    maintenance: allEquipment.filter((e) => e.status === "maintenance").length,
    retired: allEquipment.filter((e) => e.status === "retired").length,
  };

  return { equipment, stats, search, category, status };
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
  const { equipment, stats, search, category, status } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipment Inventory</h1>
          <p className="text-gray-500">{stats.total} items total</p>
        </div>
        <Link
          to="/app/equipment/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Equipment
        </Link>
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
          <p className="text-gray-500 text-sm">Rented</p>
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
            to="/app/equipment/new"
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
                      to={`/app/equipment/${item.id}`}
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
                    <span className={`text-sm ${conditionColors[item.condition]}`}>
                      {item.condition}
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
                      <span className="text-sm">${item.rentalPrice}/day</span>
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
    </div>
  );
}
