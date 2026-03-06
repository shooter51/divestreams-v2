export default function ToursSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Tours</h1>
      <p className="text-foreground-muted mb-6">
        Tours are the templates for the dive experiences your shop offers. Each tour defines what the experience is, how much it costs, and what&rsquo;s included. You then schedule trips based on these tours.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/tours-list.png"
        alt="Tours list view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Creating a Tour</h2>
      <p className="text-foreground-muted mb-4">
        Click <strong>New Tour</strong> to create a tour. Fill in the following:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Name</strong> &mdash; a descriptive title (e.g., &ldquo;Two-Tank Morning Dive&rdquo;)</li>
        <li><strong>Type</strong> &mdash; single dive, multi-dive, course, snorkel, freediving, whale shark, or technical</li>
        <li><strong>Price</strong> &mdash; the base price per participant</li>
        <li><strong>Duration</strong> &mdash; how long the experience lasts (in hours)</li>
        <li><strong>Max Participants</strong> &mdash; the default maximum group size</li>
        <li><strong>Inclusions</strong> &mdash; what&rsquo;s included (gear, food, transport, etc.)</li>
        <li><strong>Dive Sites</strong> &mdash; link to the sites you visit on this tour</li>
        <li><strong>Images</strong> &mdash; upload photos to showcase the experience</li>
      </ul>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/tour-detail.png"
        alt="Tour detail view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Tour Types</h2>
      <p className="text-foreground-muted mb-4">
        DiveStreams supports seven tour types. Choosing the right type helps with reporting and lets customers filter experiences on your public site:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Single Dive</strong> &mdash; a one-tank dive outing</li>
        <li><strong>Multi-Dive</strong> &mdash; two or more tanks in a single outing</li>
        <li><strong>Course</strong> &mdash; a certification or training program</li>
        <li><strong>Snorkel</strong> &mdash; snorkeling experience (no scuba required)</li>
        <li><strong>Freediving</strong> &mdash; breath-hold diving experience</li>
        <li><strong>Whale Shark</strong> &mdash; whale shark encounter trip</li>
        <li><strong>Technical</strong> &mdash; advanced technical diving</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Duplicating Tours</h2>
      <p className="text-foreground-muted mb-4">
        If you offer similar experiences with slight variations (e.g., morning vs. afternoon), use the <strong>Duplicate</strong> action on an existing tour. This copies all details so you only need to change what&rsquo;s different.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Add high-quality photos to your tours &mdash; they appear on your public booking site and help drive conversions.
        </p>
      </div>
    </div>
  );
}
