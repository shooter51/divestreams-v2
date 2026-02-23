# Zapier Integration Deployment Checklist

## Pre-Deployment

- [ ] Review all code changes
- [ ] Test locally with Redis running
- [ ] Verify database migration SQL is correct
- [ ] Check environment variables are set

## Database Setup

- [ ] Run migration: `npm run db:migrate`
- [ ] Verify tables created:
  - [ ] `zapier_webhook_subscriptions`
  - [ ] `zapier_webhook_delivery_log`
  - [ ] `zapier_api_keys`
- [ ] Check indexes are created
- [ ] Test API key generation in UI

## Worker Setup

- [ ] Redis is running and accessible
- [ ] Test worker locally: `npm run worker:zapier`
- [ ] Verify worker can connect to Redis
- [ ] Check worker logs for errors
- [ ] Test webhook delivery with sample event

## API Endpoints Testing

### Authentication Test
```bash
# Should return 401 (no API key)
curl https://divestreams.com/api/zapier/test

# Should return organization info (with valid key)
curl -H "X-API-Key: zap_dev_..." \
  https://divestreams.com/api/zapier/test
```

- [ ] Test endpoint returns 401 without API key
- [ ] Test endpoint returns org info with valid API key
- [ ] Invalid API key returns 401

### Triggers Endpoint
```bash
curl -H "X-API-Key: zap_dev_..." \
  https://divestreams.com/api/zapier/triggers
```

- [ ] Returns list of 9 triggers
- [ ] Each trigger has sample data

### Subscribe Endpoint
```bash
# Subscribe
curl -X POST https://divestreams.com/api/zapier/subscribe \
  -H "X-API-Key: zap_dev_..." \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "booking.created",
    "target_url": "https://webhook.site/your-unique-url"
  }'

# Unsubscribe
curl -X DELETE https://divestreams.com/api/zapier/subscribe \
  -H "X-API-Key: zap_dev_..." \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "booking.created",
    "target_url": "https://webhook.site/your-unique-url"
  }'
```

- [ ] Subscribe creates subscription in database
- [ ] Unsubscribe marks subscription inactive
- [ ] Invalid event type returns error

### Action Endpoints

**Create Booking:**
```bash
curl -X POST https://divestreams.com/api/zapier/actions/create-booking \
  -H "X-API-Key: zap_dev_..." \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": "valid_trip_id",
    "customer_email": "test@example.com",
    "participants": 2
  }'
```

- [ ] Creates booking with valid data
- [ ] Returns 404 for invalid trip_id
- [ ] Returns 400 for missing required fields

**Update Customer:**
```bash
curl -X POST https://divestreams.com/api/zapier/actions/update-customer \
  -H "X-API-Key: zap_dev_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "first_name": "Updated",
    "last_name": "Name"
  }'
```

- [ ] Updates customer with valid email
- [ ] Returns 404 for non-existent customer

## Integration Testing

### End-to-End Webhook Flow

1. [ ] Generate API key in UI
2. [ ] Subscribe to webhook using API
3. [ ] Trigger event in application (e.g., create booking)
4. [ ] Verify webhook queued in Redis
5. [ ] Verify worker processes webhook
6. [ ] Check webhook.site for received payload
7. [ ] Verify delivery log in database
8. [ ] Check UI shows delivery in recent activity

### Settings UI Testing

- [ ] Navigate to Settings > Integrations > Zapier
- [ ] Generate new API key
- [ ] Copy key (shown only once)
- [ ] Key appears in list with prefix
- [ ] Revoke key works
- [ ] Statistics show correctly
- [ ] Recent deliveries display
- [ ] Setup instructions visible

## Production Deployment

### Docker Compose Update

Add worker service:
```yaml
zapier-worker:
  image: ghcr.io/shooter51/divestreams-app:latest
  container_name: divestreams-zapier-worker
  command: npm run worker:zapier
  environment:
    - NODE_ENV=production
    - DATABASE_URL=${DATABASE_URL}
    - REDIS_URL=${REDIS_URL}
  depends_on:
    - postgres
    - redis
  restart: unless-stopped
  networks:
    - divestreams-network
```

