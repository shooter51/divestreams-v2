import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Customer Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const customerId = params.id;

  // TODO: Fetch from tenant database
  // For now, return mock data
  const customer = {
    id: customerId,
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "+1 555-0101",
    dateOfBirth: "1985-06-15",
    emergencyContactName: "Jane Smith",
    emergencyContactPhone: "+1 555-0102",
    emergencyContactRelation: "Spouse",
    medicalConditions: "None",
    medications: "None",
    certifications: [
      { agency: "PADI", level: "Advanced Open Water", number: "12345678", date: "2020-05-10" },
    ],
    address: "123 Ocean Drive",
    city: "Miami",
    state: "FL",
    postalCode: "33139",
    country: "USA",
    preferredLanguage: "en",
    marketingOptIn: true,
    notes: "Prefers morning dives. Experienced underwater photographer.",
    tags: ["photographer", "regular"],
    totalDives: 15,
    totalSpent: "1,250.00",
    lastDiveAt: "2026-01-05",
    createdAt: "2024-03-15",
  };

  const bookings = [
    {
      id: "b1",
      bookingNumber: "BK-2026-001",
      tripName: "Morning 2-Tank Dive",
      date: "2026-01-05",
      status: "completed",
      total: "150.00",
    },
    {
      id: "b2",
      bookingNumber: "BK-2025-089",
      tripName: "Sunset Dive",
      date: "2025-12-20",
      status: "completed",
      total: "85.00",
    },
    {
      id: "b3",
      bookingNumber: "BK-2026-015",
      tripName: "Night Dive Adventure",
      date: "2026-01-18",
      status: "confirmed",
      total: "120.00",
    },
  ];

  return { customer, bookings };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    // TODO: Delete customer
    return { deleted: true };
  }

  return null;
}

export default function CustomerDetailPage() {
  const { customer, bookings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this customer? This cannot be undone.")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/customers" className="text-blue-600 hover:underline text-sm">
          ← Back to Customers
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-gray-500">{customer.email}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/customers/${customer.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{customer.totalDives}</p>
              <p className="text-gray-500 text-sm">Total Dives</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${customer.totalSpent}</p>
              <p className="text-gray-500 text-sm">Total Spent</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{customer.lastDiveAt || "Never"}</p>
              <p className="text-gray-500 text-sm">Last Dive</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p>{customer.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p>{customer.phone || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Date of Birth</p>
                <p>{customer.dateOfBirth || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Language</p>
                <p>{customer.preferredLanguage === "en" ? "English" : customer.preferredLanguage}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Address</h2>
            <p className="text-sm">
              {customer.address && <>{customer.address}<br /></>}
              {customer.city && customer.state && (
                <>{customer.city}, {customer.state} {customer.postalCode}<br /></>
              )}
              {customer.country}
            </p>
          </div>

          {/* Booking History */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Booking History</h2>
              <Link
                to={`/app/bookings/new?customerId=${customer.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                + New Booking
              </Link>
            </div>
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <Link
                      to={`/app/bookings/${booking.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {booking.tripName}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {booking.bookingNumber} • {booking.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${booking.total}</p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        booking.status === "completed"
                          ? "bg-gray-100 text-gray-600"
                          : booking.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Certification */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Certification</h2>
            {customer.certifications?.length > 0 ? (
              customer.certifications.map((cert, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium">{cert.agency} {cert.level}</p>
                  {cert.number && <p className="text-gray-500">#{cert.number}</p>}
                  {cert.date && <p className="text-gray-500">{cert.date}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No certification on file</p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Emergency Contact</h2>
            {customer.emergencyContactName ? (
              <div className="text-sm">
                <p className="font-medium">{customer.emergencyContactName}</p>
                <p className="text-gray-500">{customer.emergencyContactRelation}</p>
                <p>{customer.emergencyContactPhone}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No emergency contact on file</p>
            )}
          </div>

          {/* Medical */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Medical Information</h2>
            <div className="text-sm space-y-2">
              <div>
                <p className="text-gray-500">Conditions</p>
                <p>{customer.medicalConditions || "None reported"}</p>
              </div>
              <div>
                <p className="text-gray-500">Medications</p>
                <p>{customer.medications || "None reported"}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Notes</h2>
            <p className="text-sm">{customer.notes || "No notes"}</p>
            {customer.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {customer.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Customer since {customer.createdAt}</p>
            <p>Marketing: {customer.marketingOptIn ? "Opted in" : "Opted out"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
