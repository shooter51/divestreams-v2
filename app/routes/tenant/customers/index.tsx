import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Customers - DiveStreams" }];

export default function CustomersPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <a href="/app/customers/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Customer
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No customers yet. Add your first customer to get started.</p>
      </div>
    </div>
  );
}
