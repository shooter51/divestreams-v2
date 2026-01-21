import { describe, it, expect } from 'vitest';
import padiCatalog from '../../../lib/data/catalogs/padi-courses.json';

describe('PADI Course Catalog - Source Data Validation', () => {
  describe('Catalog Metadata', () => {
    it('should have required metadata fields', () => {
      expect(padiCatalog).toHaveProperty('agency', 'padi');
      expect(padiCatalog).toHaveProperty('agencyName');
      expect(padiCatalog).toHaveProperty('version');
      expect(padiCatalog).toHaveProperty('lastUpdated');
      expect(padiCatalog).toHaveProperty('courses');
    });

    it('should have documentation comments', () => {
      expect(padiCatalog).toHaveProperty('_comment');
      expect(padiCatalog).toHaveProperty('_note');
      expect(padiCatalog._note).toContain('SOURCE DATA');
      expect(padiCatalog._note).toContain('transforms');
    });

    it('should have valid version format (YYYY.N)', () => {
      expect(padiCatalog.version).toMatch(/^\d{4}\.\d+$/);
    });

    it('should have valid ISO date for lastUpdated', () => {
      const date = new Date(padiCatalog.lastUpdated);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Course Structure', () => {
    it('should have at least one course', () => {
      expect(Array.isArray(padiCatalog.courses)).toBe(true);
      expect(padiCatalog.courses.length).toBeGreaterThan(0);
    });

    it('should have all required fields for each course', () => {
      padiCatalog.courses.forEach((course) => {
        expect(course).toHaveProperty('name');
        expect(course).toHaveProperty('code');
        expect(course).toHaveProperty('levelCode');
        expect(course).toHaveProperty('durationDays');
      });
    });

    it('should have valid levelCode values', () => {
      const validLevelCodes = ['beginner', 'advanced', 'professional', 'specialty', 'instructor'];

      padiCatalog.courses.forEach((course) => {
        expect(validLevelCodes).toContain(course.levelCode);
      });
    });

    it('should have unique course codes', () => {
      const codes = padiCatalog.courses.map(c => c.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('Course Field Validation', () => {
    padiCatalog.courses.forEach((course) => {
      describe(`Course: ${course.name}`, () => {
        it('should have valid name (1-200 chars)', () => {
          expect(course.name.length).toBeGreaterThan(0);
          expect(course.name.length).toBeLessThanOrEqual(200);
        });

        it('should have valid code (1-50 chars)', () => {
          expect(course.code.length).toBeGreaterThan(0);
          expect(course.code.length).toBeLessThanOrEqual(50);
        });

        it('should have valid duration (1-365 days)', () => {
          expect(course.durationDays).toBeGreaterThanOrEqual(1);
          expect(course.durationDays).toBeLessThanOrEqual(365);
        });

        if (course.classroomHours !== undefined) {
          it('should have valid classroom hours (0-1000)', () => {
            expect(course.classroomHours).toBeGreaterThanOrEqual(0);
            expect(course.classroomHours).toBeLessThanOrEqual(1000);
          });
        }

        if (course.poolHours !== undefined) {
          it('should have valid pool hours (0-1000)', () => {
            expect(course.poolHours).toBeGreaterThanOrEqual(0);
            expect(course.poolHours).toBeLessThanOrEqual(1000);
          });
        }

        if (course.openWaterDives !== undefined) {
          it('should have valid open water dives (0-100)', () => {
            expect(course.openWaterDives).toBeGreaterThanOrEqual(0);
            expect(course.openWaterDives).toBeLessThanOrEqual(100);
          });
        }

        if (course.minAge !== null && course.minAge !== undefined) {
          it('should have valid minimum age (0-99)', () => {
            expect(course.minAge).toBeGreaterThanOrEqual(0);
            expect(course.minAge).toBeLessThanOrEqual(99);
          });
        }

        if (course.description) {
          it('should have valid description length (max 5000 chars)', () => {
            expect(course.description.length).toBeLessThanOrEqual(5000);
          });
        }

        if (course.prerequisites) {
          it('should have valid prerequisites length (max 2000 chars)', () => {
            expect(course.prerequisites.length).toBeLessThanOrEqual(2000);
          });
        }

        if (course.images) {
          it('should have valid images array (max 10 items)', () => {
            expect(Array.isArray(course.images)).toBe(true);
            expect(course.images.length).toBeLessThanOrEqual(10);

            course.images.forEach((url) => {
              expect(typeof url).toBe('string');
              expect(url).toMatch(/^https?:\/\/.+/);
            });
          });
        }

        if (course.requiredItems) {
          it('should have valid requiredItems array', () => {
            expect(Array.isArray(course.requiredItems)).toBe(true);
            expect(course.requiredItems.length).toBeLessThanOrEqual(50);

            course.requiredItems.forEach((item) => {
              expect(typeof item).toBe('string');
              expect(item.length).toBeLessThanOrEqual(200);
            });
          });
        }

        it('should have boolean materialsIncluded', () => {
          expect(typeof course.materialsIncluded).toBe('boolean');
        });
      });
    });
  });

  describe('Data Consistency', () => {
    it('should have appropriate training hours for course duration', () => {
      padiCatalog.courses.forEach((course) => {
        const totalHours = (course.classroomHours || 0) + (course.poolHours || 0);
        const estimatedHoursPerDay = totalHours / course.durationDays;

        // Most courses should have between 0-16 hours per day
        expect(estimatedHoursPerDay).toBeLessThanOrEqual(16);
      });
    });

    it('should have logical prerequisites for advanced courses', () => {
      const advancedCourses = padiCatalog.courses.filter(c =>
        c.levelCode === 'advanced' ||
        c.levelCode === 'professional' ||
        c.levelCode === 'instructor'
      );

      advancedCourses.forEach((course) => {
        // Advanced courses should typically have prerequisites
        if (course.levelCode !== 'specialty') {
          expect(course.prerequisites).toBeTruthy();
        }
      });
    });

    it('should have higher minimum age for professional courses', () => {
      const professionalCourses = padiCatalog.courses.filter(c =>
        c.levelCode === 'professional' || c.levelCode === 'instructor'
      );

      professionalCourses.forEach((course) => {
        if (course.minAge !== null && course.minAge !== undefined) {
          expect(course.minAge).toBeGreaterThanOrEqual(15);
        }
      });
    });
  });

  describe('Transformation Readiness', () => {
    it('should have all fields needed for contentHash generation', () => {
      const hashFields = [
        'name',
        'code',
        'description',
        'images',
        'durationDays',
        'classroomHours',
        'poolHours',
        'openWaterDives',
        'prerequisites',
        'minAge',
        'medicalRequirements',
        'requiredItems',
        'materialsIncluded'
      ];

      padiCatalog.courses.forEach((course) => {
        hashFields.forEach((field) => {
          expect(course).toHaveProperty(field);
        });
      });
    });

    it('should have levelCode that maps to certification levels', () => {
      const levelCodeMapping = {
        'beginner': 'owd',
        'advanced': 'aowd',
        'professional': 'dm',
        'specialty': 'specialty',
        'instructor': 'instructor'
      };

      padiCatalog.courses.forEach((course) => {
        expect(levelCodeMapping).toHaveProperty(course.levelCode);
      });
    });

    it('should NOT have tenant-specific fields', () => {
      const tenantFields = [
        'organizationId',
        'price',
        'currency',
        'depositRequired',
        'depositAmount',
        'isActive',
        'isPublic',
        'sortOrder',
        'minStudents',
        'maxStudents',
        'equipmentIncluded',
        'includedItems'
      ];

      padiCatalog.courses.forEach((course) => {
        tenantFields.forEach((field) => {
          expect(course).not.toHaveProperty(field);
        });
      });
    });

    it('should NOT have database-specific fields', () => {
      const dbFields = [
        'id',
        'agencyId',
        'levelId',
        'contentHash',
        'sourceType',
        'sourceUrl',
        'lastSyncedAt',
        'createdAt',
        'updatedAt'
      ];

      padiCatalog.courses.forEach((course) => {
        dbFields.forEach((field) => {
          expect(course).not.toHaveProperty(field);
        });
      });
    });
  });

  describe('Sample Data Quality', () => {
    it('should have the classic PADI progression courses', () => {
      const courseNames = padiCatalog.courses.map(c => c.name);

      expect(courseNames).toContain('Open Water Diver');
      expect(courseNames).toContain('Advanced Open Water Diver');
      expect(courseNames).toContain('Rescue Diver');
    });

    it('should have appropriate training structure for Open Water Diver', () => {
      const owd = padiCatalog.courses.find(c => c.code === 'OWD');

      expect(owd).toBeDefined();
      if (owd) {
        expect(owd.levelCode).toBe('beginner');
        expect(owd.prerequisites).toBeNull();
        expect(owd.minAge).toBeGreaterThan(0);
        expect(owd.openWaterDives).toBeGreaterThan(0);
        expect(owd.classroomHours).toBeGreaterThan(0);
      }
    });

    it('should have appropriate training structure for Rescue Diver', () => {
      const rescue = padiCatalog.courses.find(c => c.code === 'RD');

      expect(rescue).toBeDefined();
      if (rescue) {
        expect(rescue.levelCode).toBe('advanced');
        expect(rescue.prerequisites).toBeTruthy();
        expect(rescue.prerequisites).toContain('Advanced');
      }
    });

    it('should have appropriate structure for Divemaster', () => {
      const dm = padiCatalog.courses.find(c => c.code === 'DM');

      expect(dm).toBeDefined();
      if (dm) {
        expect(dm.levelCode).toBe('professional');
        expect(dm.minAge).toBeGreaterThanOrEqual(18);
        expect(dm.prerequisites).toContain('Rescue Diver');
      }
    });
  });
});
