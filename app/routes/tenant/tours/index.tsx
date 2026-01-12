import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Tours - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const typeFilter = url.searchParams.get("type") || "";

  // Mock data for now - will query tenant DB
  const tours = [
    {
      id: "1",
      name: "Morning 2-Tank Dive",
      type: "multi_dive",
      duration: 240,
      maxParticipants: 12,
      price: "150.00",
      currency: "USD",
      minCertLevel: "Open Water",
      isActive: true,
      tripCount: 45,
    },
    {
      id: "2",
      name: "Sunset Dive",
      type: "single_dive",
      duration: 120,
      maxParticipants: 8,
      price: "85.00",
      currency: "USD",
      minCertLevel: "Open Water",
      isActive: true,
      tripCount: 32,
    },
    {
      id: "3",
      name: "Night Dive Adventure",
      type: "night_dive",
      duration: 150,
      maxParticipants: 6,
      price: "120.00",
      currency: "USD",
      minCertLevel: "Advanced Open Water",
      isActive: true,
      tripCount: 18,
    },
    {
      id: "4",
      name: "Discover Scuba",
      type: "course",
      duration: 180,
      maxParticipants: 4,
      price: "199.00",
      currency: "USD",
      minCertLevel: null,
      isActive: true,
      tripCount: 28,
    },
    {
      id: "5",
      name: "Snorkel Safari",
      type: "snorkel",
      duration: 180,
      maxParticipants: 20,
      price: "65.00",
      currency: "USD",
      minCertLevel: null,
      isActive: false,
      tripCount: 12,
    },
  ].filter((t) => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return { tours, total: tours.length, search, typeFilter };
}

const tourTypes: Record<string, { label: string; color: string }> = {
  single_dive: { label: "Single Dive", color: "bg-blue-100 text-blue-700" },
  multi_dive: { label: "Multi-Dive", color: "bg-indigo-100 text-indigo-700" },
  course: { label: "Course", color: "bg-purple-100 text-purple-700" },
  snorkel: { label: "Snorkel", color: "bg-cyan-100 text-cyan-700" },
  night_dive: { label: "Night Dive", color: "bg-slate-100 text-slate-700" },
  other: { label: "Other", color: "bg-gray-100 text-gray-700" },
};

export default function ToursPage() {
  const { tours, total, search, typeFilter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    const type = formData.get("type") as string;
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    setSearchParams(params);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tours</h1>
          <p className="text-gray-500">{total} tour templates</p>
        </div>
        <Link
          to="/app/tours/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Tour
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search tours..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="type"
          defaultValue={typeFilter}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="single_dive">Single Dive</option>
          <option value="multi_dive">Multi-Dive</option>
          <option value="course">Course</option>
          <option value="snorkel">Snorkel</option>
          <option value="night_dive">Night Dive</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* Tour Grid */}
      {tours.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">
            {search || typeFilter
              ? "No tours found matching your filters."
              : "No tours yet. Create your first tour template to get started."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tours.map((tour) => (
            <Link
              key={tour.id}
              to={`/app/tours/${tour.id}`}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg">{tour.name}</h3>
                {!tour.isActive && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
                    Inactive
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      tourTypes[tour.type]?.color || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {tourTypes[tour.type]?.label || tour.type}
                  </span>
                  {tour.minCertLevel && (
                    <span className="text-xs text-gray-500">
                      {tour.minCertLevel}+
                    </span>
                  )}
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>{formatDuration(tour.duration)}</span>
                  <span>Max {tour.maxParticipants} pax</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold text-lg">
                    ${tour.price}
                  </span>
                  <span className="text-gray-500">
                    {tour.tripCount} trips run
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
