---
title: "Import Courses"
category: "Training"
tags: ["import", "courses", "PADI", "SSI", "NAUI", "CSV", "catalog"]
order: 4
---

# Import Courses

Instead of creating courses manually, you can import them from a DiveStreams global catalog or upload your own CSV file. This is the fastest way to populate your training catalog.

## Import from Global Catalog (Wizard)

The global catalog contains pre-built course templates for major agencies (PADI, SSI, NAUI, and others). These templates include the course description, duration, pool hours, open water dives, minimum age, and prerequisites.

### Step 1: Select Agency

1. Go to **Training** in the sidebar.
2. Click **Import Courses** in the training sub-navigation.
3. In the wizard, select a **Certification Agency** from the dropdown (e.g. PADI).
4. Click **Next: Select Courses**.

### Step 2: Choose Courses

A list of available courses for the selected agency appears. Each card shows:
- Course name and code
- Duration in days
- Number of open water dives
- Minimum age

- Check individual courses, or click **Select All** to check all.
- Click **Preview Import** when done.

### Step 3: Preview & Import

Review the list of courses you are about to import. Click **Import Courses** to confirm.

DiveStreams:
- Creates the agency in your account if it doesn't already exist.
- Adds each course to your catalog with a default price of $0.00.
- Sets the courses as Active and Public by default.

After import, you will see a success screen showing which courses were imported and any that were skipped (e.g. already in your catalog).

### Next Steps After Import

1. Go to **Training** → **Courses**.
2. Click each imported course.
3. Set the **Price** and **Currency** for your market.
4. Review other fields and adjust if needed.

## Import via CSV

You can also import courses from a CSV file. This is useful if you have a custom course list or want to bulk-load courses that are not in the global catalog.

### CSV Format

Download the template from the Import Courses page by clicking **Download Template**. The CSV has 12 columns:

```
agency_code,course_name,course_code,description,duration_days,classroom_hours,pool_hours,open_water_dives,min_age,prerequisites,price,currency
```

| Column | Required | Notes |
|--------|----------|-------|
| agency_code | Yes | e.g. "padi", "ssi", "naui" |
| course_name | Yes | e.g. "Open Water Diver" |
| course_code | No | e.g. "OWD" |
| description | No | Course overview |
| duration_days | No | Number |
| classroom_hours | No | Number |
| pool_hours | No | Number |
| open_water_dives | No | Number |
| min_age | No | Number |
| prerequisites | No | Free text |
| price | No | e.g. "299.00" |
| currency | No | e.g. "USD" |

### Upload the CSV

1. On the Import Courses page, click **Choose File** in the CSV section.
2. Select your `.csv` file.
3. Click **Upload CSV**.

DiveStreams processes each row and shows you the results. Rows that fail (e.g. duplicate courses, missing required fields) are listed with the reason for failure.

> **Note:** Courses imported via CSV are not publicly visible by default. Go to each course and check **Public** to list them on your public site.
