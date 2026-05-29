<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\HibarrDealFields;
use App\Models\LeadMarketing;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Records deal timeline events when HibarrDealFields or LeadMarketing rows change.
 */
class DealAssociatableFieldEventRecorder
{
    public const HIBARR_FIELD_LABELS = [
        'interested_in' => 'Interested In',
        'motivation' => 'Motivation',
        'purchase_timeline' => 'Purchase Timeline',
        'budget_range' => 'Budget Range',
        'message' => 'Message',
        'strategy_meeting_booked' => 'Strategy Meeting Booked',
        'downpayment_paid' => 'Downpayment Paid',
        'inspection_trip_date' => 'Inspection Trip Date',
        'deposit_confirmation' => 'Deposit Confirmation',
        'reservation_agreement' => 'Reservation Agreement',
        'sales_contract' => 'Sales Contract',
    ];

    public const HIBARR_FILE_FIELDS = [
        'deposit_confirmation',
        'reservation_agreement',
        'sales_contract',
    ];

    public const HIBARR_BOOLEAN_FIELDS = [
        'strategy_meeting_booked',
        'downpayment_paid',
    ];

    public const HIBARR_DATE_FIELDS = [
        'inspection_trip_date',
    ];

    public const LEAD_MARKETING_FIELD_LABELS = [
        'utm_source' => 'UTM Source',
        'utm_medium' => 'UTM Medium',
        'utm_campaign' => 'UTM Campaign',
        'utm_content' => 'UTM Content',
        'utm_term' => 'UTM Term',
        'utm_audience' => 'UTM Audience',
        'traffic_source_id' => 'Traffic Source',
        'facebook_click_id' => 'Facebook Click ID',
        'facebook_lead_id' => 'Facebook Lead ID',
        'facebook_browser_id' => 'Facebook Browser ID',
        'user_agent' => 'User Agent',
        'ip_address' => 'IP Address',
        'has_registered_for_the_webinar' => 'Registered For Webinar',
        'has_joined_the_facebook_group' => 'Joined Facebook Group',
        'has_downloaded_the_ebook' => 'Downloaded Ebook',
        'has_attended_the_webinar' => 'Attended Webinar',
        'registered_for_zoom_meeting' => 'Registered For Zoom Meeting',
        'last_webinar_date' => 'Last Webinar Date',
        'contact_score' => 'Contact Score',
    ];

    public const LEAD_MARKETING_BOOLEAN_FIELDS = [
        'has_registered_for_the_webinar',
        'has_joined_the_facebook_group',
        'has_downloaded_the_ebook',
        'has_attended_the_webinar',
        'registered_for_zoom_meeting',
    ];

    public const LEAD_MARKETING_DATE_FIELDS = [
        'last_webinar_date',
    ];

    public function recordHibarrFieldChanges(HibarrDealFields $fields): void
    {
        if ($this->shouldSkipRecording()) {
            return;
        }

        $deal = $fields->relationLoaded('deal')
            ? $fields->deal
            : Deal::find($fields->deal_id);

        if (!$deal) {
            return;
        }

        $changes = $this->collectModelChanges(
            $fields,
            self::HIBARR_FIELD_LABELS,
            self::HIBARR_FILE_FIELDS,
            self::HIBARR_BOOLEAN_FIELDS,
            self::HIBARR_DATE_FIELDS
        );

        if (empty($changes)) {
            return;
        }

        Log::info('[DealAssociatableFieldEventRecorder] Recording Hibarr field CRM events.', [
            'deal_id' => $deal->id,
            'change_count' => count($changes),
        ]);

        app(DealActivityEventService::class)->recordHibarrFieldsUpdated($deal, $changes);
    }

