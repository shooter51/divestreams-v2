/**
 * Public Site About Page
 *
 * Displays about content, team information, certifications, and company history.
 * Content is pulled from publicSiteSettings.aboutContent (rich text/HTML).
 */

import { useRouteLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";

// ============================================================================
// MOCK DATA (placeholder until database fields are added)
// ============================================================================

/**
 * Team member type for display
 */
interface TeamMember {
  id: string;
  name: string;
  role: string;
  image: string | null;
  bio: string | null;
  certifications: string[];
}

/**
 * Certification/affiliation type
 */
interface Certification {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
}

/**
 * Mock team data - in production this would come from the database
 */
const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "John Smith",
    role: "Owner & Lead Instructor",
    image: null,
    bio: "PADI Course Director with over 20 years of diving experience across the globe.",
    certifications: ["PADI Course Director", "TDI Advanced Trimix"],
  },
  {
    id: "2",
    name: "Maria Garcia",
    role: "Operations Manager",
    image: null,
    bio: "Certified Divemaster and expedition coordinator with expertise in trip planning.",
    certifications: ["PADI Divemaster", "EFR Instructor"],
  },
  {
    id: "3",
    name: "David Chen",
    role: "Technical Diving Instructor",
    image: null,
    bio: "Specializes in technical diving, cave diving, and advanced underwater photography.",
    certifications: ["TDI Full Cave", "PADI MSDT"],
  },
];

/**
 * Mock certifications/affiliations
 */
