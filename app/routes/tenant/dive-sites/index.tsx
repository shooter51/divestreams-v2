import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Dive Sites - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const difficulty = url.searchParams.get("difficulty") || "";

  // Mock data
  const diveSites = [
    {
      id: "ds1",
      name: "Blue Corner",
      location: "Palau",
      maxDepth: 30,
      difficulty: "advanced",
      description: "Famous drift dive with sharks, mantas, and schooling fish",
      coordinates: { lat: 7.165, lng: 134.271 },
      conditions: "Strong currents common",
      highlights: ["Sharks", "Mantas", "Wall dive"],
      isActive: true,
      tripCount: 45,
    },
    {
      id: "ds2",
      name: "The Wreck",
      location: "Local Harbor",
      maxDepth: 18,
      difficulty: "intermediate",
      description: "Historic cargo ship sunk in 1985, now home to diverse marine life",
      coordinates: { lat: 7.345, lng: 134.465 },
      conditions: "Generally calm, some current",
      highlights: ["Wreck penetration", "Soft corals", "Nudibranchs"],
      isActive: true,
      tripCount: 32,
    },
    {
      id: "ds3",
      name: "Coral Garden",
      location: "South Bay",
      maxDepth: 12,
      difficulty: "beginner",
      description: "Shallow reef perfect for beginners and snorkelers",
      coordinates: { lat: 7.289, lng: 134.390 },
      conditions: "Protected bay, calm waters",
      highlights: ["Colorful corals", "Tropical fish", "Turtles"],
      isActive: true,
      tripCount: 78,
    },
    {
      id: "ds4",
      name: "Shark Point",
      location: "Outer Reef",
      maxDepth: 40,
      difficulty: "expert",
      description: "Deep wall dive with guaranteed shark encounters",
      coordinates: { lat: 7.412, lng: 134.521 },
      conditions: "Strong currents, advanced divers only",
      highlights: ["Grey reef sharks", "Deep wall", "Pelagics"],
      isActive: true,
      tripCount: 15,
    },
    {
      id: "ds5",
      name: "Manta Station",
      location: "Channel",
      maxDepth: 22,
      difficulty: "intermediate",
      description: "Cleaning station with regular manta ray visits",
      coordinates: { lat: 7.198, lng: 134.333 },
      conditions: "Current varies with tide",
      highlights: ["Manta rays", "Cleaning station", "Photography"],
      isActive: false,
      tripCount: 28,
    },
  ].filter((site) => {
    if (search && !site.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (difficulty && site.difficulty !== difficulty) return false;
    return true;
  });

  return { diveSites, total: diveSites.length, search, difficulty };
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-blue-100 text-blue-700",
  advanced: "bg-orange-100 text-orange-700",
  expert: "bg-red-100 text-red-700",
};

export default function DiveSitesPage() {
  const { diveSites, total, search, difficulty } = useLoaderData<typeof loader>();
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

  const setDifficulty = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("difficulty", value);
    else params.delete("difficulty");
    setSearchParams(params);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dive Sites</h1>
          <p className="text-gray-500">{total} sites</p>
        </div>
        <Link
          to="/app/dive-sites/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Site
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1">
          <input
            type="search"
            name="q"
            placeholder="Search dive sites..."
            defaultValue={search}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </form>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {/* Sites List */}
      {diveSites.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">No dive sites found.</p>
          <Link
            to="/app/dive-sites/new"
            className="inline-block mt-4 text-blue-600 hover:underline"
          >
            Add your first dive site
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {diveSites.map((site) => (
            <Link
              key={site.id}
              to={`/app/dive-sites/${site.id}`}
              className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                !site.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{site.name}</h3>
                  <p className="text-gray-500 text-sm">{site.location}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    difficultyColors[site.difficulty]
                  }`}
                >
                  {site.difficulty}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {site.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {site.highlights.slice(0, 3).map((h) => (
                  <span
                    key={h}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                  >
                    {h}
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm border-t pt-3">
                <span className="text-gray-500">
                  Max depth: <strong>{site.maxDepth}m</strong>
                </span>
                <span className="text-gray-500">
                  {site.tripCount} trips
                </span>
              </div>

              {!site.isActive && (
                <div className="mt-2 text-xs text-orange-600">Inactive</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
