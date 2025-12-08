# Meta Conversions API Integration - Setup Guide

## Overview

This integration automatically sends conversion events to Meta (Facebook) Conversions API whenever a deal moves into specific stages within your CRM pipelines. This enables accurate tracking of your sales funnel in Meta Ads Manager for better campaign optimization and reporting.

## Features

- ✅ **Configurable Event Mapping**: Map any pipeline stage to a custom Meta event name
- ✅ **Queued Processing**: Non-blocking background job processing for reliability
- ✅ **Multi-tenant Support**: Company-scoped triggers for data isolation
- ✅ **Privacy Compliant**: SHA256 hashing of user data before sending to Meta
- ✅ **Detailed Logging**: Full request/response logging for debugging
- ✅ **Error Resilience**: Meta API failures don't block deal updates
- ✅ **Automatic Retry**: Failed jobs are retried up to 3 times with backoff

## Installation Steps

### 1. Environment Configuration

Add the following variables to your `.env` file:

```env
META_PIXEL_ID=your_pixel_id_here
META_ACCESS_TOKEN=your_access_token_here
META_CONVERSIONS_API_VERSION=v18.0
```

**How to get these credentials:**

1. **Pixel ID**: Go to Meta Events Manager → Select your Pixel → Settings → Pixel ID
2. **Access Token**: Events Manager → Settings → Conversions API → Generate Access Token

### 2. Database Migration

The migration has already been run, creating the `meta_conversion_triggers` table with the following structure:

- `id` - Primary key
- `lead_pipeline_id` - Pipeline this trigger belongs to
- `lead_pipeline_stage_id` - Stage that triggers the event
- `event_name` - Meta event name to send
- `active` - Enable/disable the trigger
- `company_id` - Company scope for multi-tenancy
- `created_at`, `updated_at` - Timestamps

### 3. Queue Worker Setup

Ensure your Laravel queue worker is running to process the background jobs:

```bash
php artisan queue:work
```

For production, set up a supervisor or systemd service to keep the queue worker running.

## Usage

### Creating Conversion Triggers

You can create triggers programmatically or via database:

#### Option 1: PHP/Tinker

```php
use App\Models\MetaConversionTrigger;

MetaConversionTrigger::create([
    'lead_pipeline_id' => 1,           // Your Sales Pipeline ID
    'lead_pipeline_stage_id' => 5,    // "Qualified" Stage ID
    'event_name' => 'qualified',       // Meta event name
    'active' => true,
    'company_id' => 1,
]);
```

#### Option 2: Direct Database Insert

```sql
INSERT INTO meta_conversion_triggers 
(lead_pipeline_id, lead_pipeline_stage_id, event_name, active, company_id, created_at, updated_at)
VALUES 
(1, 5, 'qualified', 1, 1, NOW(), NOW());
```

### Example Workflow Rules

Here are common conversion events you might want to track:

| Pipeline | Stage | Meta Event Name | Description |
|----------|-------|----------------|-------------|
| Sales Pipeline | Lead Qualified | `Lead` | Standard Meta Lead event |
| Sales Pipeline | Proposal Sent | `InitiateCheckout` | Deal entering checkout phase |
| Sales Pipeline | Deal Won | `Purchase` | Completed purchase |
| Real Estate | Viewing Scheduled | `Schedule` | Property viewing scheduled |
| Real Estate | Offer Made | `AddToCart` | Customer made an offer |
| Real Estate | Contract Signed | `Purchase` | Deal closed |

### How It Works

1. **Deal Stage Change**: When a deal's `pipeline_stage_id` is updated
2. **Trigger Lookup**: System checks for active `MetaConversionTrigger` matching the new stage
3. **Job Dispatch**: If found, `SendMetaConversionEventJob` is queued
4. **Background Processing**: Job sends event to Meta Conversions API
5. **Logging**: Full details logged to `storage/logs/laravel.log`

### Data Sent to Meta

For each conversion event, the following data is sent:

**User Data (SHA256 Hashed):**
- Email (from deal contact)
- Phone (from deal contact)
- First name (from deal contact)
- Last name (from deal contact)

**Custom Data:**
- Deal value (amount)
- Currency (from deal)
- Content name (deal name)
- Content ID (deal ID)

