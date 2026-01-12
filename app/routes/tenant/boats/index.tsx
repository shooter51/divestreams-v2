import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Boats - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  // Mock data
  const boats = [
    {
      id: "b1",
      name: "Ocean Explorer",
      type: "Dive Boat",
      capacity: 14,
      registrationNumber: "PW-1234-DV",
      description: "Our flagship vessel with full amenities for day trips",
      amenities: ["Freshwater shower", "Sun deck", "Camera station", "Dive platform", "Toilet"],
      isActive: true,
      tripCount: 156,
      lastMaintenance: "2025-12-15",
      nextMaintenance: "2026-03-15",
    },
    {
      id: "b2",
      name: "Sea Breeze",
      type: "Speed Boat",
      capacity: 10,
      registrationNumber: "PW-5678-SP",
      description: "Fast and agile for reaching distant dive sites quickly",
      amenities: ["Dive platform", "Storage lockers", "Shade cover"],
      isActive: true,
      tripCount: 89,
      lastMaintenance: "2026-01-05",
      nextMaintenance: "2026-04-05",
    },
    {
      id: "b3",
      name: "Coral Queen",
      type: "Catamaran",
      capacity: 20,
      registrationNumber: "PW-9012-CT",
      description: "Spacious catamaran ideal for larger groups and snorkeling tours",
      amenities: ["Two toilets", "Large sun deck", "BBQ grill", "Sound system", "Camera station"],
      isActive: true,
      tripCount: 45,
      lastMaintenance: "2025-11-20",
      nextMaintenance: "2026-02-20",
    },
    {
      id: "b4",
      name: "Night Diver",
      type: "Dive Boat",
      capacity: 8,
      registrationNumber: "PW-3456-ND",
      description: "Specialized for night and small group dives",
      amenities: ["Dive lights", "Dive platform", "First aid kit"],
      isActive: false,
      tripCount: 23,
      lastMaintenance: "2025-10-10",
      nextMaintenance: "2026-01-10",
    },
  ].filter((boat) => {
    if (search && !boat.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCapacity = boats.filter((b) => b.isActive).reduce((sum, b) => sum + b.capacity, 0);
  const activeCount = boats.filter((b) => b.isActive).length;

  return { boats, total: boats.length, activeCount, totalCapacity, search };
}

export default function BoatsPage() {
  const { boats, total, activeCount, totalCapacity, search } = useLoaderData<typeof loader>();
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Boats & Vessels</h1>
          <p className="text-gray-500">
            {activeCount} active boats • {totalCapacity} total capacity
          </p>
        </div>
        <Link
          to="/app/boats/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Boat
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="search"
          name="q"
          placeholder="Search boats..."
          defaultValue={search}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-gray-500 text-sm">Total Boats</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-gray-500 text-sm">Active</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{totalCapacity}</p>
          <p className="text-gray-500 text-sm">Total Capacity</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">
            {boats.reduce((sum, b) => sum + b.tripCount, 0)}
          </p>
          <p className="text-gray-500 text-sm">Total Trips</p>
        </div>
      </div>

      {/* Boats List */}
      {boats.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">No boats found.</p>
          <Link
            to="/app/boats/new"
            className="inline-block mt-4 text-blue-600 hover:underline"
          >
            Add your first boat
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {boats.map((boat) => (
            <Link
              key={boat.id}
              to={`/app/boats/${boat.id}`}
              className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                !boat.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{boat.name}</h3>
                  <p className="text-gray-500 text-sm">{boat.type}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    boat.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {boat.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {boat.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {boat.amenities.slice(0, 3).map((a) => (
                  <span
                    key={a}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                  >
                    {a}
                  </span>
                ))}
                {boat.amenities.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{boat.amenities.length - 3} more
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-sm border-t pt-3">
                <span>
                  <strong>{boat.capacity}</strong> passengers
                </span>
                <span className="text-gray-500">{boat.tripCount} trips</span>
              </div>

              {boat.registrationNumber && (
                <p className="text-xs text-gray-400 mt-2">
                  Reg: {boat.registrationNumber}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