    public function recordLeadMarketingFieldChanges(LeadMarketing $marketing): void
    {
        if ($this->shouldSkipRecording()) {
            return;
        }

        if (!$marketing->lead_id) {
            return;
        }

        $changes = $this->collectModelChanges(
            $marketing,
            self::LEAD_MARKETING_FIELD_LABELS,
            [],
            self::LEAD_MARKETING_BOOLEAN_FIELDS,
            self::LEAD_MARKETING_DATE_FIELDS
        );

        if (empty($changes)) {
            return;
        }

        $deals = Deal::where('lead_id', $marketing->lead_id)->get();

        if ($deals->isEmpty()) {
            return;
        }

        $eventService = app(DealActivityEventService::class);

        foreach ($deals as $deal) {
            Log::info('[DealAssociatableFieldEventRecorder] Recording lead marketing CRM events for deal.', [
                'deal_id' => $deal->id,
                'lead_id' => $marketing->lead_id,
                'change_count' => count($changes),
            ]);

            $eventService->recordLeadMarketingFieldsUpdated($deal, $changes);
        }
    }

    /**
     * @param array<string, string> $labels
     * @param array<int, string>    $fileFields
     * @param array<int, string>    $booleanFields
     * @param array<int, string>    $dateFields
     * @return array<int, array{field_name: string, field_label: string, field_type: ?string, old_value: ?string, new_value: ?string}>
     */
    protected function collectModelChanges(
        Model $model,
        array $labels,
        array $fileFields = [],
        array $booleanFields = [],
        array $dateFields = []
    ): array {
        $changes = [];

        foreach ($labels as $fieldName => $fieldLabel) {
            if (!$model->wasChanged($fieldName)) {
                continue;
            }

            $fieldType = $this->inferFieldType($fieldName, $fileFields, $booleanFields, $dateFields);
            $oldValue = $this->stringifyFieldValue($model->getOriginal($fieldName), $fieldType);
            $newValue = $this->stringifyFieldValue($model->getAttribute($fieldName), $fieldType);

            if ($this->valuesAreEquivalent($oldValue, $newValue, $fieldType)) {
                continue;
            }

            $changes[] = [
                'field_name' => $fieldName,
                'field_label' => $fieldLabel,
                'field_type' => $fieldType,
                'old_value' => $oldValue,
                'new_value' => $newValue,
            ];
        }

        return $changes;
    }

    protected function inferFieldType(
        string $fieldName,
        array $fileFields,
        array $booleanFields,
        array $dateFields
    ): ?string {
        if (in_array($fieldName, $fileFields, true)) {
            return 'file';
        }

        if (in_array($fieldName, $booleanFields, true)) {
            return 'boolean';
        }

        if (in_array($fieldName, $dateFields, true)) {
            return 'date';
        }

        return 'text';
    }

    protected function stringifyFieldValue(mixed $value, ?string $fieldType): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($fieldType === 'boolean') {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? '1' : '0';
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_array($value)) {
            return json_encode($value);
        }

        return trim((string) $value);
    }

    protected function valuesAreEquivalent(?string $oldValue, ?string $newValue, ?string $fieldType): bool
    {
        if ($fieldType === 'boolean') {
            $normalize = static fn (?string $v) => in_array(strtolower(trim((string) $v)), ['1', 'true', 'yes', 'on'], true) ? '1' : '0';

            return $normalize($oldValue) === $normalize($newValue);
        }

        if ($fieldType === 'date') {
            try {
                $old = $oldValue ? \Carbon\Carbon::parse($oldValue)->format('Y-m-d') : '';
                $new = $newValue ? \Carbon\Carbon::parse($newValue)->format('Y-m-d') : '';

                return $old === $new;
            } catch (\Throwable) {
                // Fall through to string compare.
            }
        }

        $normalize = static function (?string $value): string {
            if ($value === null || $value === '') {
                return '';
            }

            return trim($value);
        };

        return $normalize($oldValue) === $normalize($newValue);
    }

    protected function shouldSkipRecording(): bool
    {
        if (isRunningInConsoleOrSeeding()) {
            return true;
        }

        if (session()->has('is_imported')) {
            return true;
        }

        return false;
    }
}
