import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service - DiveStreams" },
    { name: "description", content: "Terms of Service for DiveStreams dive shop management software." },
  ];
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-brand">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-foreground-muted hover:text-brand">
            Features
          </a>
          <a href="/pricing" className="text-foreground-muted hover:text-brand">
            Pricing
          </a>
          <a href="/signup" className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover">
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* Header */}
      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Terms of Service
        </h1>
        <p className="text-foreground-muted">
          Last updated: January 12, 2026
        </p>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 pb-20 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using DiveStreams ("Service"), you agree to be bound by these Terms of Service ("Terms").
              If you do not agree to these Terms, you may not access or use the Service. These Terms apply to all visitors,
              users, and others who access or use the Service.
            </p>
            <p>
              DiveStreams reserves the right to update and change these Terms at any time. Any changes will be posted on
              this page with an updated revision date. Continued use of the Service after any such changes constitutes
              your acceptance of the new Terms.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              DiveStreams provides a cloud-based software platform designed for dive shops to manage their operations,
              including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Booking and reservation management</li>
              <li>Customer relationship management</li>
              <li>Tour and trip scheduling</li>
              <li>Equipment inventory tracking</li>
              <li>Payment processing integration</li>
              <li>Reporting and analytics</li>
            </ul>
          </Section>

          <Section title="3. Account Terms">
            <p>
              To access the Service, you must register for an account. When you register, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate, current, and complete information about yourself and your business</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Be responsible for all activities that occur under your account</li>
              <li>Notify DiveStreams immediately of any unauthorized use of your account</li>
            </ul>
            <p>
              You must be at least 18 years old to use this Service. By using the Service, you represent and warrant
              that you have the legal capacity to enter into a binding agreement.
            </p>
          </Section>

          <Section title="4. Subscription and Payment Terms">
            <p>
              <strong>Free Trial:</strong> DiveStreams offers a 14-day free trial for new accounts. No credit card
              is required to start your trial. At the end of the trial period, you must subscribe to a paid plan
              to continue using the Service.
            </p>
            <p>
              <strong>Billing:</strong> Paid subscriptions are billed in advance on a monthly or annual basis,
              depending on the plan you select. Payment is due at the beginning of each billing cycle.
            </p>
            <p>
              <strong>Price Changes:</strong> DiveStreams reserves the right to change subscription prices at any time.
              We will provide at least 30 days notice before any price change takes effect. Price changes will apply
              at the start of your next billing cycle.
            </p>
            <p>
              <strong>Refunds:</strong> Payments are non-refundable except as required by law. No refunds or credits
              will be provided for partial months of service, upgrade/downgrade refunds, or refunds for months unused
              with an open account.
            </p>
          </Section>

          <Section title="5. Cancellation and Termination">
            <p>
              <strong>Cancellation by You:</strong> You may cancel your subscription at any time through your account
              settings or by contacting support. Cancellation will take effect at the end of your current billing period.
              You will retain access to the Service until then.
            </p>
            <p>
              <strong>Termination by DiveStreams:</strong> We may suspend or terminate your account and access to the
              Service at any time, with or without cause, and with or without notice. Reasons for termination may include,
              but are not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Breach of these Terms</li>
              <li>Non-payment of fees</li>
              <li>Fraudulent, illegal, or unauthorized use of the Service</li>
              <li>Extended periods of inactivity</li>
            </ul>
            <p>
              <strong>Data Export:</strong> Upon cancellation or termination, you will have 30 days to export your data.
              After this period, your data may be permanently deleted and cannot be recovered.
            </p>
          </Section>

          <Section title="6. User Conduct and Restrictions">
            <p>
              You agree not to use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Upload or transmit viruses, malware, or other harmful code</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use the Service for any fraudulent or illegal purpose</li>
              <li>Resell, sublicense, or redistribute the Service without authorization</li>
              <li>Scrape, crawl, or use automated means to access the Service without permission</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              The Service and its original content, features, and functionality are owned by DiveStreams and are
              protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p>
              You retain ownership of any data and content you upload to the Service. By uploading content, you grant
              DiveStreams a worldwide, non-exclusive, royalty-free license to use, store, and process your content
              solely for the purpose of providing the Service.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DIVESTREAMS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE,
              GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your access to or use of (or inability to access or use) the Service</li>
              <li>Any conduct or content of any third party on the Service</li>
              <li>Any content obtained from the Service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
            </ul>
            <p>
              IN NO EVENT SHALL DIVESTREAMS' TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU HAVE PAID TO DIVESTREAMS
              IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p>
              DiveStreams does not warrant that the Service will be uninterrupted, secure, or error-free, or that
              defects will be corrected. We do not guarantee any specific results from use of the Service.
            </p>
          </Section>

          <Section title="10. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless DiveStreams, its officers, directors, employees,
              and agents from any claims, damages, losses, liabilities, costs, and expenses (including reasonable
              attorneys' fees) arising from your use of the Service or your violation of these Terms.
            </p>
          </Section>

          <Section title="11. Governing Law and Dispute Resolution">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of California,
              United States, without regard to its conflict of law provisions.
            </p>
            <p>
              Any disputes arising from these Terms or the Service shall be resolved through binding arbitration
              in accordance with the rules of the American Arbitration Association. The arbitration shall be held
              in San Francisco, California.
            </p>
          </Section>

          <Section title="12. Modifications to the Service">
            <p>
              DiveStreams reserves the right to modify, suspend, or discontinue the Service (or any part thereof)
              at any time, with or without notice. We shall not be liable to you or any third party for any
              modification, suspension, or discontinuation of the Service.
            </p>
          </Section>

          <Section title="13. Contact Information">
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="mt-4">
              <strong>DiveStreams</strong><br />
              Email: <a href="mailto:legal@divestreams.com" className="text-brand hover:underline">legal@divestreams.com</a><br />
              Support: <a href="mailto:support@divestreams.com" className="text-brand hover:underline">support@divestreams.com</a>
            </p>
          </Section>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 border-t">
        <div className="flex justify-between items-center text-foreground-muted">
          <div className="text-xl font-bold text-brand">DiveStreams</div>
          <div className="flex gap-6">
            <a href="/pricing">Pricing</a>
            <a href="/features">Features</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
          </div>
        </div>
        <div className="text-center text-foreground-muted mt-8">
          © {new Date().getFullYear()} DiveStreams. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-4">{title}</h2>
      <div className="text-foreground-muted space-y-4">{children}</div>
    </div>
  );
}
