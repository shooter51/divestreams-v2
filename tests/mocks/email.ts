import { vi } from "vitest";

export interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const sentEmails: SentEmail[] = [];

export const mockTransporter = {
  sendMail: vi.fn().mockImplementation(async (options) => {
    sentEmails.push({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return {
      messageId: `<mock-${Date.now()}@test.com>`,
      accepted: [options.to],
      rejected: [],
    };
  }),
  verify: vi.fn().mockResolvedValue(true),
};

export const createMockNodemailer = () => ({
  createTransport: vi.fn().mockReturnValue(mockTransporter),
});

// Helper functions
export const getSentEmails = () => [...sentEmails];

export const getLastEmail = () => sentEmails[sentEmails.length - 1];

export const clearSentEmails = () => {
  sentEmails.length = 0;
};

export const findEmailByTo = (to: string) => sentEmails.find((e) => e.to === to);

export const findEmailBySubject = (subject: string) => sentEmails.find((e) => e.subject.includes(subject));

export const resetEmailMocks = () => {
  clearSentEmails();
  mockTransporter.sendMail.mockClear();
  mockTransporter.verify.mockClear();
};
