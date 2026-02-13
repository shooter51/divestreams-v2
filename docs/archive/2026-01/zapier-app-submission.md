# Zapier App Submission Guide

## Prerequisites

Before submitting the DiveStreams app to Zapier:

1. **Zapier Developer Account**: Sign up at https://developer.zapier.com
2. **Zapier CLI**: Install globally
   ```bash
   npm install -g zapier-platform-cli
   ```
3. **Test Account**: Create a test DiveStreams organization with sample data

## Development Setup

### 1. Install Dependencies

```bash
cd zapier-app
npm install
```

### 2. Login to Zapier CLI

```bash
zapier login
```

### 3. Register the App

```bash
zapier register "DiveStreams"
```

This creates a new integration in your Zapier account.

### 4. Link Local App

```bash
zapier link
```

Select the "DiveStreams" integration you just created.

## Testing

### 1. Run Tests Locally

```bash
cd zapier-app
zapier test
```

### 2. Validate the App

```bash
zapier validate
```

This checks for common issues before pushing.

### 3. Manual Testing

```bash
# Push to Zapier (creates a private version)
zapier push

# Test in the Zapier editor
# Go to https://zapier.com/app/editor
# Create a test Zap using your private integration
```

## Required Testing Checklist

Before submission, test all features:

### Triggers

- [ ] New Booking trigger fires correctly
- [ ] Payment Received trigger fires correctly
- [ ] New Customer trigger fires correctly
- [ ] Webhook subscription works
- [ ] Webhook unsubscription works
- [ ] Sample data displays correctly

### Actions

- [ ] Create Booking action works
- [ ] Update Customer action works
- [ ] Error handling works (invalid data)
- [ ] Field validation works

### Authentication

- [ ] API key authentication works
- [ ] Test endpoint validates keys correctly
- [ ] Connection label displays correctly
- [ ] Invalid keys are rejected

## App Metadata

Update these in the Zapier Developer Platform:

### Basic Info
- **Name**: DiveStreams
- **Description**: Dive shop and tour management platform
- **Category**: CRM, Booking, Business Management
- **Logo**: Upload 256x256 PNG logo
- **Intended Audience**: Dive shops, dive tour operators, watersports businesses

### Links
- **Homepage**: https://divestreams.com
- **Documentation**: https://docs.divestreams.com/integrations/zapier
- **Support Email**: support@divestreams.com
- **Privacy Policy**: https://divestreams.com/privacy
- **Terms of Service**: https://divestreams.com/terms

## Submission Checklist

Before submitting for review:

### Code Quality
- [ ] All triggers have meaningful descriptions
- [ ] All actions have clear field labels
- [ ] Sample data is realistic
- [ ] Error messages are helpful
- [ ] Code is well-commented

### Documentation
- [ ] User documentation is complete
- [ ] API endpoint documentation exists
- [ ] Example workflows are provided
- [ ] Setup instructions are clear

### Testing
- [ ] All triggers tested with real data
- [ ] All actions tested with real data
- [ ] Authentication tested
- [ ] Error cases tested
- [ ] Webhook subscriptions tested

### Branding
- [ ] Logo uploaded (256x256)
- [ ] Screenshots added (min 3)
- [ ] App description is clear
- [ ] Category is correct

## Submit for Review

1. **Push Final Version**
   ```bash
   zapier push
   ```

2. **Promote to Public**
   - Go to https://developer.zapier.com
   - Select your DiveStreams integration
   - Click "Promote to Public"
   - Fill out the submission form

3. **Submit for Review**
   - Provide test account credentials
   - Include testing instructions
   - Wait for Zapier team review (usually 1-2 weeks)

## Review Process

Zapier will test:
- Authentication flow
- All triggers
- All actions
- Error handling
- Documentation quality

Common rejection reasons:
- Missing error handling
- Poor error messages
- Incomplete documentation
- Broken triggers/actions
- Missing sample data

## After Approval

Once approved:
1. Integration goes live in Zapier App Directory
2. Users can discover and use it
3. Monitor usage in Zapier Analytics
4. Respond to user feedback

## Updating the Integration

To push updates:

```bash
# Make changes to code
# Test locally
zapier test

# Push new version
zapier push

# Promote new version (doesn't require re-review for minor updates)
zapier promote [version]
```

## API Endpoints Reference

Ensure these are working before submission:

- `GET /api/zapier/test` - Test authentication
- `GET /api/zapier/triggers` - List available triggers
- `POST /api/zapier/subscribe` - Subscribe to webhook
- `DELETE /api/zapier/subscribe` - Unsubscribe from webhook
- `POST /api/zapier/actions/create-booking` - Create booking action
- `POST /api/zapier/actions/update-customer` - Update customer action

## Support During Review

Be prepared to:
- Respond to reviewer questions within 48 hours
- Provide test data if needed
- Fix issues quickly
- Update documentation as requested

## Post-Launch

After launch:
1. Monitor webhook delivery logs
2. Track API usage
3. Respond to user support requests
4. Add new triggers/actions based on feedback
5. Keep documentation updated

## Version Management

Zapier uses semantic versioning:
- **Major**: Breaking changes (requires migration)
- **Minor**: New features (backwards compatible)
- **Patch**: Bug fixes

Example workflow:
```bash
# Increment version in package.json
# 1.0.0 -> 1.1.0 (new trigger)

zapier push
zapier promote 1.1.0
```

## Resources

- Zapier CLI Docs: https://platform.zapier.com/cli_docs/docs
- Platform Reference: https://platform.zapier.com/reference
- Best Practices: https://platform.zapier.com/partners/planning-guide
- Developer Community: https://community.zapier.com/developers-f9
