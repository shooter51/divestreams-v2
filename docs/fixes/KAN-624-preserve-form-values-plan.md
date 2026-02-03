# KAN-624: Preserve Form Values on Validation Error

## Problem
When validation errors occur in the enrollment form, all fields get cleared instead of preserving the user's input.

**Current Behavior:**
- ✅ Validation errors display correctly
- ❌ Student dropdown resets to empty
- ❌ Payment status resets to "pending"
- ❌ Amount paid field clears when error occurs

**Root Cause (Line-by-Line Analysis):**

1. **Student Dropdown (line 190-202):**
   ```tsx
   <select id="customerId" name="customerId" required>
     <option value="">Select a student...</option>
     {/* No defaultValue to preserve selection */}
   ```
   Missing `defaultValue` - doesn't preserve submitted value on error.

2. **Payment Status Dropdown (line 212-221):**
   ```tsx
   <select id="paymentStatus" name="paymentStatus" defaultValue="pending">
   ```
   Always defaults to "pending" - doesn't preserve submitted value on error.

3. **Amount Paid Field (line 234 - THE BUG):**
   ```tsx
   defaultValue={actionData?.errors?.amountPaid ? "" : "0"}
   ```
   **This is the worst offender!** Explicitly clears the field when there's an error.

4. **Session Dropdown (line 160-173) - only shown in select-session mode:**
   ```tsx
   <select id="sessionId" name="sessionId" required>
   ```
   Missing `defaultValue` - doesn't preserve submitted value on error.

---

## Solution

### Step 1: Modify `action()` to Return Form Values

**File:** `app/routes/tenant/training/enrollments/new.tsx`

**Change the error return (line 77-79) from:**
```tsx
if (Object.keys(errors).length > 0) {
  return { errors };
}
```

**To:**
```tsx
if (Object.keys(errors).length > 0) {
  return {
    errors,
    values: {
      sessionId,
      customerId,
      paymentStatus,
      amountPaid,
    }
  };
}
```

### Step 2: Update Form Fields to Use Preserved Values

**Session Dropdown (line 160):**
```tsx
<select
  id="sessionId"
  name="sessionId"
  defaultValue={actionData?.values?.sessionId || ""}
  className="..."
  required
>
```

**Student Dropdown (line 190):**
```tsx
<select
  id="customerId"
  name="customerId"
  defaultValue={actionData?.values?.customerId || ""}
  className="..."
  required
>
```

**Payment Status Dropdown (line 212):**
```tsx
<select
  id="paymentStatus"
  name="paymentStatus"
  defaultValue={actionData?.values?.paymentStatus || "pending"}
  className="..."
>
```

**Amount Paid Input (line 228-236):**
```tsx
<input
  type="number"
  id="amountPaid"
  name="amountPaid"
  step="0.01"
  min="0"
  defaultValue={actionData?.values?.amountPaid || "0"}
  className="..."
/>
```

---

## Implementation Steps

### 1. Update Action Function
```tsx
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const sessionId = formData.get("sessionId") as string;
  const customerId = formData.get("customerId") as string;
  const paymentStatus = (formData.get("paymentStatus") as string) || "pending";
  const amountPaid = formData.get("amountPaid") as string;

  const errors: Record<string, string> = {};
  if (!sessionId) errors.sessionId = "Session is required";
  if (!customerId) errors.customerId = "Customer is required";

  // Validate amount paid
  if (amountPaid) {
    const amount = parseFloat(amountPaid);
    if (isNaN(amount)) {
      errors.amountPaid = "Amount must be a valid number";
    } else if (amount < 0) {
      errors.amountPaid = "Amount cannot be negative";
    } else if (amount > 0 && amount < 1) {
      errors.amountPaid = "Amount paid must be at least $1 (or $0 for free enrollment)";
    }
  }

  // 🔥 KEY CHANGE: Return values along with errors
  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: {
        sessionId,
        customerId,
        paymentStatus,
        amountPaid,
      }
    };
  }

  // ... rest of action (create enrollment)
}
```

### 2. Update Component Form Fields

**In the component (line 160-240), update all form inputs:**

