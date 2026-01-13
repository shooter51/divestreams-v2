/**
 * POS Checkout Modals
 */

import { useState } from "react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (payments: Array<{ method: "card" | "cash"; amount: number; stripePaymentIntentId?: string }>) => void;
}

// Cash Payment Modal
export function CashModal({ isOpen, onClose, total, onComplete }: CheckoutModalProps) {
  const [tendered, setTendered] = useState("");
  const tenderedAmount = parseFloat(tendered) || 0;
  const change = tenderedAmount - total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Cash Payment</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Total Due</label>
            <p className="text-3xl font-bold text-blue-600">${total.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount Tendered</label>
            <input
              type="number"
              step="0.01"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full px-4 py-3 text-2xl border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {tenderedAmount >= total && (
            <div className="p-4 bg-green-50 rounded-lg">
              <label className="block text-sm font-medium mb-1">Change Due</label>
              <p className="text-3xl font-bold text-green-600">${change.toFixed(2)}</p>
            </div>
          )}

          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[20, 50, 100, Math.ceil(total)].map(amount => (
              <button
                key={amount}
                onClick={() => setTendered(amount.toString())}
                className="py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete([{ method: "cash", amount: total }])}
            disabled={tenderedAmount < total}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Split Payment Modal
export function SplitModal({ isOpen, onClose, total, onComplete }: CheckoutModalProps) {
  const [payments, setPayments] = useState<Array<{ method: "card" | "cash"; amount: number }>>([]);
  const [currentMethod, setCurrentMethod] = useState<"card" | "cash">("card");
  const [currentAmount, setCurrentAmount] = useState("");

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  const addPayment = () => {
    const amount = parseFloat(currentAmount);
    if (amount > 0 && amount <= remaining) {
      setPayments([...payments, { method: currentMethod, amount }]);
      setCurrentAmount("");
    }
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Split Payment</h2>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Paid</span>
            <span className="font-bold">${paidAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span>Remaining</span>
            <span className="font-bold text-blue-600">${remaining.toFixed(2)}</span>
          </div>

          {/* Existing payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="capitalize">{payment.method}</span>
                  <div className="flex items-center gap-2">
                    <span>${payment.amount.toFixed(2)}</span>
                    <button
                      onClick={() => removePayment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add payment */}
          {remaining > 0 && (
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMethod("card")}
                  className={`flex-1 py-2 rounded-lg ${
                    currentMethod === "card"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  Card
                </button>
                <button
                  onClick={() => setCurrentMethod("cash")}
                  className={`flex-1 py-2 rounded-lg ${
                    currentMethod === "cash"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  Cash
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={() => setCurrentAmount(remaining.toFixed(2))}
                  className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Rest
                </button>
                <button
                  onClick={addPayment}
                  disabled={!currentAmount || parseFloat(currentAmount) <= 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setPayments([]);
              onClose();
            }}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(payments)}
            disabled={remaining > 0.01}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Rental Agreement Modal
interface RentalAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (staffName: string) => void;
  customer: { firstName: string; lastName: string; email: string; phone?: string | null } | null;
  rentals: Array<{
    name: string;
    size?: string;
    days: number;
    dailyRate: number;
    total: number;
  }>;
  shopName: string;
  agreementNumber: string;
}

export function RentalAgreementModal({
  isOpen,
  onClose,
  onConfirm,
  customer,
  rentals,
  shopName,
  agreementNumber,
}: RentalAgreementModalProps) {
  const [staffName, setStaffName] = useState("");
  const [agreementSigned, setAgreementSigned] = useState(false);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + Math.max(...rentals.map(r => r.days)));

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Rental Agreement Required</h2>

        {/* Printable Agreement Preview */}
        <div id="rental-agreement" className="p-6 border rounded-lg mb-4 print:border-none">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{shopName}</h1>
            <h2 className="text-lg">Equipment Rental Agreement</h2>
            <p className="text-sm text-gray-600">Agreement #: {agreementNumber}</p>
            <p className="text-sm text-gray-600">{new Date().toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-bold mb-2">Customer</h3>
              <p>{customer.firstName} {customer.lastName}</p>
              <p>{customer.email}</p>
              {customer.phone && <p>{customer.phone}</p>}
            </div>
            <div>
              <h3 className="font-bold mb-2">Rental Period</h3>
              <p>From: {new Date().toLocaleDateString()}</p>
              <p>Due: {dueDate.toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-2">Equipment</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Size</th>
                  <th className="text-right py-2">Days</th>
                  <th className="text-right py-2">Rate</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{rental.name}</td>
                    <td className="py-2">{rental.size || "-"}</td>
                    <td className="text-right py-2">{rental.days}</td>
                    <td className="text-right py-2">${rental.dailyRate.toFixed(2)}</td>
                    <td className="text-right py-2">${rental.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 text-sm">
            <h3 className="font-bold mb-2">Terms and Conditions</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Equipment must be returned by the due date in the same condition.</li>
              <li>Customer is responsible for any damage or loss of equipment.</li>
              <li>Late returns will incur additional daily charges.</li>
              <li>Equipment should not be used beyond certified limits.</li>
              <li>Customer has inspected equipment and confirms it is in good working condition.</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8">
            <div>
              <p className="mb-8">Customer Signature: _______________________</p>
              <p>Date: _______________________</p>
            </div>
            <div>
              <p className="mb-8">Staff Signature: _______________________</p>
              <p>Date: _______________________</p>
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div className="space-y-4">
          <button
            onClick={handlePrint}
            className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
          >
            Print Agreement
          </button>

          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={agreementSigned}
                onChange={(e) => setAgreementSigned(e.target.checked)}
                className="w-5 h-5"
              />
              <span>Customer has signed the rental agreement</span>
            </label>

            <div>
              <label className="block text-sm font-medium mb-1">Staff Name</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(staffName)}
            disabled={!agreementSigned || !staffName.trim()}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// Customer Search Modal
interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: { id: string; firstName: string; lastName: string; email: string; phone?: string | null }) => void;
  onCreateNew: () => void;
  searchResults: Array<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }>;
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export function CustomerSearchModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  searchResults,
  onSearch,
  isSearching,
}: CustomerSearchModalProps) {
  const [query, setQuery] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      onSearch(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Select Customer</h2>

        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
          autoFocus
        />

        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {isSearching ? (
            <p className="text-center text-gray-500 py-4">Searching...</p>
          ) : searchResults.length > 0 ? (
            searchResults.map(customer => (
              <button
                key={customer.id}
                onClick={() => onSelect(customer)}
                className="w-full p-3 text-left border rounded-lg hover:border-blue-400 hover:bg-blue-50"
              >
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <p className="text-sm text-gray-600">{customer.email}</p>
                {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
              </button>
            ))
          ) : query.length >= 2 ? (
            <p className="text-center text-gray-500 py-4">No customers found</p>
          ) : (
            <p className="text-center text-gray-500 py-4">Type to search...</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            New Customer
          </button>
        </div>
      </div>
    </div>
  );
}
