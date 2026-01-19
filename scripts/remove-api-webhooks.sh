#!/bin/bash
# Script to remove API keys and webhooks references from integrations.tsx
# DIVE-031: Remove deprecated API access and webhooks

FILE="/Users/tomgibson/DiveStreams/divestreams-v2/app/routes/tenant/settings/integrations.tsx"

# Comment out API key and webhook type definitions
sed -i.bak1 's/^type WebhookEventType =.*/\/\/ DIVE-031: Removed - type WebhookEventType/' "$FILE"
sed -i.bak2 's/^interface ApiKeyPermissions {/\/\/ DIVE-031: Removed - interface ApiKeyPermissions {/' "$FILE"
sed -i.bak3 's/^interface ApiKeyDisplay {/\/\/ DIVE-031: Removed - interface ApiKeyDisplay {/' "$FILE"

# Comment out loader API calls
sed -i.bak4 's/const apiKeysList = await listApiKeys/\/\/ DIVE-031: Removed - const apiKeysList = await listApiKeys/' "$FILE"
sed -i.bak5 's/const webhooksList = await listWebhooks/\/\/ DIVE-031: Removed - const webhooksList = await listWebhooks/' "$FILE"

# Comment out return values
sed -i.bak6 's/apiKeys: apiKeysList,/\/\/ DIVE-031: Removed - apiKeys: apiKeysList,/' "$FILE"
sed -i.bak7 's/webhooks: webhooksList,/\/\/ DIVE-031: Removed - webhooks: webhooksList,/' "$FILE"
sed -i.bak8 's/webhookEvents: WEBHOOK_EVENTS,/\/\/ DIVE-031: Removed - webhookEvents: WEBHOOK_EVENTS,/' "$FILE"
sed -i.bak9 's/webhookEventDescriptions: WEBHOOK_EVENT_DESCRIPTIONS,/\/\/ DIVE-031: Removed - webhookEventDescriptions: WEBHOOK_EVENT_DESCRIPTIONS,/' "$FILE"

echo "API keys and webhooks references commented out in integrations.tsx"
echo "Backup files created with .bakN extensions"
