/**
 * Terms of Service Page
 * Public-facing terms of service for legal compliance
 */

import type { MetaFunction } from "react-router";
import { Link } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Terms of Service - DiveStreams" },
  { name: "description", content: "DiveStreams terms of service and user agreement" },
];

export const headers = () => ({
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
});

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-foreground-muted mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing or using DiveStreams ("Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you disagree with any part of these terms, you do not have permission to access
              the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
            <p>
              Permission is granted to temporarily access the Service for personal, non-commercial use only.
              This is a license, not a transfer of title. Under this license, you may not:
            </p>
            <ul className="list-disc pl-6">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose</li>
              <li>Attempt to decompile or reverse engineer any software</li>
              <li>Remove any copyright or proprietary notations</li>
              <li>Transfer the materials to another person</li>
              <li>Use the Service in any way that violates applicable laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p>
              When you create an account with us, you must provide accurate, complete, and current information.
              You are responsible for:
            </p>
            <ul className="list-disc pl-6">
              <li>Maintaining the security of your account and password</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
            <p className="mt-4">
              We reserve the right to terminate accounts that violate these Terms or engage in fraudulent,
              abusive, or illegal activity.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Bookings and Payments</h2>
            <p>
              When you make a booking through DiveStreams:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Payment:</strong> Payment is processed securely through Stripe. You agree to provide
                valid payment information.
              </li>
              <li>
                <strong>Confirmation:</strong> Bookings are subject to availability and confirmation by the
                dive operator.
              </li>
              <li>
                <strong>Cancellation:</strong> Cancellation policies vary by dive operator. Review the specific
                cancellation policy before booking.
              </li>
              <li>
                <strong>Refunds:</strong> Refunds are processed according to the dive operator's cancellation
                policy and may be subject to processing fees.
              </li>
              <li>
                <strong>Pricing:</strong> Prices are subject to change. The price confirmed at booking is
                final.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Diving Safety and Liability</h2>
            <div className="bg-warning-muted border-l-4 border-warning p-4 mb-4 max-w-4xl break-words">
              <p className="font-semibold text-warning">IMPORTANT SAFETY NOTICE</p>
              <p>
                Scuba diving and water activities carry inherent risks. You acknowledge that you participate
                in diving activities at your own risk.
              </p>
            </div>
            <p>You agree that:</p>
            <ul className="list-disc pl-6">
              <li>You are physically fit and medically cleared for diving</li>
              <li>You hold appropriate diving certifications for your skill level</li>
              <li>You will follow all safety instructions from dive operators</li>
              <li>You understand the risks associated with diving activities</li>
              <li>DiveStreams acts as a booking platform and is not responsible for the actual diving services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services</h2>
            <p>
              DiveStreams connects you with third-party dive operators and service providers. We do not
              directly provide diving services. By booking through our platform:
            </p>
            <ul className="list-disc pl-6">
              <li>You enter into a separate agreement with the dive operator</li>
              <li>The dive operator is responsible for the services provided</li>
              <li>DiveStreams is not liable for the acts or omissions of dive operators</li>
              <li>Disputes should be resolved directly with the service provider</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, DiveStreams shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including but not limited to:
            </p>
            <ul className="list-disc pl-6">
              <li>Personal injury or death while diving</li>
              <li>Loss of profits or revenue</li>
              <li>Loss of data or business interruption</li>
              <li>Cancellations or changes by dive operators</li>
              <li>Weather-related cancellations</li>
            </ul>
            <p className="mt-4">
              Our total liability shall not exceed the amount paid by you for the specific booking.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by DiveStreams and
              are protected by international copyright, trademark, patent, trade secret, and other intellectual
              property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. User Content</h2>
            <p>
              By posting reviews, photos, or other content to the Service, you grant DiveStreams a
              non-exclusive, worldwide, royalty-free license to use, display, and distribute your content.
              You represent that:
            </p>
            <ul className="list-disc pl-6">
              <li>You own or have rights to the content you post</li>
              <li>Your content does not violate any laws or third-party rights</li>
              <li>Your content is accurate and not misleading</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6">
              <li>Use the Service for any illegal purpose</li>
              <li>Harass, abuse, or harm other users or operators</li>
              <li>Post false, misleading, or defamatory content</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Use automated systems to access the Service</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior
              notice, for any reason, including if you breach these Terms. Upon termination:
            </p>
            <ul className="list-disc pl-6">
              <li>Your right to use the Service will cease immediately</li>
              <li>Existing bookings may be honored at our discretion</li>
              <li>You remain liable for any outstanding payments</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws, without
              regard to conflict of law provisions. Any disputes arising from these Terms or your use of
              the Service shall be resolved through binding arbitration.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of material
              changes by posting the new Terms on this page and updating the "Last updated" date. Your
              continued use of the Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Disclaimer</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, OR NON-INFRINGEMENT.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">15. Contact Information</h2>
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-surface-raised rounded-lg">
              <p className="font-semibold">DiveStreams</p>
              <p>Email: <a href="mailto:legal@divestreams.com" className="text-brand hover:underline">legal@divestreams.com</a></p>
              <p>Support: <a href="mailto:support@divestreams.com" className="text-brand hover:underline">support@divestreams.com</a></p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
