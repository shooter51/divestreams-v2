import { describe, it, expect } from 'vitest';
import {
  getAgencyTemplates,
  getAvailableAgencyCodes,
  getAllAgencyTemplates,
} from '../../../../lib/data/agency-templates';

describe('Agency Templates', () => {
  describe('getAgencyTemplates', () => {
    it('should return PADI templates when given padi code', () => {
      const result = getAgencyTemplates('padi');

      expect(result).not.toBeNull();
      expect(result?.agencyCode).toBe('padi');
      expect(result?.agencyName).toBe('PADI');
      expect(result?.courses.length).toBeGreaterThan(0);
    });

    it('should return SSI templates when given ssi code', () => {
      const result = getAgencyTemplates('ssi');

      expect(result).not.toBeNull();
      expect(result?.agencyCode).toBe('ssi');
    });

    it('should return null for unknown agency code', () => {
      const result = getAgencyTemplates('unknown');

      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result = getAgencyTemplates('PADI');

      expect(result).not.toBeNull();
      expect(result?.agencyCode).toBe('padi');
    });
  });

  describe('getAvailableAgencyCodes', () => {
    it('should return array of agency codes', () => {
      const codes = getAvailableAgencyCodes();

      expect(Array.isArray(codes)).toBe(true);
      expect(codes).toContain('padi');
      expect(codes).toContain('ssi');
      expect(codes).toContain('naui');
    });
  });

  describe('getAllAgencyTemplates', () => {
    it('should return all agency template data', () => {
      const all = getAllAgencyTemplates();

      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBe(3);
    });
  });

  describe('PADI course templates', () => {
    it('should have Open Water Diver course', () => {
      const padi = getAgencyTemplates('padi');
      const owCourse = padi?.courses.find(c => c.code === 'OW');

      expect(owCourse).toBeDefined();
      expect(owCourse?.name).toBe('Open Water Diver');
      expect(owCourse?.durationDays).toBe(4);
      expect(owCourse?.openWaterDives).toBe(4);
    });

    it('should have valid course structure', () => {
      const padi = getAgencyTemplates('padi');

      for (const course of padi?.courses || []) {
        expect(course.code).toBeTruthy();
        expect(course.name).toBeTruthy();
        expect(course.description).toBeTruthy();
        expect(typeof course.durationDays).toBe('number');
        expect(typeof course.minAge).toBe('number');
      }
    });
  });
});
