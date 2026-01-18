#!/usr/bin/env python3
"""
Script to remove API keys and webhooks from integrations.tsx
DIVE-031: Remove deprecated API access and webhooks
"""

import re

FILE_PATH = "/Users/tomgibson/DiveStreams/divestreams-v2/app/routes/tenant/settings/integrations.tsx"

def main():
    with open(FILE_PATH, 'r') as f:
        content = f.read()

    original_content = content

    # Remove type definitions
    content = re.sub(
        r'type WebhookEventType = .*?;',
        '// DIVE-031: Removed WebhookEventType',
        content,
        flags=re.DOTALL
    )

    content = re.sub(
        r'interface ApiKeyPermissions \{.*?\}',
        '// DIVE-031: Removed ApiKeyPermissions interface',
        content,
        flags=re.DOTALL
    )

    content = re.sub(
        r'interface ApiKeyDisplay \{.*?\}',
        '// DIVE-031: Removed ApiKeyDisplay interface',
        content,
        flags=re.DOTALL
    )

    # Remove loader code for API keys and webhooks
    content = re.sub(
        r'const apiKeysList = await listApiKeys\(ctx\.org\.id\);',
        '// DIVE-031: Removed API keys loading',
        content
    )

    content = re.sub(
        r'const webhooksList = await listWebhooks\(ctx\.org\.id\);',
        '// DIVE-031: Removed webhooks loading',
        content
    )

    # Remove from return statement
    content = re.sub(r'apiKeys: apiKeysList,', '// DIVE-031: Removed apiKeys', content)
    content = re.sub(r'webhooks: webhooksList,', '// DIVE-031: Removed webhooks', content)
    content = re.sub(r'webhookEvents: WEBHOOK_EVENTS,', '// DIVE-031: Removed webhookEvents', content)
    content = re.sub(r'webhookEventDescriptions: WEBHOOK_EVENT_DESCRIPTIONS,', '// DIVE-031: Removed webhookEventDescriptions', content)

    # Remove API key action handlers
    content = re.sub(
        r'// API Key actions.*?if \(intent === "revokeApiKey"\) \{.*?\}',
        '// DIVE-031: Removed API key action handlers',
        content,
        flags=re.DOTALL
    )

    # Remove webhook action handlers
    content = re.sub(
        r'if \(intent === "createWebhook"\) \{.*?if \(intent === "regenerateWebhookSecret"\) \{.*?\}',
        '// DIVE-031: Removed webhook action handlers',
        content,
        flags=re.DOTALL
    )

    # Remove destructured variables
    content = re.sub(r'apiKeys,\s*', '', content)
    content = re.sub(r'webhooks,\s*', '', content)
    content = re.sub(r'webhookEvents,\s*', '', content)
    content = re.sub(r'webhookEventDescriptions,\s*', '', content)

    # Write back
    if content != original_content:
        with open(FILE_PATH, 'w') as f:
            f.write(content)
        print("Successfully removed API keys and webhooks code from integrations.tsx")
    else:
        print("No changes made - patterns may have already been removed")

if __name__ == '__main__':
    main()
