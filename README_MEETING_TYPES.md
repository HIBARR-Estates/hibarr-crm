# Meeting Types and n8n Integration

This feature adds meeting types to follow-ups and integrates with n8n for automated meeting creation.

## Features

- **Meeting Types**: Create and manage different types of meetings (Kick Off, Strategy, Review, etc.)
- **Location Support**: Choose meeting location (Office, Zoom, Zoho Meet, Google Meet)
- **Meeting Link Management**: Automatic meeting link generation and storage
- **Follow-up Enhancement**: Add meeting type and location selection when creating follow-ups
- **n8n Integration**: Automatically trigger n8n workflows when follow-ups are created/updated
- **Webhook Response Handling**: Automatically update meeting links from n8n webhook responses
- **Unlimited Follow-ups**: No limit on the number of follow-ups per deal

## Installation

### 1. Run Migrations

```bash
php artisan migrate
```

### 2. Seed Default Meeting Types

```bash
php artisan db:seed --class=MeetingTypeSeeder
```

### 3. Configure Environment Variables

Add the following to your `.env` file:

```env
# n8n Webhook URLs
FOLLOWUP_WEBHOOK_URL=https://your-n8n-instance.com/webhook/followup
DEAL_CREATE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/deal-create
DEAL_UPDATE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/deal-update
```

## Usage

### Creating Follow-ups with Meeting Types and Location

1. Navigate to a deal
2. Click on the "Follow Up" tab
3. Click "New Follow Up"
4. Select a meeting type from the dropdown
5. Choose meeting location (Office, Zoom, Zoho Meet, Google Meet)
6. If online platform is selected, meeting link field will appear
7. Fill in other details and save

### Managing Meeting Types

1. Navigate to `/meeting-types` (admin only)
2. Create, edit, or delete meeting types
3. Customize colors and descriptions

### n8n Integration

When a follow-up is created or updated, the system will:

1. Send a webhook to your n8n instance
2. Include meeting type information
3. Provide deal and contact details
4. **Wait for a proper response from n8n**
5. **Only save the follow-up if n8n returns a success response**
6. **Rollback the transaction if n8n fails or doesn't respond properly**

**Important**: The follow-up will NOT be saved if:
- n8n webhook URL is not configured
- n8n doesn't respond within 60 seconds
- n8n returns a non-success status code
- n8n returns invalid JSON
- n8n doesn't return `"status": "success"` in the response
- For online meetings, n8n doesn't provide a `meeting_link` in the response

#### Webhook Payload Example

```json
{
  "followUpInformation": {
    "id": 123,
    "deal_id": 456,
    "meeting_type": "Kick Off",
    "meeting_type_id": 1,
    "location": "zoom",
    "meeting_link": "https://zoom.us/j/123456789",
    "next_follow_up_date": "2025-01-20 14:00:00",
    "remark": "Initial project discussion",
    "status": "pending",
    "created_at": "2025-01-15 10:00:00"
  },
  "dealInformation": {
    "id": 456,
    "name": "Project Alpha",
    "value": 50000,
    "pipeline_stage_id": 2
  },
  "contactInformation": {
    "leadContact": {
      "id": 789,
      "client_name": "John Doe",
      "client_email": "john@example.com",
      "company_name": "ABC Corp"
    }
  }
}
```

#### Webhook Response Example (n8n to CRM)

**Required Response Format:**
```json
{
  "status": "success",
  "meeting_link": "https://zoom.us/j/123456789?pwd=abc123",
  "meeting_id": "123456789",
  "join_url": "https://zoom.us/j/123456789?pwd=abc123",
  "start_url": "https://zoom.us/s/123456789?zak=abc123"
}
```

**Error Response Format:**
```json
{
  "status": "error",
  "message": "Failed to create meeting: Invalid credentials"
}
```

**Note**: The `status` field is required and must be set to `"success"` for the follow-up to be saved. If `status` is `"error"` or missing, the follow-up creation will be rolled back.

## Database Schema

### meeting_types Table

- `id` - Primary key
- `name` - Meeting type name (e.g., "Kick Off", "Strategy")
- `description` - Optional description
- `color` - Hex color code for display
- `company_id` - Company association
- `created_at`, `updated_at` - Timestamps

### lead_follow_up Table (Updated)

- Added `meeting_type_id` field (foreign key to meeting_types)
- Added `location` field (enum: office, zoom, zoho_meet, google_meet)
- Added `meeting_link` field (text, nullable)

## API Endpoints

### Meeting Types

- `GET /meeting-types` - List all meeting types
- `POST /meeting-types` - Create new meeting type
- `GET /meeting-types/{id}/edit` - Edit form
- `PUT /meeting-types/{id}` - Update meeting type
- `DELETE /meeting-types/{id}` - Delete meeting type

### Follow-ups (Enhanced)

- All existing follow-up endpoints now support meeting types
- Meeting type information is included in responses

## Customization

### Adding New Meeting Types

1. Use the admin interface at `/meeting-types`
2. Or add directly to the `MeetingTypeSeeder`

### Modifying Webhook Payload

Edit the `triggerFollowUpAutomation` method in `DealAutomationTrait` to customize the data sent to n8n.

### Styling

Meeting types are displayed with their assigned colors in:
- Follow-up creation forms
- Follow-up lists
- Calendar views

## Troubleshooting

### Webhook Not Working

1. Check the `FOLLOWUP_WEBHOOK_URL` environment variable
2. Verify n8n is accessible from your server
3. Check Laravel logs for webhook errors

### Meeting Types Not Showing

1. Ensure migrations have been run
2. Check if the seeder has been executed
3. Verify company_id is set correctly

### Permission Issues

Meeting type management requires appropriate permissions. Ensure your user role has access to the meeting types module.

## Support

For issues or questions, check the Laravel logs or contact your system administrator.
