# Dive Training Module Design

## Overview

A dedicated training module for dive shops to manage certification courses, student enrollments, skill tracking, and certification issuance. Separate from the Tours/Trips system with its own focused experience.

## Target Users

- **Shop owners/managers** - Course oversight, revenue tracking, compliance
- **Instructors** - Daily session management, skill checkoffs, student progress

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Separate module (not extending Tours) | Training is core business, deserves dedicated UX |
| Agencies | Multi-agency support (PADI, SSI, NAUI, etc.) | Configurable per organization |
| Scheduling | Fixed + on-demand | Both models common in dive shops |
| On-demand coordination | Manual (v1), availability picker (future) | Start simple, enhance later |
| Payments | Through existing POS | Leverages Stripe integration |
| Prerequisites | Soft block with staff override | Practical for real-world situations |
| Completion requirements | Skills + exam + minimum dives | Industry standard for certification |
| Certification issuance | Track only (agency portal external) | No API integration needed |
| Freemium | Binary on/off | Training is premium feature |

## Data Model

### Tables

```sql
certification_agencies
├── id (uuid)
├── organization_id (text, FK)
├── name (text) -- PADI, SSI, NAUI
├── code (text) -- padi, ssi, naui
├── is_active (boolean)
├── created_at, updated_at

certification_levels
├── id (uuid)
├── organization_id (text, FK)
├── agency_id (uuid, FK)
├── name (text) -- Open Water, Advanced, Rescue
├── code (text) -- ow, aow, rescue
├── level (integer) -- numeric ordering
├── prerequisites (jsonb) -- array of level IDs
├── is_active (boolean)
├── created_at

training_courses
├── id (uuid)
├── organization_id (text, FK)
├── name (text)
├── description (text)
├── agency_id (uuid, FK)
├── level_id (uuid, FK)
├── schedule_type (text) -- fixed, on_demand
├── price (decimal)
├── deposit_amount (decimal)
├── max_students (integer)
├── min_instructors (integer)
├── total_sessions (integer)
├── has_exam (boolean)
├── exam_pass_score (integer)
├── min_open_water_dives (integer)
├── is_active (boolean)
├── created_at, updated_at

course_sessions
├── id (uuid)
├── organization_id (text, FK)
├── course_id (uuid, FK)
├── enrollment_id (uuid, FK, nullable) -- for on-demand, links to specific enrollment
├── session_type (text) -- classroom, pool, open_water
├── session_number (integer)
├── scheduled_date (date)
├── start_time (time)
├── end_time (time)
├── location (text)
├── dive_site_id (uuid, FK, nullable)
├── instructor_ids (jsonb) -- array of user IDs
├── status (text) -- scheduled, in_progress, completed, cancelled
├── max_students (integer)
├── notes (text)
├── created_at, updated_at

enrollments
├── id (uuid)
├── organization_id (text, FK)
├── course_id (uuid, FK)
├── customer_id (uuid, FK)
├── status (text) -- pending_scheduling, scheduled, enrolled, in_progress, completed, certified, withdrawn
├── enrolled_at (timestamp)
├── started_at (timestamp)
├── completed_at (timestamp)
├── deposit_amount (decimal)
├── deposit_paid_at (timestamp)
├── total_price (decimal)
├── balance_due (decimal)
├── payment_status (text) -- deposit_paid, paid_in_full
├── pos_transaction_ids (jsonb) -- array of transaction IDs
├── exam_score (integer)
├── exam_passed_at (timestamp)
├── certification_number (text)
├── certified_at (timestamp)
├── prerequisite_override (boolean)
├── prerequisite_override_by (text)
├── prerequisite_override_note (text)
├── instructor_notes (text)
├── created_at, updated_at

skill_checkoffs
├── id (uuid)
├── organization_id (text, FK)
├── enrollment_id (uuid, FK)
├── session_id (uuid, FK)
├── skill_name (text)
├── skill_category (text) -- basic, intermediate, advanced
├── status (text) -- not_attempted, attempted, demonstrated
├── instructor_id (text)
├── checked_off_at (timestamp)
├── notes (text)
├── created_at
```

### Relationships

- `certification_levels` → `certification_agencies` (many-to-one)
- `training_courses` → `certification_agencies`, `certification_levels` (many-to-one)
- `course_sessions` → `training_courses`, `dive_sites` (many-to-one)
- `enrollments` → `training_courses`, `customers` (many-to-one)
- `skill_checkoffs` → `enrollments`, `course_sessions` (many-to-one)

## Routes

```
/app/training/
├── index.tsx              → Dashboard
├── courses/
│   ├── index.tsx          → Course catalog
│   ├── new.tsx            → Create course
│   ├── $id.tsx            → Course detail
│   └── $id/edit.tsx       → Edit course
├── sessions/
│   ├── index.tsx          → Calendar view
│   └── $id.tsx            → Session detail (attendance, skills)
├── enrollments/
│   ├── index.tsx          → All enrollments
│   └── $id.tsx            → Student progress
└── settings/
    ├── agencies.tsx       → Manage agencies
    └── levels.tsx         → Manage cert levels
```

