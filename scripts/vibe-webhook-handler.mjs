#!/usr/bin/env node
/**
 * Vibe Kanban Webhook Handler
 *
 * Listens for Vibe Kanban webhook events and triggers workspace automation
 * when a task is moved to "In Progress".
 *
 * This is a simple HTTP server that receives webhooks from Vibe Kanban
 * and automatically creates workspaces when tasks are moved to "In Progress".
 *
 * Usage:
 *   node scripts/vibe-webhook-handler.mjs
 *   PORT=3001 node scripts/vibe-webhook-handler.mjs
 *
 * Environment Variables:
 *   PORT - Server port (default: 3000)
 *   WEBHOOK_SECRET - Optional secret for webhook verification
 *   VK_API_URL - Vibe Kanban API URL
 *   VK_API_TOKEN - Vibe Kanban API token
 */

import { createServer } from 'http';
import { spawn } from 'child_process';
import { createHmac } from 'crypto';

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function log(emoji, message) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${emoji} ${message}`);
}

function verifyWebhookSignature(body, signature) {
  if (!WEBHOOK_SECRET) {
    return true; // Skip verification if no secret is configured
  }

  const hmac = createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(body).digest('hex');
  return signature === digest;
}

async function handleIssueStatusChange(event) {
  const { issue, previous_status, new_status, workspace_id } = event;

  log('📋', `Issue ${issue.id} status changed: ${previous_status} → ${new_status}`);

  // Only trigger automation when moving TO "In Progress"
  if (new_status === 'In Progress' && previous_status !== 'In Progress') {
    log('🚀', `Triggering workspace automation for issue ${issue.id}`);

    // Extract short ID from issue ID (first 4 chars + next segment)
    const shortId = issue.id.split('-').slice(0, 2).join('-');

    try {
      // Run the workspace automation script
      const child = spawn('npm', ['run', 'vibe:auto', '--', `--issue-id=${shortId}`], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: {
          ...process.env,
          VK_ISSUE_ID: issue.id,
          VK_ISSUE_TITLE: issue.title,
          VK_ISSUE_STATUS: new_status,
          VK_WORKSPACE_ID: workspace_id
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          log('✅', `Workspace automation completed for issue ${issue.id}`);
        } else {
          log('❌', `Workspace automation failed with code ${code}`);
        }
      });
    } catch (error) {
      log('❌', `Failed to trigger automation: ${error.message}`);
    }
  } else if (new_status === 'In Progress') {
    log('ℹ️', `Issue already in progress, skipping automation`);
  } else {
    log('ℹ️', `Status change not relevant for automation: ${new_status}`);
  }
}

async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (req.url !== '/webhook/vibe-kanban') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      // Verify webhook signature if configured
      const signature = req.headers['x-vibe-signature'];
      if (!verifyWebhookSignature(body, signature)) {
        log('⚠️', 'Invalid webhook signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      const event = JSON.parse(body);
      log('📨', `Received webhook: ${event.event_type}`);

      // Handle different event types
      switch (event.event_type) {
        case 'issue.status_changed':
          await handleIssueStatusChange(event);
          break;

        default:
          log('ℹ️', `Unhandled event type: ${event.event_type}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Webhook received' }));
    } catch (error) {
      log('❌', `Error processing webhook: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

const server = createServer(handleWebhook);

server.listen(PORT, () => {
  log('🚀', `Vibe Kanban webhook handler running on port ${PORT}`);
  log('📡', `Webhook endpoint: http://localhost:${PORT}/webhook/vibe-kanban`);
  log('🔐', WEBHOOK_SECRET ? 'Webhook signature verification ENABLED' : 'Webhook signature verification DISABLED');
  log('💡', 'Configure Vibe Kanban to send webhooks to this endpoint');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('👋', 'Shutting down webhook handler...');
  server.close(() => {
    log('✅', 'Server closed');
    process.exit(0);
  });
});
