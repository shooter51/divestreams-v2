---
title: "Create a Course"
category: "Training"
tags: ["course", "training", "certification", "PADI", "SSI", "create"]
order: 1
---

# Create a Course

The **Training** module manages dive certification courses, their sessions, and student enrollments. A **Course** is the template that defines a training program — similar to how a Tour is the template for dive trips.

## Before You Start

Ensure your certification agencies are set up. Go to **Settings** → seed training agencies, or add them manually from the Training section. PADI, SSI, and NAUI can be seeded automatically from the Settings page.

## Steps

1. Go to **Training** in the sidebar.
2. Click **Courses** in the training sub-navigation.
3. Click **Create Course** in the top right.

### Basic Info

| Field | Required | Notes |
|-------|----------|-------|
| Course Name | Yes | e.g. "PADI Open Water Diver", "PADI Advanced Open Water" |
| Course Code | No | e.g. "OWD", "AOW" — your internal reference |
| Description | No | Public-facing course overview |
| Certification Agency | No | Select from your configured agencies (PADI, SSI, NAUI, etc.) |
| Certification Level | No | Select from levels associated with the chosen agency |

### Duration & Structure

| Field | Notes |
|-------|-------|
| Duration (days) | How many days the course takes; default 3 |
| Classroom Hours | Hours of theory/e-learning |
| Pool Hours | Hours of confined water practice |
| Open Water Dives | Number of open water dives required |

### Pricing & Capacity

| Field | Required | Notes |
|-------|----------|-------|
| Price | Yes | Can be $0.00 for free/promotional courses |
| Currency | No | USD, EUR, GBP, AUD, THB, IDR, MXN |
| Max Students per Session | No | Default 4 |
| Minimum Age | No | Enter a number; leave blank for no restriction |

### Prerequisites

Enter any prerequisites in free text (e.g. "Must be at least 10 years old, able to swim 200m continuously").

### Status

- **Active** — the course can be scheduled into sessions. Inactive courses cannot be enrolled into.
- **Public** — check to show this course on your public site so customers can learn about it or request enrollment.

## Save

Click **Create Course**. You are redirected to the courses list with a success message.

## Next Steps

After creating a course:
1. **Schedule a Session** — go to **Training** → **Sessions** → **New Session** and choose this course. See [Training Sessions](./training-sessions.md).
2. **Enrol students** — add students to a session. See [Enrollments](./enrollments.md).
