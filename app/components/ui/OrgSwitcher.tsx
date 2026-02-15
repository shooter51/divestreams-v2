import { useState } from "react";

type Org = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

type Props = {
  currentOrg: Org;
  userOrgs: Org[];
};

/**
 * OrgSwitcher component for switching between organizations.
 * If user belongs to only one org, just displays the org name.
 * If multiple orgs, shows a dropdown to switch between them.
 */
export function OrgSwitcher({ currentOrg, userOrgs }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // If user only has one org, just show the name without dropdown
  if (userOrgs.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <OrgAvatar org={currentOrg} size="sm" />
        <span className="font-medium text-foreground">{currentOrg.name}</span>
      </div>
    );
  }

  const handleOrgSwitch = (org: Org) => {
    if (org.id === currentOrg.id) {
      setIsOpen(false);
      return;
    }

    // Get current protocol and host
    const protocol = window.location.protocol;
    const currentHost = window.location.host;

    // Parse current host to replace subdomain
    const hostParts = currentHost.split(".");

    // Replace subdomain with new org's slug
    // Handle both "subdomain.domain.com" and "subdomain.domain.com:port"
    if (hostParts.length >= 2) {
      hostParts[0] = org.slug;
    }

    const newHost = hostParts.join(".");
    const newUrl = `${protocol}//${newHost}/app`;

    // Navigate to new org's subdomain
    window.location.href = newUrl;
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-overlay transition-colors"
      >
        <OrgAvatar org={currentOrg} size="sm" />
        <span className="font-medium text-foreground">{currentOrg.name}</span>
        <ChevronDownIcon className={`w-4 h-4 text-foreground-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay to close dropdown on click outside */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute left-0 top-full mt-1 w-64 bg-surface-raised rounded-lg shadow-lg border border-border py-1 z-20">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-foreground-muted uppercase font-medium">Switch Organization</p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {userOrgs.map((org) => {
                const isCurrentOrg = org.id === currentOrg.id;

                return (
                  <button
                    key={org.id}
                    onClick={() => handleOrgSwitch(org)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isCurrentOrg
                        ? "bg-brand-muted"
                        : "hover:bg-surface-inset"
                    }`}
                  >
                    <OrgAvatar org={org} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isCurrentOrg ? "text-brand" : "text-foreground"}`}>
                        {org.name}
                      </p>
                      <p className="text-xs text-foreground-muted truncate">{org.slug}</p>
                    </div>
                    {isCurrentOrg && (
                      <CheckIcon className="w-5 h-5 text-brand flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Organization avatar - shows logo or initial
 */
function OrgAvatar({ org, size = "md" }: { org: Org; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";

  if (org.logo) {
    return (
      <img
        src={org.logo}
        alt={org.name}
        className={`${sizeClasses} rounded-md object-cover`}
      />
    );
  }

  // Generate a color based on org name for consistent avatar colors
  const colors = [
    "bg-brand",
    "bg-success",
    "bg-info",
    "bg-accent",
    "bg-warning",
    "bg-danger",
    "bg-brand-hover",
    "bg-info-hover",
  ];
  const colorIndex = org.name.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  const initial = org.name.charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeClasses} ${bgColor} rounded-md flex items-center justify-center text-white font-medium`}
    >
      {initial}
    </div>
  );
}

/**
 * Chevron down icon
 */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * Check icon for selected org
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
