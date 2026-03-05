export default function TrainingSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Training</h1>
      <p className="text-foreground-muted mb-6">
        Manage dive courses, track student progress, schedule training sessions, and issue certifications — all from one place.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/training-dashboard.png"
        alt="Training dashboard"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Courses</h2>
      <p className="text-foreground-muted mb-4">
        Create course templates for every certification level you offer — Open Water, Advanced, Rescue Diver, Divemaster, and custom courses. Each course defines:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Title &amp; description</strong> &mdash; what students learn</li>
        <li><strong>Duration</strong> &mdash; number of days or sessions</li>
        <li><strong>Prerequisites</strong> &mdash; certification level required to enrol</li>
        <li><strong>Price</strong> &mdash; course fee charged to students</li>
        <li><strong>Max students</strong> &mdash; class size limit</li>
        <li><strong>Public visibility</strong> &mdash; whether the course appears on your public booking page</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Sessions</h2>
      <p className="text-foreground-muted mb-4">
        Schedule sessions for each course — these are the actual class dates. A session links a course to a date, time, location, and instructor. Students enrol into sessions, not directly into courses.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Enrolments</h2>
      <p className="text-foreground-muted mb-4">
        When a student books a training session, an enrolment record is created. From the enrolment you can track:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li>Attendance per session</li>
        <li>Theory exam results</li>
        <li>Open water skills sign-offs</li>
        <li>Certification issued date and number</li>
      </ul>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Use the <strong>Make Public</strong> toggle on the courses list to control which courses appear on your public booking page without navigating into each course.
        </p>
      </div>
    </div>
  );
}