**Event Metadata:**
- Event name (from trigger)
- Event time (timestamp)
- Action source (`website`)
- Event source URL

## Monitoring & Debugging

### Check Logs

All Meta Conversions API interactions are logged with full details:

```bash
tail -f storage/logs/laravel.log | grep "Meta Conversion"
```

### Log Entries Include:

1. **Job Dispatch**: When job is queued
2. **API Request**: Full payload sent to Meta
3. **API Response**: Status code and response body
4. **Errors**: Any failures with exception details

### Verify in Meta Events Manager

1. Go to Meta Events Manager
2. Select your Pixel
3. Click "Test Events" or "Events" tab
4. You should see your custom events appearing in real-time

## Troubleshooting

### Events Not Appearing in Meta

**Check 1: Credentials**
```bash
php artisan tinker
>>> config('services.meta.pixel_id')
>>> config('services.meta.access_token')
```

**Check 2: Queue Worker**
```bash
php artisan queue:work --once
```

**Check 3: Logs**
```bash
grep "Meta Conversion" storage/logs/laravel.log
```

### Common Issues

1. **"Meta Conversions API credentials not configured"**
   - Solution: Add `META_PIXEL_ID` and `META_ACCESS_TOKEN` to `.env`

2. **Jobs not processing**
   - Solution: Ensure queue worker is running: `php artisan queue:work`

3. **Meta API returns error**
   - Check access token hasn't expired
   - Verify pixel ID is correct
   - Check Meta Events Manager for specific error details

## API Integration Details

### Endpoint

```
POST https://graph.facebook.com/v18.0/{pixel-id}/events
```

### Payload Structure

```json
{
  "data": [{
    "event_name": "qualified",
    "event_time": 1700000000,
    "action_source": "website",
    "event_source_url": "https://yourcrm.com/deals/123",
    "user_data": {
      "em": "7d5d...hash...",
      "ph": "4a3c...hash...",
      "fn": "9b8e...hash...",
      "ln": "2c1a...hash..."
    },
    "custom_data": {
      "value": 50000,
      "currency": "USD",
      "content_name": "Enterprise Deal",
      "content_ids": ["123"]
    }
  }],
  "access_token": "your_access_token"
}
```

## Security & Privacy

### Data Hashing

All personally identifiable information (PII) is hashed using SHA256 before sending to Meta:
- Email addresses
- Phone numbers  
- First and last names

### Multi-tenant Isolation

Triggers are company-scoped, ensuring:
- Each company can only trigger events for their own deals
- No cross-company data leakage
- Independent configuration per tenant

## Performance Considerations

- **Non-blocking**: Events are sent via queued jobs, deal updates are never delayed
- **Retry Logic**: Failed jobs retry up to 3 times with 10-second backoff
- **Timeout**: HTTP requests timeout after 30 seconds
- **Error Handling**: Meta API failures are logged but don't cause job failures

## Future Enhancements

Potential features for future implementation:

- [ ] Admin UI for managing triggers (CRUD operations)
- [ ] Event delivery status dashboard
- [ ] Bulk event resending capability
- [ ] Custom field mapping configuration
- [ ] Support for additional Meta event parameters
- [ ] Webhook for Meta to confirm event receipt

## Support

For issues or questions:
1. Check logs: `storage/logs/laravel.log`
2. Review Meta Events Manager for API errors
3. Consult Meta Conversions API documentation: https://developers.facebook.com/docs/marketing-api/conversions-api

## Files Created/Modified

### New Files
- `app/Models/MetaConversionTrigger.php` - Model for trigger configuration
- `app/Services/MetaConversionsService.php` - Meta API service
- `app/Jobs/SendMetaConversionEventJob.php` - Background job
- `database/migrations/2025_11_24_144846_create_meta_conversion_triggers_table.php` - Database schema

### Modified Files
- `app/Observers/DealObserver.php` - Added trigger detection
- `config/services.php` - Added Meta configuration
- `CHANGELOG.md` - Documented changes

## Version

- **Integration Version**: 1.0.0
- **Meta API Version**: v18.0
- **Laravel Version**: 10.x
- **Implementation Date**: November 24, 2025

