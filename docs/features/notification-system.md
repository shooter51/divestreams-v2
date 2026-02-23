# Toast Notification System - Implementation Guide

**Issue**: KAN-621 - Notification Implementation
**Date**: 2026-01-27
**Status**: ✅ Implemented

---

## Overview

A comprehensive toast notification system has been implemented to show success, error, warning, and info messages when CRUD operations are performed. This provides consistent user feedback across the entire application.

---

## Components Created

### 1. Toast Component (`app/components/ui/Toast.tsx`)

Visual notification component with:
- ✅ Auto-dismiss after 5 seconds (configurable)
- ✅ Manual dismiss button
- ✅ Four types: success, error, warning, info
- ✅ Smooth animations (slide in/out)
- ✅ Accessible (ARIA attributes)
- ✅ Responsive design
- ✅ Multiple toasts stacked vertically

### 2. Toast Context (`app/lib/toast-context.tsx`)

React context provider for managing toast state:
```typescript
const { showToast, dismissToast } = useToast();

// Usage
showToast("Tour created successfully", "success");
showToast("Failed to delete tour", "error");
showToast("Please review the changes", "warning");
showToast("5 new bookings today", "info");
```

### 3. Notification Hook (`app/lib/use-notification.tsx`)

Hook to automatically show toasts from URL search params:
```typescript
// In any route component
import { useNotification } from "../../../../lib/use-notification";

export default function MyPage() {
  useNotification(); // Automatically shows toasts from URL params
  // ...
}
```

**Helper functions**:
```typescript
// Create redirect URL with notification
redirectWithNotification("/tenant/tours", "Tour created", "success");
// Returns: "/tenant/tours?success=Tour+created"

// Direct Response redirect
redirectResponse("/tenant/tours", "Tour deleted", "success");
```

---

## Integration Steps

### Step 1: Wrap Layout with ToastProvider

✅ **Already Done** - `app/routes/tenant/layout.tsx` is wrapped with `<ToastProvider>`

### Step 2: Update Action Handlers

For any route with CRUD operations, update the action handler:

**Before:**
```typescript
export async function action({ request }: ActionFunctionArgs) {
  // ... validation ...
  await createTour(organizationId, data);
  return redirect("/tenant/tours");
}
```

**After:**
```typescript
import { redirectWithNotification } from "../../../../lib/use-notification";

export async function action({ request }: ActionFunctionArgs) {
  // ... validation ...
  await createTour(organizationId, data);
  return redirect(
    redirectWithNotification(
      "/tenant/tours",
      "Tour has been successfully created",
      "success"
    )
  );
}
```

### Step 3: Add Hook to Route Components

Add `useNotification()` to the component where redirects land:

```typescript
import { useNotification } from "../../../../lib/use-notification";

export default function ToursPage() {
  useNotification(); // Shows toasts from URL params
  // ... rest of component
}
```

---

## Message Patterns

Use consistent, user-friendly messages:

### Create Operations
```typescript
redirectWithNotification(
  "/tenant/tours",
  `Tour "${tourName}" has been successfully created`,
  "success"
);
```

### Update Operations
```typescript
redirectWithNotification(
  `/tenant/tours/${tourId}`,
  `Tour "${tourName}" has been successfully updated`,
  "success"
);
```

### Delete Operations
```typescript
redirectWithNotification(
  "/tenant/tours",
  `${entityName} has been successfully deleted`,
  "success"
);
```

### Error Operations
```typescript
// For action errors that don't redirect
return {
  error: "Cannot delete tour: 3 trips are using this tour",
  // ... other data
};

// In component, show with toast
const actionData = useActionData<typeof action>();
const { showToast } = useToast();

useEffect(() => {
  if (actionData?.error) {
    showToast(actionData.error, "error");
  }
}, [actionData]);
```

---

## Routes Updated (Examples)

### Tours
✅ `/tenant/tours/new` - Create notification
✅ `/tenant/tours/$id/edit` - Update notification
✅ `/tenant/tours/$id` - Delete notification
✅ `/tenant/tours` - Display notifications

### Pattern to Apply to All Entities

