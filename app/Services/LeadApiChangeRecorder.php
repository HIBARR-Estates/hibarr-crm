<?php

namespace App\Services;

use App\Enums\CrmEventSource;
use App\Models\CustomField;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadCategory;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadMarketing;
use App\Models\LeadSource;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Timeline events for writes the external contact/deal API makes to a lead.
 *
 * Those writes mostly save quietly (no LeadObserver), so nothing reached the
 * lead or deal timelines. Callers snapshot the lead before writing; record*()
 * diffs the stored state afterwards and writes one lead event listing what was
 * filled in or added, mirrored onto each of the lead's deals.
 */
class LeadApiChangeRecorder
{
    public const CHANNEL_CONTACT_CREATE = 'contact_create';

    public const CHANNEL_DEAL_CREATE = 'deal_create';

    public const CHANNEL_GRPC = 'grpc';

    private const ATTRIBUTES = [
        'client_name' => 'Name',
        'mobile' => 'Phone',
        'gender' => 'Gender',
        'salutation' => 'Salutation',
        'source_id' => 'Source',
        'lead_owner' => 'Lead owner',
        'address' => 'Address',
        'city' => 'City',
        'state' => 'State',
        'country' => 'Country',
        'postal_code' => 'Postal code',
        'date_of_birth' => 'Date of birth',
        'nationality' => 'Nationality',
        'occupation' => 'Occupation',
        'languages' => 'Languages',
        'temperature' => 'Temperature',
        'preferred_contact_times' => 'Preferred contact times',
        'lead_lifecycle_status_id' => 'Lifecycle status',
        'referred_by_agent_id' => 'Referred by',
        'company_name' => 'Company name',
        'cell' => 'Cell',
        'office' => 'Office phone',
        'website' => 'Website',
        'contact_type' => 'Contact type',
        'status_id' => 'Status',
        'category_id' => 'Category',
        'agent_id' => 'Agent',
        'currency_id' => 'Currency',
        'total_value' => 'Total value',
        'next_follow_up' => 'Next follow-up',
    ];

    private const MARKETING_ATTRIBUTES = [
        'facebook_click_id' => 'Facebook click ID',
        'facebook_lead_id' => 'Facebook lead ID',
        'facebook_browser_id' => 'Facebook browser ID',
        'user_agent' => 'User agent',
        'ip_address' => 'IP address',
        'has_registered_for_the_webinar' => 'Registered for the webinar',
        'has_joined_the_facebook_group' => 'Joined the Facebook group',
        'has_downloaded_the_ebook' => 'Downloaded the ebook',
        'has_attended_the_webinar' => 'Attended the webinar',
        'has_joined_the_whatsapp_group' => 'Joined the WhatsApp group',
        'registered_for_zoom_meeting' => 'Registered for Zoom meeting',
        'last_webinar_date' => 'Last webinar date',
        'contact_score' => 'Contact score',
    ];

    public function __construct(private CrmEventService $eventService) {}

    /**
     * Stored state of everything the contact/deal API can write to a lead.
     *
     * @return array<string, mixed>
     */
    public function snapshot(int $leadId): array
    {
        $lead = Lead::withoutGlobalScopes()->find($leadId);
        if (! $lead) {
            return [];
        }

        $state = [];
        foreach (array_keys(self::ATTRIBUTES) as $attribute) {
            $state[$attribute] = $this->normalize($lead->getAttribute($attribute));
        }

        $state['categories'] = $lead->categories()->pluck('lead_category.id')
            ->map(fn ($id) => (int) $id)->sort()->values()->all();

        foreach ($lead->getCustomFieldsData() as $key => $value) {
            $state['custom:'.$key] = $this->normalize($value);
        }

        $marketing = LeadMarketing::where('lead_id', $leadId)->first();
        foreach (array_keys(self::MARKETING_ATTRIBUTES) as $attribute) {
            $state['marketing:'.$attribute] = $this->normalize($marketing?->getAttribute($attribute));
        }

        return $state;
    }

    /**
     * Record what an API request filled in or added on an existing lead.
     *
     * @param  array<string, mixed>  $before  snapshot() taken before the request wrote anything
     * @return list<string> Labels of the fields that changed (empty when nothing did)
     */
    public function recordUpdated(int $leadId, array $before, string $channel): array
    {
        if ($before === []) {
            return [];
        }

        $after = $this->snapshot($leadId);
        $changes = $this->diff($before, $after);
        if ($changes === []) {
            return [];
        }

        $lead = Lead::withoutGlobalScopes()->find($leadId);
        $labels = array_column($changes, 'label');
        $metadata = [
            'comment' => 'Lead updated via API: '.implode(', ', $labels),
            'channel' => $channel,
            'changes' => $changes,
        ];

        $this->recordLeadEvent('lead_updated', $lead, $metadata);
        $this->recordOnDeals($lead, $metadata);

        return $labels;
    }

    /**
     * Record lead_created for a lead the API created with saveQuietly() —
     * LeadObserver::created only records it for observed saves.
     */
    public function recordCreated(int $leadId, string $channel): void
    {
        $lead = Lead::withoutGlobalScopes()->find($leadId);
        if (! $lead) {
            return;
        }

        $this->recordLeadEvent('lead_created', $lead, [
            'comment' => 'New lead created via API',
            'channel' => $channel,
            'client_name' => $lead->client_name,
            'company_name' => $lead->company_name,
        ]);
    }

