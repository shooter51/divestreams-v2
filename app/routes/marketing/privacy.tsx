/**
 * Privacy Policy Page
 * Public-facing privacy policy for legal compliance (GDPR, CCPA, etc.)
 */

import type { MetaFunction } from "react-router";
import { Link } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy - DiveStreams" },
  { name: "description", content: "DiveStreams privacy policy and data protection practices" },
];

export default function PrivacyPage() {
  const lastUpdated = "January 31, 2026";

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-brand hover:underline">
            ← Back to Home
          </Link>
        </div>

        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-foreground-muted mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              Welcome to DiveStreams ("we," "our," or "us"). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you visit our website or use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <p>We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Name, email address, and contact information</li>
              <li>Diving certification details and experience level</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Booking and reservation details</li>
              <li>Communications with our support team</li>
            </ul>
            <p>We also automatically collect certain information when you use our services:</p>
            <ul className="list-disc pl-6">
              <li>Device and browser information</li>
              <li>IP address and location data</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your bookings and payments</li>
              <li>Send you booking confirmations and updates</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Analyze usage patterns and improve user experience</li>
              <li>Comply with legal obligations and prevent fraud</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Service Providers:</strong> Third-party companies that help us operate our business
                (e.g., payment processors, email services, analytics providers)
              </li>
              <li>
                <strong>Dive Operators:</strong> When you book a dive trip, we share your information with
                the dive shop or tour operator to fulfill your reservation
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets
              </li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information
              against unauthorized access, alteration, disclosure, or destruction. This includes:
            </p>
            <ul className="list-disc pl-6">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure payment processing through PCI-DSS compliant providers</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication measures</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Your Privacy Rights</h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Access:</strong> Request a copy of your personal information
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate or incomplete data
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your personal information
              </li>
              <li>
                <strong>Opt-Out:</strong> Unsubscribe from marketing communications
              </li>
              <li>
                <strong>Data Portability:</strong> Request your data in a portable format
              </li>
              <li>
                <strong>Object:</strong> Object to processing of your personal information
              </li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:privacy@divestreams.com" className="text-brand hover:underline">
                privacy@divestreams.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to enhance your experience. You can control
              cookies through your browser settings. Disabling cookies may limit your ability to use certain
              features of our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure
              appropriate safeguards are in place to protect your information in accordance with this Privacy
              Policy and applicable data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p>
              Our services are not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and believe we have
              collected information about a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting
              the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of
              our services after any changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-surface-raised rounded-lg">
              <p className="font-semibold">DiveStreams</p>
              <p>Email: <a href="mailto:privacy@divestreams.com" className="text-brand hover:underline">privacy@divestreams.com</a></p>
              <p>Support: <a href="mailto:support@divestreams.com" className="text-brand hover:underline">support@divestreams.com</a></p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
