import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - DiveStreams" },
    { name: "description", content: "Privacy Policy for DiveStreams dive shop management software." },
  ];
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-blue-600">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-gray-600 hover:text-blue-600">
            Features
          </a>
          <a href="/pricing" className="text-gray-600 hover:text-blue-600">
            Pricing
          </a>
          <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* Header */}
      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-gray-600">
          Last updated: January 12, 2026
        </p>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 pb-20 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          <Section title="1. Introduction">
            <p>
              DiveStreams ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our dive shop
              management platform ("Service").
            </p>
            <p>
              Please read this Privacy Policy carefully. By using the Service, you consent to the data practices
              described in this policy. If you do not agree with the terms of this Privacy Policy, please do not
              access or use the Service.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.1 Information You Provide</h3>
            <p>
              We collect information you voluntarily provide when you:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Create an account:</strong> Name, email address, phone number, business name, and billing information</li>
              <li><strong>Use our Service:</strong> Customer data, booking information, equipment records, and business data you enter</li>
              <li><strong>Contact us:</strong> Communications you send via email, support tickets, or other channels</li>
              <li><strong>Subscribe:</strong> Payment card details (processed securely through Stripe)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.2 Information Collected Automatically</h3>
            <p>
              When you access the Service, we automatically collect:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Device information:</strong> Browser type, operating system, device type, and unique device identifiers</li>
              <li><strong>Log data:</strong> IP address, access times, pages viewed, and referring URL</li>
              <li><strong>Usage data:</strong> Features used, actions taken, and time spent on the Service</li>
              <li><strong>Location data:</strong> General geographic location based on IP address</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.3 Information from Third Parties</h3>
            <p>
              We may receive information from third-party services you connect to DiveStreams, such as:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Payment processors (transaction status and billing information)</li>
              <li>Email service providers (delivery status)</li>
              <li>Analytics services (aggregated usage patterns)</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>
              We use the collected information to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process transactions and send related information</li>
              <li>Send administrative messages, updates, and security alerts</li>
              <li>Respond to your comments, questions, and support requests</li>
              <li>Monitor and analyze usage patterns and trends</li>
              <li>Detect, prevent, and address technical issues and fraud</li>
              <li>Personalize and improve your experience</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Cookies and Tracking Technologies">
            <p>
              We use cookies and similar tracking technologies to collect and store information about your
              interactions with the Service.
            </p>
            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Types of Cookies We Use:</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Essential cookies:</strong> Required for the Service to function properly (authentication, security)</li>
              <li><strong>Functional cookies:</strong> Remember your preferences and settings</li>
              <li><strong>Analytics cookies:</strong> Help us understand how you use the Service</li>
              <li><strong>Marketing cookies:</strong> Used to deliver relevant advertisements (only with consent)</li>
            </ul>
            <p className="mt-4">
              You can control cookies through your browser settings. However, disabling certain cookies may
              affect the functionality of the Service.
            </p>
          </Section>

          <Section title="5. How We Share Your Information">
            <p>
              We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Service providers:</strong> With third-party vendors who perform services on our behalf
                (hosting, payment processing, email delivery, analytics)
              </li>
              <li>
                <strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets
              </li>
              <li>
                <strong>Legal requirements:</strong> When required by law or to respond to legal process
              </li>
              <li>
                <strong>Protection of rights:</strong> To protect the rights, property, and safety of DiveStreams,
                our users, or others
              </li>
              <li>
                <strong>With your consent:</strong> When you explicitly authorize the sharing
              </li>
            </ul>
            <p className="mt-4">
              <strong>We do not sell your personal information to third parties.</strong>
            </p>
          </Section>

          <Section title="6. Third-Party Services">
            <p>
              Our Service integrates with third-party services that have their own privacy policies:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Stripe:</strong> Payment processing (<a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>)</li>
              <li><strong>SendGrid:</strong> Email delivery</li>
              <li><strong>Google Analytics:</strong> Usage analytics (if enabled)</li>
            </ul>
            <p className="mt-4">
              We encourage you to review the privacy policies of these third-party services.
            </p>
          </Section>

          <Section title="7. Data Security">
            <p>
              We implement appropriate technical and organizational security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Access controls and authentication requirements</li>
              <li>Secure data centers with physical security measures</li>
              <li>Employee training on data protection practices</li>
            </ul>
            <p className="mt-4">
              While we strive to protect your information, no method of transmission over the Internet or
              electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="8. Data Retention">
            <p>
              We retain your information for as long as your account is active or as needed to provide the Service.
              We may also retain information as necessary to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal obligations</li>
              <li>Resolve disputes</li>
              <li>Enforce our agreements</li>
              <li>Maintain business records</li>
            </ul>
            <p className="mt-4">
              After account deletion, we will delete or anonymize your data within 90 days, except where
              retention is required by law.
            </p>
          </Section>

          <Section title="9. Your Rights and Choices">
            <p>
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request a machine-readable copy of your data</li>
              <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:privacy@divestreams.com" className="text-blue-600 hover:underline">privacy@divestreams.com</a>.
              We will respond to your request within 30 days.
            </p>
          </Section>

          <Section title="10. International Data Transfers">
            <p>
              Your information may be transferred to and processed in countries other than your country of residence.
              These countries may have different data protection laws.
            </p>
            <p>
              When we transfer data internationally, we implement appropriate safeguards, such as standard
              contractual clauses, to ensure adequate protection of your information.
            </p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>
              The Service is not intended for children under 18 years of age. We do not knowingly collect
              personal information from children. If we learn we have collected information from a child,
              we will delete it promptly.
            </p>
          </Section>

          <Section title="12. California Privacy Rights">
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information held by businesses</li>
              <li>Right to opt-out of the sale of personal information</li>
              <li>Right to non-discrimination for exercising your rights</li>
            </ul>
            <p className="mt-4">
              To exercise your CCPA rights, contact us at{" "}
              <a href="mailto:privacy@divestreams.com" className="text-blue-600 hover:underline">privacy@divestreams.com</a>.
            </p>
          </Section>

          <Section title="13. Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending an email notification (for significant changes)</li>
            </ul>
            <p className="mt-4">
              We encourage you to review this Privacy Policy periodically for any changes.
            </p>
          </Section>

          <Section title="14. Contact Us">
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <p className="mt-4">
              <strong>DiveStreams</strong><br />
              Email: <a href="mailto:privacy@divestreams.com" className="text-blue-600 hover:underline">privacy@divestreams.com</a><br />
              Support: <a href="mailto:support@divestreams.com" className="text-blue-600 hover:underline">support@divestreams.com</a>
            </p>
            <p className="mt-4">
              For data protection inquiries in the European Union, you may also contact our Data Protection Officer at{" "}
              <a href="mailto:dpo@divestreams.com" className="text-blue-600 hover:underline">dpo@divestreams.com</a>.
            </p>
          </Section>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 border-t">
        <div className="flex justify-between items-center text-gray-600">
          <div className="text-xl font-bold text-blue-600">DiveStreams</div>
          <div className="flex gap-6">
            <a href="/pricing">Pricing</a>
            <a href="/features">Features</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
          </div>
        </div>
        <div className="text-center text-gray-500 mt-8">
          © {new Date().getFullYear()} DiveStreams. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-600 space-y-4">{children}</div>
    </div>
  );
}
