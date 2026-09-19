<?php

namespace App\Services;

use App\Models\Lead;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeadFieldResolverService
{
    /**
     * Resolve a single field value from a Lead (for condition evaluation).
     */
    public function resolve(Lead $lead, string $field): mixed
    {
        if (Str::startsWith($field, 'custom_field_')) {
            return $this->resolveCustomField($lead, $field);
        }

        if (Str::startsWith($field, 'followup_') || Str::startsWith($field, 'last_followup_')) {
            return $this->resolveFollowupField($lead, $field);
        }

        return $lead->{$field} ?? null;
    }

    /**
     * The underlying Lead attribute name when $field resolves directly to
     * one of its own columns — the only case a 'changed' condition can be
     * evaluated (Eloquent's wasChanged() only tracks the model it's called
     * on). Null for a custom field or a followup field, neither of which is
     * an attribute of $lead itself.
     */
    public function nativeColumn(Lead $lead, string $field): ?string
    {
        if (Str::startsWith($field, 'custom_field_') || Str::startsWith($field, 'followup_') || Str::startsWith($field, 'last_followup_')) {
            return null;
        }

        return $field;
    }

    /**
     * Full native + custom field context for the given Lead only (email merge vars).
     *
     * @return array<string, mixed>
     */
    public function resolveAll(Lead $lead): array
    {
        $context = [];

        foreach ($lead->getAttributes() as $key => $value) {
            if (in_array($key, ['password', 'remember_token'], true)) {
                continue;
            }
            $context[$key] = $this->stringifyForMerge($value);
        }

        $customRows = DB::table('custom_fields_data')
            ->where('model', Lead::CUSTOM_FIELD_MODEL)
            ->where('model_id', $lead->id)
            ->get(['custom_field_id', 'value']);

        foreach ($customRows as $row) {
            $context['custom_field_'.$row->custom_field_id] = $this->stringifyForMerge($row->value);
        }

        if ($lead->client_name !== null) {
            $context['client_name'] = (string) $lead->client_name;
        }
        if ($lead->client_email !== null) {
            $context['client_email'] = (string) $lead->client_email;
        }

        return $context;
    }

    protected function resolveCustomField(Lead $lead, string $field): mixed
    {
        $customFieldId = (int) Str::after($field, 'custom_field_');

        if ($customFieldId <= 0) {
            return null;
        }

        return DB::table('custom_fields_data')
            ->where('model', Lead::CUSTOM_FIELD_MODEL)
            ->where('model_id', $lead->id)
            ->where('custom_field_id', $customFieldId)
            ->value('value');
    }

    protected function resolveFollowupField(Lead $lead, string $field): mixed
    {
        $lastFollowup = \App\Models\DealFollowUp::query()
            ->where('lead_id', $lead->id)
            ->latest('created_at')
            ->first();

        return match ($field) {
            'last_followup_date' => $lastFollowup?->created_at,
            'last_followup_next_date' => $lastFollowup?->next_follow_up_date,
            'last_followup_remark' => $lastFollowup?->remark,
            'last_followup_status' => $lastFollowup?->status,
            default => null,
        };
    }

    protected function stringifyForMerge(mixed $value): mixed
    {
        if ($value instanceof \BackedEnum) {
            return $value->value;
        }

        if ($value instanceof \UnitEnum) {
            return $value->name;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('c');
        }

        if (is_array($value)) {
            return $value;
        }

        return $value;
    }
}