The same pattern should be applied to:
- [ ] Boats (`/tenant/boats/*`)
- [ ] Equipment (`/tenant/equipment/*`)
- [ ] Dive Sites (`/tenant/dive-sites/*`)
- [ ] Courses (`/tenant/training/courses/*`)
- [ ] Trips (`/tenant/trips/*`)
- [ ] Bookings (`/tenant/bookings/*`)
- [ ] Customers (`/tenant/customers/*`)
- [ ] Products (`/tenant/products/*`)
- [ ] Discounts (`/tenant/discounts/*`)
- [ ] Training Sessions (`/tenant/training/sessions/*`)
- [ ] Training Enrollments (`/tenant/training/enrollments/*`)

---

## Quick Reference

### Import Statements
```typescript
// In action handlers (server-side)
import { redirectWithNotification } from "../../../../lib/use-notification";

// In components (client-side)
import { useNotification } from "../../../../lib/use-notification";
import { useToast } from "../../../../lib/toast-context";
```

### Action Handler Pattern
```typescript
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    await createEntity(data);
    return redirect(
      redirectWithNotification(
        "/tenant/entities",
        `${name} has been successfully created`,
        "success"
      )
    );
  }

  if (intent === "update") {
    const name = formData.get("name") as string;
    await updateEntity(id, data);
    return redirect(
      redirectWithNotification(
        `/tenant/entities/${id}`,
        `${name} has been successfully updated`,
        "success"
      )
    );
  }

  if (intent === "delete") {
    const entity = await getEntity(id);
    await deleteEntity(id);
    return redirect(
      redirectWithNotification(
        "/tenant/entities",
        `${entity.name} has been successfully deleted`,
        "success"
      )
    );
  }
}
```

### Component Pattern
```typescript
export default function EntityPage() {
  // Add this hook to show notifications
  useNotification();

  // ... rest of component
}
```

---

## Testing

To test notifications:

1. **Create Operation**:
   - Go to `/tenant/tours/new`
   - Fill out form and submit
   - Should redirect to `/tenant/tours` with success toast

2. **Update Operation**:
   - Go to `/tenant/tours/{id}/edit`
   - Change tour name and submit
   - Should redirect to `/tenant/tours/{id}` with success toast

3. **Delete Operation**:
   - Go to `/tenant/tours/{id}`
   - Click delete and confirm
   - Should redirect to `/tenant/tours` with success toast

4. **Error Handling**:
   - Try to delete a tour with trips
   - Should show error toast with helpful message

---

## Styling

Toasts use Tailwind CSS classes with design system tokens:
- `bg-success-muted`, `border-success`, `text-success` - Success messages
- `bg-danger-muted`, `border-danger`, `text-danger` - Error messages
- `bg-warning-muted`, `border-warning`, `text-warning` - Warning messages
- `bg-brand-muted`, `border-brand`, `text-brand` - Info messages

Position: Fixed top-right corner (`top-4 right-4`)

---

## Accessibility

- ✅ `role="alert"` on toast container
- ✅ `aria-live="polite"` for screen readers
- ✅ `aria-atomic="true"` for complete message reading
- ✅ `aria-label` on dismiss button
- ✅ Keyboard accessible (Tab to dismiss button, Enter to dismiss)

---

## Performance

- Toasts auto-dismiss after 5 seconds (configurable per toast)
- Smooth CSS transitions (300ms)
- React context prevents unnecessary re-renders
- URL params cleaned up immediately after showing toast

---

## Future Enhancements

Possible improvements:
- [ ] Toast queue (limit max simultaneous toasts)
- [ ] Toast persistence across page refreshes
- [ ] Custom toast icons
- [ ] Sound notifications (optional)
- [ ] Toast history panel
- [ ] Undo functionality for delete operations

---

## Troubleshooting

**Toast doesn't appear:**
- ✅ Check ToastProvider is wrapping the layout
- ✅ Verify useNotification() is called in the destination component
- ✅ Check URL contains search param (?success=Message)

**Toast appears but disappears immediately:**
- ✅ Check if setSearchParams is being called elsewhere
- ✅ Verify duration prop is not set too low

**Multiple toasts stacking incorrectly:**
- ✅ Check z-index (should be z-50)
- ✅ Verify fixed positioning is not conflicting with other elements

---

## Summary

The notification system is now fully functional for Tours. The pattern is documented above and should be applied to all other CRUD routes in the application.

**Key Files**:
- `app/components/ui/Toast.tsx` - Toast component
- `app/lib/toast-context.tsx` - Context provider
- `app/lib/use-notification.tsx` - Hook and helpers
- `app/routes/tenant/layout.tsx` - Provider integration

**Status**: ✅ Tours implementation complete, ready to apply to remaining routes.
