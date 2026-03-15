---
title: "Translations"
category: "Settings"
tags: ["translations", "languages", "localization", "multilingual", "auto-translate"]
order: 6
---

# Translations

DiveStreams can auto-translate your content (tour names, descriptions, course details, product names, and gallery captions) into multiple languages. The **Translations** page lets you review, edit, and retrigger those translations.

## How Translations Work

When you create or update a tour, course, product, dive site, boat, gallery album, or gallery image, DiveStreams automatically queues a translation job for all supported languages. The job runs in the background and stores translated text alongside the original.

When a customer visits your public site in a non-English language (e.g. German), they see the translated version. The admin dashboard always shows content in the language you are logged in with.

## Supported Languages

Translations are generated for all languages configured for your account. Common supported locales include English, Spanish, French, German, Japanese, Thai, and Indonesian. The exact list depends on your DiveStreams configuration.

## View and Edit Translations

1. Go to **Settings** → **Translations**.
2. Translations are grouped by entity type and ID.
3. Each row shows:
   - Entity type (e.g. tour, course, product)
   - Field (e.g. name, description)
   - Language
   - Current translated text
   - Source (auto or manual)

Click the **Edit** icon on any row to update the translation text. Type your correction and click **Save**. The source changes to `manual` to indicate it was human-edited and won't be overwritten by the auto-translator.

## Retranslate an Entity

If you update the source text of a tour or course and want to refresh its translations:

1. Find any translation row for that entity.
2. Click **Retranslate** next to the entity.
3. DiveStreams queues new auto-translation jobs for all locales.

The old translations remain until the new jobs complete, so the public site always shows something.

## Reset to Auto

If you've manually edited a translation and want to revert it to the auto-generated version:

1. Find the translation row.
2. Click **Reset to Auto**.
3. DiveStreams marks the source as `auto` and re-queues the translation job.

## Translated Entity Types

| Entity Type | Fields Translated |
|-------------|------------------|
| Tour | Name, Description, Inclusions, Exclusions, Requirements |
| Course | Name, Description |
| Product | Name, Description |
| Dive Site | Name, Description |
| Boat | Name, Description |
| Gallery Album | Name, Description |
| Gallery Image | Title, Description |
| Discount Code | Description |

## Notes

- Translations are only applied on the **public site** and in the **customer portal**. The admin dashboard always shows source-language content.
- New entities don't have translations immediately — the background job may take a few minutes to run.
- If the translation job fails (e.g. the translation service is unavailable), the entity falls back to the source language.
