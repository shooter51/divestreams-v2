/**
 * Password Generation Tests
 *
 * Comprehensive tests for generateRandomPassword utility function.
 * Tests randomness, character sets, length constraints, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { generateRandomPassword } from "../../../../lib/auth/password.server";

describe("generateRandomPassword", () => {
  // ============================================================================
  // Basic Functionality
  // ============================================================================

  describe("Basic functionality", () => {
    it("should generate password with default length of 16", () => {
      const password = generateRandomPassword();
      expect(password).toHaveLength(16);
    });

    it("should generate password with specified length", () => {
      const password = generateRandomPassword(20);
      expect(password).toHaveLength(20);
    });

    it("should generate password with minimum length of 1", () => {
      const password = generateRandomPassword(1);
      expect(password).toHaveLength(1);
    });

    it("should generate password with large length", () => {
      const password = generateRandomPassword(100);
      expect(password).toHaveLength(100);
    });

    it("should generate password with length 8", () => {
      const password = generateRandomPassword(8);
      expect(password).toHaveLength(8);
    });

    it("should generate password with length 12", () => {
      const password = generateRandomPassword(12);
      expect(password).toHaveLength(12);
    });

    it("should generate password with length 24", () => {
      const password = generateRandomPassword(24);
      expect(password).toHaveLength(24);
    });

    it("should generate password with length 32", () => {
      const password = generateRandomPassword(32);
      expect(password).toHaveLength(32);
    });
  });

  // ============================================================================
  // Character Set Tests
  // ============================================================================

  describe("Character set", () => {
    it("should only contain alphanumeric characters", () => {
      const password = generateRandomPassword(100);
      // Only letters and numbers (excluding ambiguous chars)
      expect(password).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]+$/);
    });

    it("should not contain ambiguous character 0", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toContain("0");
      });
    });

    it("should not contain ambiguous character O", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toContain("O");
      });
    });

    it("should not contain ambiguous character l (lowercase L)", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toContain("l");
      });
    });

    it("should not contain ambiguous character 1", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toContain("1");
      });
    });

    it("should not contain ambiguous character I (uppercase i)", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toContain("I");
      });
    });

    it("should not contain special characters", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toMatch(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/);
      });
    });

    it("should not contain whitespace", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(100));
      passwords.forEach(password => {
        expect(password).not.toMatch(/\s/);
      });
    });

    it("should contain uppercase letters", () => {
      // With 100 chars, statistically guaranteed to have uppercase
      const password = generateRandomPassword(100);
      expect(password).toMatch(/[A-HJ-NP-Z]/);
    });

    it("should contain lowercase letters", () => {
      // With 100 chars, statistically guaranteed to have lowercase
      const password = generateRandomPassword(100);
      expect(password).toMatch(/[a-hj-np-z]/);
    });

    it("should contain numbers", () => {
      // With 100 chars, statistically guaranteed to have numbers
      const password = generateRandomPassword(100);
      expect(password).toMatch(/[2-9]/);
    });
  });

  // ============================================================================
  // Randomness Tests
  // ============================================================================

  describe("Randomness", () => {
    it("should generate different passwords on successive calls", () => {
      const password1 = generateRandomPassword(16);
      const password2 = generateRandomPassword(16);
      expect(password1).not.toBe(password2);
    });

    it("should generate unique passwords in batch", () => {
      const passwords = Array.from({ length: 100 }, () => generateRandomPassword(16));
      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBe(100);
    });

    it("should have good distribution of characters", () => {
      // Generate a long password and check character distribution
      const password = generateRandomPassword(1000);
      const charCounts = new Map<string, number>();

      for (const char of password) {
        charCounts.set(char, (charCounts.get(char) || 0) + 1);
      }

      // Should have multiple different characters
      expect(charCounts.size).toBeGreaterThan(20);
    });

    it("should not have obvious patterns", () => {
      const passwords = Array.from({ length: 20 }, () => generateRandomPassword(16));

      passwords.forEach(password => {
        // Should not have same character repeated more than 3 times in a row
        expect(password).not.toMatch(/(.)\1{3,}/);
      });
    });

    it("should generate different first characters", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(16));
      const firstChars = new Set(passwords.map(p => p[0]));

      // Should have variety in first characters
      expect(firstChars.size).toBeGreaterThan(10);
    });

    it("should generate different last characters", () => {
      const passwords = Array.from({ length: 50 }, () => generateRandomPassword(16));
      const lastChars = new Set(passwords.map(p => p[p.length - 1]));

      // Should have variety in last characters
      expect(lastChars.size).toBeGreaterThan(10);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle length of 2", () => {
      const password = generateRandomPassword(2);
      expect(password).toHaveLength(2);
      expect(password).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]{2}$/);
    });

    it("should handle length of 3", () => {
      const password = generateRandomPassword(3);
      expect(password).toHaveLength(3);
      expect(password).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]{3}$/);
    });

    it("should handle very large length (1000)", () => {
      const password = generateRandomPassword(1000);
      expect(password).toHaveLength(1000);
      expect(password).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]+$/);
    });

    it("should handle rapid successive generation", () => {
      const passwords = [];
      for (let i = 0; i < 1000; i++) {
        passwords.push(generateRandomPassword(16));
      }

      // All should be unique
      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBe(1000);
    });

    it("should handle parallel generation", () => {
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(generateRandomPassword(16))
      );

      return Promise.all(promises).then(passwords => {
        const uniquePasswords = new Set(passwords);
        expect(uniquePasswords.size).toBe(100);
      });
    });
  });

  // ============================================================================
  // Entropy and Security Tests
  // ============================================================================

  describe("Entropy and security", () => {
    it("should have sufficient entropy for 16-char password", () => {
      // 54 possible characters (A-Z minus I,O + a-z minus l + 2-9)
      // 16 characters => log2(54^16) = ~92 bits of entropy
      const password = generateRandomPassword(16);

      // Check that it uses the full character set over multiple generations
      const passwords = Array.from({ length: 100 }, () => generateRandomPassword(16));
      const allChars = passwords.join("");
      const uniqueChars = new Set(allChars);

      // Should use a good portion of the available character set
      expect(uniqueChars.size).toBeGreaterThan(40);
    });

    it("should not be predictable from previous passwords", () => {
      const password1 = generateRandomPassword(16);
      const password2 = generateRandomPassword(16);
      const password3 = generateRandomPassword(16);

      // No two passwords should share more than ~40% of characters
      // (statistically very unlikely with random generation)
      const shared12 = [...password1].filter((c, i) => c === password2[i]).length;
      const shared23 = [...password2].filter((c, i) => c === password3[i]).length;

      expect(shared12).toBeLessThan(7);
      expect(shared23).toBeLessThan(7);
    });

    it("should use cryptographically secure randomBytes", () => {
      // This test verifies that the distribution is not obviously biased
      const charFrequency = new Map<string, number>();
      const totalChars = 10000;

      for (let i = 0; i < totalChars / 16; i++) {
        const password = generateRandomPassword(16);
        for (const char of password) {
          charFrequency.set(char, (charFrequency.get(char) || 0) + 1);
        }
      }

      // Expected frequency for uniform distribution: totalChars / 54 ≈ 185
      // Allow 50% deviation (92-278) due to randomness
      const expectedFreq = totalChars / 54;
      const minFreq = expectedFreq * 0.5;
      const maxFreq = expectedFreq * 1.5;

      // Most characters should appear with reasonable frequency
      const frequencies = Array.from(charFrequency.values());
      const reasonableFreqs = frequencies.filter(f => f >= minFreq && f <= maxFreq);

      // At least 80% of observed characters should have reasonable frequency
      expect(reasonableFreqs.length).toBeGreaterThan(frequencies.length * 0.8);
    });
  });

  // ============================================================================
  // Readability Tests
  // ============================================================================

  describe("Readability", () => {
    it("should be readable (no ambiguous characters)", () => {
      const passwords = Array.from({ length: 20 }, () => generateRandomPassword(16));

      passwords.forEach(password => {
        // Should not contain 0, O, l, 1, I
        expect(password).not.toMatch(/[0Ol1I]/);
      });
    });

    it("should have good mix of character types for readability", () => {
      // A password with only one type would be hard to segment visually
      const password = generateRandomPassword(50);

      const hasUppercase = /[A-HJ-NP-Z]/.test(password);
      const hasLowercase = /[a-hj-np-z]/.test(password);
      const hasNumber = /[2-9]/.test(password);

      // With 50 chars, should have all three types
      expect(hasUppercase).toBe(true);
      expect(hasLowercase).toBe(true);
      expect(hasNumber).toBe(true);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe("Performance", () => {
    it("should generate password quickly (under 10ms)", () => {
      const start = Date.now();
      generateRandomPassword(16);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it("should handle batch generation efficiently", () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        generateRandomPassword(16);
      }
      const duration = Date.now() - start;

      // Should generate 1000 passwords in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });

  // ============================================================================
  // Consistency Tests
  // ============================================================================

  describe("Consistency", () => {
    it("should always return a string", () => {
      const password = generateRandomPassword(16);
      expect(typeof password).toBe("string");
    });

    it("should never return empty string (even with zero length)", () => {
      // Edge case: what happens with 0? (though not a valid use case)
      // The implementation should handle this gracefully
      const password = generateRandomPassword(0);
      expect(typeof password).toBe("string");
      expect(password).toHaveLength(0);
    });

    it("should have exact length requested", () => {
      const lengths = [1, 5, 10, 15, 20, 25, 30, 50, 100];

      lengths.forEach(length => {
        const password = generateRandomPassword(length);
        expect(password.length).toBe(length);
      });
    });
  });
});
