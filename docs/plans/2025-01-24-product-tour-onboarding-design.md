# Product Tour & Onboarding System Design

**Date:** 2025-01-24
**Status:** Approved
**Author:** Claude + Tom Gibson

## Overview

A hybrid onboarding system for new dive shops that combines a persistent setup checklist with contextual interactive walkthroughs. When users click a checklist item, a guided tour walks them through completing that specific task.

## Goals

1. Help new dive shops complete essential setup tasks
2. Reduce time-to-value by guiding users through key features
3. Provide always-accessible help without being intrusive
4. Track onboarding progress per organization

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Tenant Layout                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 OnboardingProvider                   │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │    │
│  │  │ Floating     │  │ Slide-out    │  │ Joyride   │  │    │
│  │  │ Button       │──│ Sidebar      │──│ Tour      │  │    │
│  │  │ (progress)   │  │ (checklist)  │  │ (overlay) │  │    │
│  │  └──────────────┘  └──────────────┘  └───────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ onboarding_      │
                    │ progress table   │
                    └──────────────────┘
```

### Data Flow

1. User clicks floating button → Sidebar opens
2. User clicks checklist item → Sidebar closes → Joyride tour starts
3. User completes task (saves form) → Task marked complete via API
4. Tour ends → Sidebar reopens showing updated progress
5. All tasks complete OR user dismisses → Floating button hidden

## Database Schema

### `onboarding_progress` Table

```sql
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  tasks JSONB NOT NULL DEFAULT '{}',
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

CREATE INDEX onboarding_progress_org_idx ON onboarding_progress(organization_id);
```

### Tasks JSONB Structure

```json
{
  "complete_profile": true,
  "connect_stripe": false,
  "add_dive_site": true,
  "create_tour": true,
  "configure_booking": false,
  "schedule_trip": false,
  "add_agency": false,
  "create_course": false,
  "setup_course_pricing": false,
  "add_equipment": false,
  "configure_rental_pricing": false,
  "add_product_category": false,
  "add_product": false,
  "setup_tax_rates": false,
  "invite_team_member": false,
  "choose_theme_colors": false,
  "upload_logo": false,
  "add_hero_image": false,
  "write_about_content": false,
  "add_contact_info": false,
  "add_google_maps": false,
  "configure_booking_widget": false
}
```

## Checklist Structure

22 tasks organized into 7 sections:

### Getting Started
| ID | Task | Description |
|----|------|-------------|
| `complete_profile` | Complete shop profile | Business name, timezone, contact info |
| `connect_stripe` | Connect Stripe | Enable payment processing |

### Tours & Booking
| ID | Task | Description |
|----|------|-------------|
| `add_dive_site` | Add your first dive site | Create a dive location |
| `create_tour` | Create your first tour | Set up a bookable tour |
| `configure_booking` | Configure booking settings | Deposits, cancellation policy |
| `schedule_trip` | Schedule your first trip | Create a scheduled instance |

### Training
| ID | Task | Description |
|----|------|-------------|
| `add_agency` | Add a certification agency | PADI, SSI, NAUI, etc. |
| `create_course` | Create your first course | Set up a training course |
| `setup_course_pricing` | Set up course pricing | Price and prerequisites |

### Equipment
| ID | Task | Description |
|----|------|-------------|
| `add_equipment` | Add your first equipment item | BCDs, regulators, etc. |
| `configure_rental_pricing` | Configure rental pricing | Daily/hourly rates |

### POS
| ID | Task | Description |
|----|------|-------------|
| `add_product_category` | Add a product category | Organize your inventory |
| `add_product` | Add your first product | Retail items for sale |
| `setup_tax_rates` | Set up tax rates | Configure sales tax |

### Team
| ID | Task | Description |
|----|------|-------------|
| `invite_team_member` | Invite a team member | Add staff with permissions |

### Public Site
| ID | Task | Description |
|----|------|-------------|
| `choose_theme_colors` | Choose theme colors | Primary, accent, text colors |
| `upload_logo` | Upload your logo | Brand identity |
| `add_hero_image` | Add hero image/video | Homepage banner |
| `write_about_content` | Write About page content | Your story |
| `add_contact_info` | Add contact information | Address, phone, email, hours |
| `add_google_maps` | Add Google Maps embed | *(optional)* |
| `configure_booking_widget` | Configure booking widget | Widget settings |

## UI Components

### Floating Button (`OnboardingButton`)

- **Position:** Fixed bottom-right corner (24px from edges)
- **Size:** 56px circular button
- **Visual:** Progress ring around edge showing completion percentage
- **Icon:** Rocket or checklist icon
- **Badge:** "X of 22" count
- **Animation:** Gentle pulse on first visit
- **Action:** Opens sidebar on click

### Slide-out Sidebar (`OnboardingSidebar`)

- **Width:** 380px
- **Position:** Slides in from right edge
- **Header:**
  - Title: "Getting Started"
  - Progress bar (X% complete)
  - Close button (X)
- **Body:**
  - Scrollable sections (collapsible)
  - Each task: checkbox + title + "Start" button
  - Completed: green checkmark, grayed text
  - Incomplete: prominent, actionable
- **Footer:**
  - "Dismiss setup guide" link
  - Triggers confirmation modal

### Tour Overlay (`OnboardingTour`)

- **Library:** React Joyride
- **Overlay:** Semi-transparent dark (#000 at 50% opacity)
- **Spotlight:** Cutout around target element with padding
- **Tooltip:**
  - White card with subtle shadow
  - Title (bold), description, step indicator
  - Buttons: Back, Next, Skip
  - Styled to match DiveStreams theme (blue primary)
- **Beacon:** Disabled (tours only start from checklist)

## Tour Steps Examples

### "Create your first tour" (5 steps)

```typescript
{
  taskId: 'create_tour',
  steps: [
    {
      target: '[data-tour="nav-tours"]',
      title: 'Tours Menu',
      content: 'Click here to manage your dive tours and packages.',
      placement: 'right'
    },
    {
      target: '[data-tour="add-tour-btn"]',
      title: 'Create a Tour',
      content: 'Click this button to create your first tour package.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="tour-name"]',
      title: 'Tour Details',
      content: 'Give your tour a name and describe what makes it special.',
      placement: 'right'
    },
    {
      target: '[data-tour="tour-pricing"]',
      title: 'Pricing & Inclusions',
      content: 'Set your price and what\'s included - equipment, meals, transport.',
      placement: 'top'
    },
    {
      target: '[data-tour="tour-save"]',
      title: 'Save Your Tour',
      content: 'Click save to create your tour. You can edit it anytime.',
      placement: 'top'
    }
  ]
}
```

### "Connect Stripe" (3 steps)

```typescript
{
  taskId: 'connect_stripe',
  steps: [
    {
      target: '[data-tour="nav-settings"]',
      title: 'Settings',
      content: 'Your payment settings are in the Settings menu.',
      placement: 'right'
    },
    {
      target: '[data-tour="integrations-tab"]',
      title: 'Integrations',
      content: 'Manage all your connected services here.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="stripe-connect"]',
      title: 'Connect Stripe',
      content: 'Click to securely connect your Stripe account for payments.',
      placement: 'left'
    }
  ]
}
```

## API Routes

### `GET /tenant/api/onboarding`

Returns current onboarding progress for the organization.

**Response:**
```json
{
  "tasks": { "create_tour": true, "connect_stripe": false, ... },
  "completedCount": 5,
  "totalCount": 22,
  "dismissed": false,
  "completed": false
}
```

### `POST /tenant/api/onboarding/complete`

Marks a task as complete.

**Request:**
```json
{ "taskId": "create_tour" }
```

**Response:**
```json
{ "success": true, "completedCount": 6, "allComplete": false }
```

### `POST /tenant/api/onboarding/dismiss`

User dismisses the onboarding guide.

**Response:**
```json
{ "success": true, "dismissedAt": "2025-01-24T12:00:00Z" }
```

### `POST /tenant/api/onboarding/reset`

Resets onboarding progress (admin/debug use).

**Response:**
```json
{ "success": true }
```

## Auto-Completion Hooks

Some tasks complete automatically when users take actions elsewhere:

| Task | Trigger |
|------|---------|
| `create_tour` | Tour saved successfully |
| `add_dive_site` | Dive site created |
| `connect_stripe` | Stripe webhook confirms connection |
| `invite_team_member` | Invitation sent |
| `add_equipment` | Equipment item created |
| `add_product` | Product created |
| `create_course` | Course saved |
| `upload_logo` | Logo URL saved in settings |
| etc. | Form submission in relevant area |

Implementation: Call `markTaskComplete(taskId)` from existing form action functions.

## Edge Cases

### First Visit Detection
- Row created in `onboarding_progress` on first authenticated visit
- Existing organizations (pre-feature) get row on next login
- If `completed_at` or `dismissed_at` is set, hide floating button

### Tour Interruption
- Browser closed mid-tour: Tour state not persisted, restarts on next click
- User navigates away: Tour ends gracefully, task remains incomplete
- User clicks different checklist item: Current tour ends, new one starts

### Soft Dependencies
- No hard blocks on task order
- "Getting Started" section expanded by default
- Smart guidance: "Schedule a trip" without tours redirects to create tour first

### Dismissed State
- Confirmation modal required: "Are you sure? Find this later in Settings → Help"
- Data preserved, only UI hidden
- Re-enable option in Settings page

### Mobile Responsive
- Floating button: Smaller (48px), stays visible
- Sidebar: Full-screen drawer
- Joyride: Repositions automatically (mobile-friendly)

## File Structure

```
lib/db/schema/onboarding.ts           # Database schema
lib/db/onboarding.server.ts           # Server functions

