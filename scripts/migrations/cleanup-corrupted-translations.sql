-- Migration: Clean up stale corrupted translations
-- Defects: DS-vlcg (HTML tags in translated trip names), DS-u6vq (source text contamination)
--
-- Background: Translations generated before the Bedrock post-processing fixes
-- (stripHtmlTags + removeSourceContamination) were added may contain:
--   1. HTML tags (e.g. "<p>Snorkel Safari</p>") in the translated value
--   2. The original English appended/prepended to the translation
--      (e.g. "Descubre el Buceo Discovery Scuba Diving")
--
-- Deleting these rows causes the translation background worker to regenerate
-- them cleanly on next request using the corrected post-processing pipeline.

-- 1. Delete translations where the value contains any HTML tag
DELETE FROM content_translations
WHERE value ~ '<[^>]+(>|$)';

-- 2. Delete translations where the value is identical to the source language
--    value stored in the parent entity. These are untranslated pass-throughs
--    that will be retried by the worker.
--    (No generic SQL for this — handled per-entity by the application cleanup function.)