const mockCertifications: Certification[] = [
  {
    id: "1",
    name: "PADI 5-Star Dive Center",
    logoUrl: null,
    description: "Recognized for excellence in diver training and safety",
  },
  {
    id: "2",
    name: "SSI Dive Center",
    logoUrl: null,
    description: "Authorized SSI training facility",
  },
  {
    id: "3",
    name: "DAN Partner",
    logoUrl: null,
    description: "Divers Alert Network emergency response partner",
  },
  {
    id: "4",
    name: "Green Fins Member",
    logoUrl: null,
    description: "Committed to sustainable diving practices",
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Team member card component
 */
function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <div
      className="rounded-xl p-6 transition-shadow hover:shadow-lg"
      style={{ backgroundColor: "var(--accent-color)" }}
    >
      {/* Avatar */}
      <div className="flex justify-center mb-4">
        {member.image ? (
          <img
            src={member.image}
            alt={member.name}
            className="w-24 h-24 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: "var(--primary-color)" }}
          >
            {member.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">{member.name}</h3>
        <p
          className="text-sm font-medium mt-1"
          style={{ color: "var(--primary-color)" }}
        >
          {member.role}
        </p>
        {member.bio && (
          <p className="mt-3 text-sm opacity-75">{member.bio}</p>
        )}

        {/* Certifications */}
        {member.certifications.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {member.certifications.map((cert, i) => (
              <span
                key={i}
                className="inline-block px-2 py-1 text-xs rounded-full"
                style={{
                  backgroundColor: "var(--background-color)",
                  color: "var(--primary-color)",
                }}
              >
                {cert}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Certification badge component
 */
function CertificationBadge({ certification }: { certification: Certification }) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-lg"
      style={{ backgroundColor: "var(--accent-color)" }}
    >
      {certification.logoUrl ? (
        <img
          src={certification.logoUrl}
          alt={certification.name}
          className="w-16 h-16 object-contain"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--primary-color)" }}
        >
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
        </div>
      )}
      <div>
        <h4 className="font-semibold">{certification.name}</h4>
        {certification.description && (
          <p className="text-sm opacity-75 mt-1">{certification.description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Photo gallery placeholder component
 */
function PhotoGalleryPlaceholder() {
  const placeholders = [1, 2, 3, 4, 5, 6];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {placeholders.map((i) => (
        <div
          key={i}
          className="aspect-square rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          <svg
            className="w-12 h-12 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: "var(--primary-color)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SiteAboutPage() {
  // Get data from parent layout loader
  const loaderData = useRouteLoaderData<SiteLoaderData>("routes/site/_layout");

  if (!loaderData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold">About Us</h1>
        <p className="mt-4 text-lg opacity-75">Loading...</p>
      </div>
    );
  }

  const { organization, settings } = loaderData;
  const aboutContent = settings.aboutContent;

  // Check if we have custom about content
  const hasCustomContent = aboutContent && aboutContent.trim().length > 0;

  // Use mock data for team and certifications (in production, these would come from the database)
  const teamMembers = mockTeamMembers;
  const certifications = mockCertifications;
  const showTeam = teamMembers.length > 0;
  const showCertifications = certifications.length > 0;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="py-16 md:py-24"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold">
              About {organization.name}
            </h1>
            <p className="mt-6 text-xl opacity-75">
              Discover our passion for diving and commitment to providing
              unforgettable underwater experiences.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* About Content (Rich Text) */}
            <section className="mb-16">
              <h2 className="text-2xl font-bold mb-6">Our Story</h2>
              {hasCustomContent ? (
                <div
                  className="prose prose-lg max-w-none"
                  style={{
                    color: "var(--text-color)",
                  }}
                  dangerouslySetInnerHTML={{ __html: aboutContent }}
                />
              ) : (
                <div className="prose prose-lg max-w-none space-y-4">
                  <p className="opacity-75">
                    Welcome to {organization.name}! We are passionate about sharing
                    the wonders of the underwater world with divers of all experience
                    levels.
                  </p>
                  <p className="opacity-75">
                    Our team of experienced instructors and dive professionals is
                    dedicated to providing safe, educational, and exciting diving
                    experiences. Whether you're taking your first breath underwater
                    or exploring advanced technical diving, we're here to guide you
                    every step of the way.
                  </p>
                  <p className="opacity-75">
                    With years of experience in the diving industry, we've built a
                    reputation for excellence in training, safety, and customer
                    service. Our commitment to environmental conservation ensures
                    that the underwater environments we love remain pristine for
                    future generations.
                  </p>
                </div>
              )}
            </section>

            {/* Our Values */}
            <section className="mb-16">
              <h2 className="text-2xl font-bold mb-6">Our Values</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--primary-color)" }}
                  >
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg">Safety First</h3>
                  <p className="mt-2 text-sm opacity-75">
                    Your safety is our top priority. We maintain the highest standards
                    in equipment, training, and dive practices.
                  </p>
                </div>

                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--primary-color)" }}
                  >
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg">Environmental Care</h3>
                  <p className="mt-2 text-sm opacity-75">
                    We're committed to protecting marine ecosystems through sustainable
                    diving practices and conservation efforts.
                  </p>
                </div>

                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--primary-color)" }}
                  >
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg">Quality Education</h3>
                  <p className="mt-2 text-sm opacity-75">
                    We provide thorough, personalized instruction to ensure every
                    diver develops proper skills and confidence.
                  </p>
                </div>

                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--primary-color)" }}
                  >
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg">Community</h3>
                  <p className="mt-2 text-sm opacity-75">
                    Join our diving family! We foster a welcoming community of ocean
                    enthusiasts who share their passion for diving.
                  </p>
                </div>
              </div>
            </section>

            {/* Photo Gallery */}
            <section className="mb-16">
              <h2 className="text-2xl font-bold mb-6">Gallery</h2>
              <PhotoGalleryPlaceholder />
              <p className="mt-4 text-sm opacity-50 text-center">
                Photo gallery coming soon
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Certifications & Affiliations */}
            {showCertifications && (
              <section className="mb-12">
                <h2 className="text-xl font-bold mb-6">
                  Certifications & Affiliations
                </h2>
                <div className="space-y-4">
                  {certifications.map((cert) => (
                    <CertificationBadge key={cert.id} certification={cert} />
                  ))}
                </div>
              </section>
            )}

            {/* Quick Contact */}
            <section
              className="p-6 rounded-xl"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              <h3 className="font-semibold text-lg mb-4">Get in Touch</h3>
              <p className="text-sm opacity-75 mb-4">
                Have questions? We'd love to hear from you. Reach out to learn more
                about our diving programs and trips.
              </p>
              <a
                href="/site/contact"
                className="inline-block w-full text-center px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary-color)" }}
              >
                Contact Us
              </a>
            </section>
          </div>
        </div>

        {/* Team Section */}
        {showTeam && (
          <section className="mt-16 pt-16 border-t" style={{ borderColor: "var(--accent-color)" }}>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Meet Our Team</h2>
              <p className="mt-4 text-lg opacity-75 max-w-2xl mx-auto">
                Our experienced and passionate team is here to make your diving
                dreams a reality.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {teamMembers.map((member) => (
                <TeamMemberCard key={member.id} member={member} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