app/routes/tenant/api/onboarding.tsx  # API routes

app/components/onboarding/
├── OnboardingProvider.tsx            # React context + state
├── OnboardingButton.tsx              # Floating progress button
├── OnboardingSidebar.tsx             # Slide-out checklist panel
├── OnboardingTour.tsx                # Joyride wrapper component
├── tour-steps/
│   ├── index.ts                      # Exports all steps
│   ├── getting-started.ts            # Profile, Stripe steps
│   ├── tours-booking.ts              # Tours, sites, booking steps
│   ├── training.ts                   # Courses, agencies steps
│   ├── equipment.ts                  # Equipment, rental steps
│   ├── pos.ts                        # Products, categories steps
│   ├── team.ts                       # Team invitation steps
│   └── public-site.ts                # Theme, content steps
└── index.ts                          # Component exports
```

## Implementation Order

1. **Database** - Schema + migration for `onboarding_progress`
2. **Server** - Server functions + API routes
3. **Context** - `OnboardingProvider` with state management
4. **UI Shell** - Floating button + sidebar (no tours yet)
5. **Joyride** - Integration + first tour (create_tour)
6. **All Tours** - Remaining 21 tour step definitions
7. **Auto-complete** - Hooks in existing form actions
8. **Settings** - Toggle to re-enable dismissed onboarding

## Dependencies

```json
{
  "react-joyride": "^2.8.0"
}
```

Size impact: ~40KB gzipped

## Success Metrics

- % of new orgs completing all tasks within 7 days
- Average time to first tour creation
- Onboarding dismissal rate
- Feature adoption rates (before/after)

## Future Enhancements

- Video tooltips for complex tasks
- Contextual help bubbles (outside onboarding)
- Achievement badges for milestones
- Personalized task ordering based on business type
