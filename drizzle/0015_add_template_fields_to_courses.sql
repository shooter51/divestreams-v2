-- Migration: Add template linking fields to training_courses
-- Links tenant courses to agency templates for smart merge functionality

ALTER TABLE training_courses
  ADD COLUMN template_id UUID REFERENCES agency_course_templates(id) ON DELETE SET NULL,
  ADD COLUMN template_hash TEXT;

CREATE INDEX idx_training_courses_template ON training_courses(template_id);