    /**
     * @return list<array{field: string, label: string, old_value: mixed, new_value: mixed, old_value_display: ?string, new_value_display: ?string}>
     */
    private function diff(array $before, array $after): array
    {
        $customFieldLabels = $this->customFieldLabels(array_keys($after));
        $changes = [];

        $categoriesChanged = ($before['categories'] ?? null) !== ($after['categories'] ?? null);

        foreach ($after as $key => $newValue) {
            $oldValue = $before[$key] ?? null;
            if ($oldValue === $newValue) {
                continue;
            }
            // category_id mirrors the first category; the categories row already covers it.
            if ($key === 'category_id' && $categoriesChanged) {
                continue;
            }

            $changes[] = [
                'field' => $key,
                'label' => $this->label($key, $customFieldLabels),
                'old_value' => $oldValue,
                'new_value' => $newValue,
                'old_value_display' => $this->display($key, $oldValue),
                'new_value_display' => $this->display($key, $newValue),
            ];
        }

        return $changes;
    }

    private function recordLeadEvent(string $slug, Lead $lead, array $metadata): void
    {
        try {
            $this->eventService->record([
                'event_type_slug' => $slug,
                'company_id' => $lead->company_id,
                'model_type' => Lead::class,
                'model_id' => $lead->id,
                'source' => $this->source($metadata['channel']),
                'metadata' => $metadata,
            ]);
        } catch (\Throwable $e) {
            Log::error('[LeadApiChangeRecorder] Failed to record lead event.', [
                'slug' => $slug,
                'lead_id' => $lead->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Deal timelines only read Deal-typed events, so mirror the change onto
     * every deal of this lead.
     */
    private function recordOnDeals(Lead $lead, array $metadata): void
    {
        $deals = Deal::withoutGlobalScopes()
            ->where('company_id', $lead->company_id)
            ->where('lead_id', $lead->id)
            ->get(['id', 'company_id', 'lead_id']);

        foreach ($deals as $deal) {
            try {
                $this->eventService->record([
                    'event_type_slug' => 'deal_lead_updated',
                    'company_id' => $deal->company_id,
                    'model_type' => Deal::class,
                    'model_id' => $deal->id,
                    'source' => $this->source($metadata['channel']),
                    'metadata' => array_merge($metadata, [
                        'comment' => 'Lead details updated via API: '.implode(', ', array_column($metadata['changes'], 'label')),
                        'lead_id' => $lead->id,
                    ]),
                ]);
            } catch (\Throwable $e) {
                Log::error('[LeadApiChangeRecorder] Failed to record deal mirror event.', [
                    'deal_id' => $deal->id,
                    'lead_id' => $lead->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function source(string $channel): string
    {
        return $channel === self::CHANNEL_GRPC ? CrmEventSource::GRPC->value : CrmEventSource::API->value;
    }

    private function normalize(mixed $value): mixed
    {
        if ($value instanceof \BackedEnum) {
            return $value->value;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if ($value instanceof \Illuminate\Support\Collection) {
            $value = $value->all();
        }
        if (is_array($value)) {
            return array_values($value) === [] ? null : array_values($value);
        }
        if ($value === '' || $value === null) {
            return null;
        }
        if (is_bool($value)) {
            return $value;
        }

        return (string) $value;
    }

    /**
     * @param  array<string, string>  $customFieldLabels
     */
    private function label(string $key, array $customFieldLabels): string
    {
        if ($key === 'categories') {
            return 'Categories';
        }
        if (str_starts_with($key, 'custom:')) {
            return $customFieldLabels[$key] ?? $key;
        }
        if (str_starts_with($key, 'marketing:')) {
            return self::MARKETING_ATTRIBUTES[substr($key, 10)] ?? $key;
        }

        return self::ATTRIBUTES[$key] ?? $key;
    }

    /**
     * @param  list<string>  $keys
     * @return array<string, string>
     */
    private function customFieldLabels(array $keys): array
    {
        $ids = [];
        foreach ($keys as $key) {
            if (preg_match('/^custom:field_(\d+)$/', $key, $m)) {
                $ids[] = (int) $m[1];
            }
        }
        if ($ids === []) {
            return [];
        }

        return CustomField::whereIn('id', $ids)->pluck('label', 'id')
            ->mapWithKeys(fn ($label, $id) => ['custom:field_'.$id => (string) $label])
            ->all();
    }

    private function display(string $key, mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return match ($key) {
            'source_id' => LeadSource::withoutGlobalScopes()->whereKey($value)->value('type') ?? (string) $value,
            'lead_owner' => User::withoutGlobalScopes()->whereKey($value)->value('name') ?? (string) $value,
            'lead_lifecycle_status_id' => LeadLifecycleStatus::withoutGlobalScopes()->whereKey($value)->value('label') ?? (string) $value,
            'categories' => implode(', ', LeadCategory::withoutGlobalScopes()->whereIn('id', $value)->pluck('category_name')->all()),
            default => is_bool($value) ? ($value ? 'Yes' : 'No') : (is_array($value) ? implode(', ', array_map('strval', $value)) : (string) $value),
        };
    }
}
