---
title: "Enrollments"
category: "Training"
tags: ["enrollment", "student", "training", "payment", "enrol"]
order: 3
---

# Enrollments

An **Enrollment** registers a customer as a student in a training session. It tracks whether they've paid and how much.

## Enrol a Student

### From a Session Detail Page

1. Go to **Training** → **Sessions**.
2. Click the session to open its detail page.
3. Click **Enrol Student** or **New Enrollment**.
4. The session is pre-selected. Select the **Student** (customer) from the dropdown.
5. Set **Payment Status**: Pending, Partial, or Paid.
6. Enter **Amount Paid** — the amount received so far ($0 for unpaid, or the deposit/full amount).
7. Click **Create Enrollment**.

### From the Enrollments List

1. Go to **Training** → **Enrollments**.
2. Click **New Enrollment**.
3. Select the **Training Session** from the dropdown. Each session shows the course name, date, time, and current enrollment count.
4. Select the **Student**.
5. Set **Payment Status** and **Amount Paid**.
6. Click **Create Enrollment**.

## Payment Status

| Status | Use when |
|--------|---------|
| **Pending** | No payment received yet |
| **Partial** | A deposit or partial payment has been received |
| **Paid** | Full payment has been received |

## Validation Rules

- A student cannot be enrolled in the same session twice.
- You cannot enrol in a cancelled session.
- You cannot enrol when the session is already full (at max students).
- Amount paid must be $0 or at least $1 (amounts between $0.01 and $0.99 are not valid).

## Viewing Enrollments

Go to **Training** → **Enrollments** to see all enrollments across all sessions. You can filter by session or student.

On a session detail page, all enrollments for that session are listed with:
- Student name and email
- Payment status badge
- Amount paid
- Enrollment date

## Updating an Enrollment

Click an enrollment to open its detail page. From there you can update the payment status and amount paid as the student progresses through payment.

## Removing an Enrollment

To remove a student from a session, open the enrollment detail page and click **Cancel Enrollment** or **Remove**. The spot is freed up for another student.