```tsx
{/* Session Selector */}
{mode === "select-session" && sessions && (
  <div>
    <label htmlFor="sessionId" className="block text-sm font-medium mb-1">
      Training Session *
    </label>
    <select
      id="sessionId"
      name="sessionId"
      defaultValue={actionData?.values?.sessionId || ""}
      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
      required
    >
      <option value="">Select a session...</option>
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.courseName} - {new Date(s.startDate).toLocaleDateString()}
          {s.startTime ? ` at ${s.startTime}` : ""}
          {" "}({s.enrolledCount || 0}/{s.maxStudents || "∞"} enrolled)
        </option>
      ))}
    </select>
    {actionData?.errors?.sessionId && (
      <p className="text-danger text-sm mt-1">{actionData.errors.sessionId}</p>
    )}
  </div>
)}

{/* Student Selector */}
<div>
  <label htmlFor="customerId" className="block text-sm font-medium mb-1">
    Student *
  </label>
  <select
    id="customerId"
    name="customerId"
    defaultValue={actionData?.values?.customerId || ""}
    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
    required
  >
    <option value="">Select a student...</option>
    {customers.map((customer) => (
      <option key={customer.id} value={customer.id}>
        {customer.firstName} {customer.lastName} ({customer.email})
      </option>
    ))}
  </select>
  {actionData?.errors?.customerId && (
    <p className="text-danger text-sm mt-1">{actionData.errors.customerId}</p>
  )}
</div>

{/* Payment Status */}
<div>
  <label htmlFor="paymentStatus" className="block text-sm font-medium mb-1">
    Payment Status
  </label>
  <select
    id="paymentStatus"
    name="paymentStatus"
    defaultValue={actionData?.values?.paymentStatus || "pending"}
    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
  >
    <option value="pending">Pending</option>
    <option value="partial">Partial</option>
    <option value="paid">Paid</option>
  </select>
</div>

{/* Amount Paid */}
<div>
  <label htmlFor="amountPaid" className="block text-sm font-medium mb-1">
    Amount Paid
  </label>
  <input
    type="number"
    id="amountPaid"
    name="amountPaid"
    step="0.01"
    min="0"
    defaultValue={actionData?.values?.amountPaid || "0"}
    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
  />
  {actionData?.errors?.amountPaid && (
    <p className="text-danger text-sm mt-1">{actionData.errors.amountPaid}</p>
  )}
</div>
```

---

## Testing Checklist

### Test Case 1: Invalid Amount (0.50)
1. ✅ Select student: "John Doe"
2. ✅ Select payment status: "Paid"
3. ✅ Enter amount: "0.50"
4. ✅ Submit
5. ✅ **Expected:** Error displays, all fields retain values
   - Student still shows "John Doe"
   - Payment status still shows "Paid"
   - Amount still shows "0.50"

### Test Case 2: Missing Student
1. ✅ Leave student empty
2. ✅ Select payment status: "Partial"
3. ✅ Enter amount: "100"
4. ✅ Submit
5. ✅ **Expected:** Error displays, payment status and amount retained
   - Payment status still shows "Partial"
   - Amount still shows "100"

### Test Case 3: Multiple Errors
1. ✅ Leave student empty
2. ✅ Select payment status: "Paid"
3. ✅ Enter invalid amount: "0.25"
4. ✅ Submit
5. ✅ **Expected:** Both errors display, payment status and amount retained

### Test Case 4: Session Selection Mode (without pre-selected session)
1. ✅ Navigate to /tenant/training/enrollments/new (no sessionId param)
2. ✅ Select session: "Open Water - 2/15/2026"
3. ✅ Select student: "Jane Smith"
4. ✅ Enter invalid amount: "0.75"
5. ✅ Submit
6. ✅ **Expected:** All fields retained including session selection

---

## Edge Cases

### Case 1: Form Success
When form submits successfully, user is redirected, so no need to preserve values.

### Case 2: Database Errors
Lines 95-114 handle database errors (already enrolled, session full, etc.). These should also return values:

```tsx
if (errorMessage.includes("already enrolled")) {
  return {
    errors: { form: "This customer is already enrolled in this session" },
    values: { sessionId, customerId, paymentStatus, amountPaid }
  };
}
// ... repeat for all error cases
```

---

## Files to Change

1. **app/routes/tenant/training/enrollments/new.tsx** (ONLY file to modify)
   - Lines 77-79: Add values to error return
   - Lines 95-114: Add values to all error returns
   - Line 160: Add defaultValue to session dropdown
   - Line 190: Add defaultValue to student dropdown
   - Line 212: Update defaultValue to use actionData.values
   - Line 234: Fix broken logic to use actionData.values

---

## Estimated Effort

**Time:** 15-20 minutes

**Complexity:** Low - straightforward pattern application

**Risk:** Very low - only affects error handling, doesn't change success path

---

## Similar Issues to Check

After fixing this issue, search for similar patterns in other forms:

```bash
grep -r "defaultValue={actionData?.errors" app/routes/
```

This pattern `defaultValue={actionData?.errors?.X ? "" : "default"}` is an anti-pattern that clears fields on error.

**Other forms to audit:**
- Customer creation form
- Trip booking form
- Course enrollment form (embed)
- Product creation form
- Any other forms with validation

---

## Related Tickets

- Consider creating follow-up ticket: "Audit all forms for value preservation on validation errors"
- Pattern should be standardized across all forms in the app