- [ ] Add worker service to docker-compose.yml
- [ ] Set environment variables
- [ ] Deploy to staging first
- [ ] Test on staging
- [ ] Deploy to production

### Monitoring Setup

- [ ] Worker logs to file or logging service
- [ ] Set up alerts for:
  - [ ] Worker crashes
  - [ ] High webhook failure rate
  - [ ] Queue backup
  - [ ] Redis connection issues
- [ ] Monitor queue size in Redis
- [ ] Track webhook delivery success rate

## Zapier Platform Submission (Optional)

### Zapier CLI Setup

```bash
cd zapier-app
npm install
zapier login
zapier register "DiveStreams"
zapier link
```

- [ ] Zapier CLI installed globally
- [ ] Logged in to Zapier account
- [ ] App registered on platform
- [ ] Local app linked

### Testing in Zapier

- [ ] Test authentication with real API key
- [ ] Test all 3 triggers in Zapier editor
- [ ] Test both actions in Zapier editor
- [ ] Create sample Zaps for each trigger
- [ ] Verify sample data displays correctly

### Submission Checklist

- [ ] All triggers tested
- [ ] All actions tested
- [ ] Error handling tested
- [ ] Documentation complete
- [ ] Logo uploaded (256x256)
- [ ] Screenshots added (minimum 3)
- [ ] App description written
- [ ] Category selected
- [ ] Test account credentials provided
- [ ] Submit for review

## Post-Deployment Verification

### Immediate Checks (First Hour)

- [ ] Worker is running (check logs)
- [ ] No errors in worker logs
- [ ] Settings page loads correctly
- [ ] Can generate API key
- [ ] Test webhook delivery works
- [ ] Queue is processing

### First Day Checks

- [ ] Monitor webhook delivery success rate
- [ ] Check for any error patterns
- [ ] Verify worker stays running
- [ ] Monitor Redis queue size
- [ ] Check database performance
- [ ] Review delivery logs

### First Week Checks

- [ ] Gather user feedback
- [ ] Monitor usage patterns
- [ ] Check for any rate limiting issues
- [ ] Review failed webhook reasons
- [ ] Optimize if needed

## Rollback Plan

If issues occur:

1. **Disable Zapier Integration:**
   ```sql
   UPDATE zapier_webhook_subscriptions SET is_active = false;
   ```

2. **Stop Worker:**
   ```bash
   docker stop divestreams-zapier-worker
   ```

3. **Fix Issues:**
   - Review error logs
   - Fix code or configuration
   - Test locally

4. **Redeploy:**
   - Deploy fixed version
   - Restart worker
   - Re-enable subscriptions

## Success Metrics

After 1 week, track:
- [ ] Number of organizations using Zapier
- [ ] Total webhook subscriptions
- [ ] Webhook delivery success rate (target: >95%)
- [ ] Average delivery time (target: <5 seconds)
- [ ] Number of Zaps created
- [ ] User feedback/support tickets

## Common Issues & Solutions

### Worker Won't Start
- Check Redis connection string
- Verify DATABASE_URL is set
- Check Redis is running
- Review worker logs

### Webhooks Not Delivering
- Check worker is running
- Verify subscription is active
- Check target URL is valid HTTPS
- Review delivery logs for errors

### High Failure Rate
- Check target URLs are responding
- Verify Zapier service is up
- Review error messages in logs
- Consider increasing retry attempts

### Queue Backing Up
- Check worker is processing
- Increase worker concurrency
- Add more worker instances
- Review slow webhook endpoints

## Support Resources

- **User Guide:** `/docs/zapier-integration.md`
- **Developer Guide:** `/docs/zapier-usage-examples.ts`
- **Implementation Summary:** `/docs/ZAPIER_IMPLEMENTATION_SUMMARY.md`
- **Quick Start:** `/docs/ZAPIER_QUICK_START.md`

## Sign-Off

- [ ] Database migration complete
- [ ] Worker deployed and running
- [ ] API endpoints tested
- [ ] Settings UI verified
- [ ] Documentation reviewed
- [ ] Monitoring in place
- [ ] Team trained
- [ ] Ready for production use

**Deployment Date:** _____________

**Deployed By:** _____________

**Sign-Off:** _____________