Sidebar addition:
```typescript
{ href: "/app/training", label: "Training", icon: "🎓" }
```

## Workflows

### 1. Create a Course

1. Training → Courses → New
2. Select agency and certification level
3. Set price, deposit, max students
4. Define structure: session types and count
5. Set requirements: exam pass score, minimum dives
6. Choose schedule type: fixed or on-demand
7. Save course template

### 2. Schedule Sessions (Fixed)

1. From course detail → "Schedule Sessions"
2. Add session dates, times, locations
3. Assign instructors
4. Sessions appear on training calendar

### 3. Enroll Student (In-Shop)

1. From customer profile or training dashboard → "Enroll Student"
2. Select course
3. System checks prerequisites:
   - If missing: warning with override option
   - Staff can add cert to profile or override
4. Redirected to POS with course in cart
5. Collect deposit or full payment
6. Enrollment created:
   - Fixed schedule: status "enrolled"
   - On-demand: status "pending_scheduling"

### 4. Enroll Student (Online)

1. Customer visits embed widget
2. Selects "Courses" tab
3. Chooses course, enters details
4. If prerequisites required: prompted to enter cert number
5. Pays deposit via Stripe
6. Enrollment created, confirmation email sent
7. Shop notified of new enrollment

### 5. Schedule On-Demand Course

1. Shop sees enrollment with status "pending_scheduling"
2. Contacts customer (phone/email) to coordinate dates
3. Adds sessions with agreed dates
4. Status changes to "scheduled"
5. Student notified of session dates

### 6. Run a Session

1. Instructor opens Training → Sessions → today's session
2. Views enrolled students
3. Marks attendance
4. For pool/open water: checks off skills per student
5. Marks session complete
6. Student progress auto-updates

### 7. Complete Course

1. Student completes all sessions
2. All required skills checked off
3. Exam taken, score recorded (must meet pass threshold)
4. Minimum dives completed
5. Status auto-changes to "completed"

### 8. Issue Certification

1. Instructor submits to agency portal (external)
2. Returns to DiveStreams
3. Enters certification number and date
4. Status changes to "certified"
5. Certification synced to customer profile

## Progress Calculation

```
progress = weighted average of:
  - Sessions attended / total sessions (30%)
  - Skills checked off / required skills (40%)
  - Exam passed (15%)
  - Dives completed / minimum dives (15%)
```

Dashboard displays: "John Smith - PADI Open Water - 65% complete"

## Prerequisite Handling

### In-Shop Enrollment

- System checks customer certifications against course prerequisites
- If missing: warning displayed
- Staff options:
  1. Add certification to customer profile
  2. Override with note
- Override recorded: who, when, why

### Online Enrollment

- Customer prompted to confirm they have prerequisites
- If no: message to contact shop
- Can still submit inquiry for follow-up

## POS Integration

- Courses appear as POS products (category: "training")
- Enrollment adds course to cart
- Supports deposits and full payment
- Balance collection for remaining amount
- Transaction IDs linked to enrollment

## Embed Widget Extension

Add "Courses" tab to existing `/embed/$tenant/book`:
- Lists active courses
- Shows price, deposit, schedule type
- Fixed: displays upcoming start dates
- On-demand: shows "Flexible scheduling"
- Prerequisite prompt during checkout

## Freemium

```typescript
FREE_TIER_LIMITS = {
  hasTraining: false,  // No access
}

PREMIUM_LIMITS = {
  hasTraining: true,   // Full access
}
```

Training module hidden for free tier users.

## Files to Create

```
lib/db/schema/training.ts           # 5 tables + relations
lib/db/training.server.ts           # Queries and mutations

app/routes/tenant/training/
├── index.tsx                       # Dashboard
├── courses/index.tsx               # Course list
├── courses/new.tsx                 # Create course
├── courses/$id.tsx                 # Course detail
├── courses/$id/edit.tsx            # Edit course
├── sessions/index.tsx              # Session calendar
├── sessions/$id.tsx                # Session detail
├── enrollments/index.tsx           # Enrollment list
├── enrollments/$id.tsx             # Student progress
├── settings/agencies.tsx           # Manage agencies
└── settings/levels.tsx             # Manage levels

app/components/training/
├── TrainingDashboard.tsx           # Stats and overview
├── CourseForm.tsx                  # Create/edit course
├── CourseCard.tsx                  # Course display
├── SessionCalendar.tsx             # Calendar view
├── SessionDetail.tsx               # Run a session
├── EnrollmentCard.tsx              # Enrollment display
├── ProgressTracker.tsx             # Visual progress
├── SkillCheckoffForm.tsx           # Check off skills
└── PrerequisiteWarning.tsx         # Prerequisite modal

app/routes/embed/$tenant/book.tsx   # Extend for courses
```

## Not in v1 (Future)

- Availability picker for on-demand scheduling
- Request flow (customer proposes dates)
- Dedicated public training page
- PDF certificate generation
- Dive logging with depth/time tracking
- Instructor performance reports
- Agency API integrations
- Email notifications for milestones
- Predefined skill lists per certification
