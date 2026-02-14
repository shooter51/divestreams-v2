import { useState } from "react";
import { useFetcher } from "react-router";
import { Icons } from "./Icons";

interface TwilioIntegrationProps {
  isConnected: boolean;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
}

export function TwilioIntegration({
  isConnected,
  onNotification,
}: TwilioIntegrationProps) {
  const fetcher = useFetcher();

  // Connect modal state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messagingServiceSid, setMessagingServiceSid] = useState("");

  // Test SMS modal state
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [testSmsNumber, setTestSmsNumber] = useState("");

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  if (fetcherData && "showTwilioModal" in fetcherData && fetcherData.showTwilioModal) {
    if (!showConnectModal) setShowConnectModal(true);
  }

  if (fetcherData && "success" in fetcherData && fetcherData.success && "message" in fetcherData) {
    if (showConnectModal || showTestSmsModal) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowConnectModal(false);
      setShowTestSmsModal(false);
      setAccountSid("");
      setAuthToken("");
      setPhoneNumber("");
      setMessagingServiceSid("");
      setTestSmsNumber("");
    }
  }

  if (fetcherData && "error" in fetcherData && !("success" in fetcherData)) {
    onNotification({ type: "error", message: fetcherData.error as string });
  }

  return (
    <>
      {/* Connected state: Test SMS button */}
      {isConnected && (
        <button
          type="button"
          onClick={() => setShowTestSmsModal(true)}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
        >
          Send Test SMS
        </button>
      )}

      {/* Twilio Configuration Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Twilio SMS</h2>
                <p className="text-sm text-foreground-muted">
                  Enter your Twilio credentials to enable SMS notifications
                </p>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectTwilio" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Account SID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="accountSid"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Find this in your Twilio Console Dashboard
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Auth Token <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="authToken"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Your Twilio phone number in E.164 format
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Messaging Service SID (Optional)
                </label>
                <input
                  type="text"
                  name="messagingServiceSid"
                  value={messagingServiceSid}
                  onChange={(e) => setMessagingServiceSid(e.target.value)}
                  placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  If using a Messaging Service instead of a phone number
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>Note:</strong> Get your credentials from the{" "}
                  <a
                    href="https://console.twilio.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Twilio Console
                  </a>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect Twilio"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Test SMS Modal */}
      {showTestSmsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Send Test SMS</h2>
                <p className="text-sm text-foreground-muted">
                  Send a test message to verify your Twilio integration
                </p>
              </div>
              <button
                onClick={() => setShowTestSmsModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="testSMS" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={testSmsNumber}
                  onChange={(e) => setTestSmsNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Phone number to send test message to
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestSmsModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Sending..." : "Send Test"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </>
  );
}
