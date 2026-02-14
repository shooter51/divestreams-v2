import { useState } from "react";
import { useFetcher } from "react-router";
import { Icons } from "./Icons";

interface WhatsAppIntegrationProps {
  isConnected: boolean;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
}

export function WhatsAppIntegration({
  isConnected,
  onNotification,
}: WhatsAppIntegrationProps) {
  const fetcher = useFetcher();

  // Connect modal state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [apiType, setApiType] = useState<"meta" | "twilio" | "">("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioNumber, setTwilioNumber] = useState("");

  // Test WhatsApp modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testNumber, setTestNumber] = useState("");

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  if (fetcherData && "showWhatsAppModal" in fetcherData && fetcherData.showWhatsAppModal) {
    if (!showConnectModal) setShowConnectModal(true);
  }

  if (fetcherData && "success" in fetcherData && fetcherData.success && "message" in fetcherData) {
    if (showConnectModal || showTestModal) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowConnectModal(false);
      setShowTestModal(false);
      setApiType("");
      setPhoneNumberId("");
      setBusinessAccountId("");
      setAccessToken("");
      setTwilioAccountSid("");
      setTwilioAuthToken("");
      setTwilioNumber("");
      setTestNumber("");
    }
  }

  if (fetcherData && "error" in fetcherData && !("success" in fetcherData)) {
    onNotification({ type: "error", message: fetcherData.error as string });
  }

  return (
    <>
      {/* Connected state: Test message button */}
      {isConnected && (
        <button
          type="button"
          onClick={() => setShowTestModal(true)}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
        >
          Send Test Message
        </button>
      )}

      {/* WhatsApp Business Configuration Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect WhatsApp Business</h2>
                <p className="text-sm text-foreground-muted">
                  Choose your WhatsApp Business API provider
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
              <input type="hidden" name="intent" value="connectWhatsApp" />

              {/* API Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Provider <span className="text-danger">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-colors \${
                      apiType === "meta"
                        ? "border-brand bg-brand-muted"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="apiType"
                      value="meta"
                      checked={apiType === "meta"}
                      onChange={() => setApiType("meta")}
                      className="sr-only"
                    />
                    <Icons.MessageCircle className="w-8 h-8 text-success mb-1" />
                    <span className="text-sm font-medium">Meta Business API</span>
                    <span className="text-xs text-foreground-muted text-center mt-1">
                      Direct from Meta
                    </span>
                  </label>
                  <label
                    className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-colors \${
                      apiType === "twilio"
                        ? "border-brand bg-brand-muted"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="apiType"
                      value="twilio"
                      checked={apiType === "twilio"}
                      onChange={() => setApiType("twilio")}
                      className="sr-only"
                    />
                    <Icons.MessageSquare className="w-8 h-8 text-danger mb-1" />
                    <span className="text-sm font-medium">Twilio WhatsApp</span>
                    <span className="text-xs text-foreground-muted text-center mt-1">
                      Via Twilio
                    </span>
                  </label>
                </div>
              </div>

              {/* Meta Business API Fields */}
              {apiType === "meta" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Phone Number ID <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="phoneNumberId"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="123456789012345"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                      required={apiType === "meta"}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      From Meta Business Suite &gt; WhatsApp &gt; Settings
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Business Account ID <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessAccountId"
                      value={businessAccountId}
                      onChange={(e) => setBusinessAccountId(e.target.value)}
                      placeholder="123456789012345"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                      required={apiType === "meta"}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      Your WhatsApp Business Account ID
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Access Token <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      name="accessToken"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Your permanent access token"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                      required={apiType === "meta"}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      System user access token with whatsapp_business_messaging permission
                    </p>
                  </div>

                  <div className="bg-brand-muted border border-brand rounded-lg p-3">
                    <p className="text-sm text-brand">
                      <strong>Setup Guide:</strong> Create a system user in Meta Business Settings,
                      generate a permanent token, and add the whatsapp_business_messaging permission.{" "}
                      <a
                        href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        Learn more
                      </a>
                    </p>
                  </div>
                </>
              )}

              {/* Twilio WhatsApp Fields */}
              {apiType === "twilio" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Account SID <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="twilioAccountSid"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                      required={apiType === "twilio"}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      From your Twilio Console Dashboard
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Auth Token <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      name="twilioAuthToken"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      placeholder="Your Twilio Auth Token"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                      required={apiType === "twilio"}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      This will be encrypted and stored securely
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      WhatsApp Number <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      name="twilioWhatsAppNumber"
                      value={twilioNumber}
                      onChange={(e) => setTwilioNumber(e.target.value)}
                      placeholder="+14155238886"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                      required={apiType === "twilio"}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      Your Twilio WhatsApp-enabled phone number
                    </p>
                  </div>

                  <div className="bg-brand-muted border border-brand rounded-lg p-3">
                    <p className="text-sm text-brand">
                      <strong>Note:</strong> You can use Twilio's sandbox number for testing.
                      For production, you'll need a Twilio-approved WhatsApp sender.{" "}
                      <a
                        href="https://www.twilio.com/docs/whatsapp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        Learn more
                      </a>
                    </p>
                  </div>
                </>
              )}

              <div className="bg-warning-muted border border-warning rounded-lg max-w-4xl break-words p-3">
                <p className="text-sm text-warning">
                  <strong>Important:</strong> WhatsApp Business has a 24-hour messaging window.
                  You can only send freeform messages to customers who have messaged you in the last 24 hours.
                  For proactive messages, use pre-approved message templates.
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
                  disabled={fetcher.state !== "idle" || !apiType}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect WhatsApp"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Test WhatsApp Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Send Test WhatsApp Message</h2>
                <p className="text-sm text-foreground-muted">
                  Send a test message to verify your WhatsApp integration
                </p>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="testWhatsApp" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  WhatsApp number to send test message to (must have opted-in)
                </p>
              </div>

              <div className="bg-warning-muted border border-warning rounded-lg max-w-4xl break-words p-3">
                <p className="text-sm text-warning">
                  <strong>Note:</strong> The recipient must have sent a message to your WhatsApp
                  Business number in the last 24 hours to receive freeform messages.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
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
