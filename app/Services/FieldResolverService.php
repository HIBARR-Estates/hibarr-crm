<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\CustomField;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FieldResolverService
{
    /**
     * Resolve a value for a given field from a Deal instance.
     *
     * @param Deal $deal
     * @param string $field
     * @return mixed
     */
    public function resolve(Deal $deal, string $field)
    {
        // 1. HibarrDealFields
        if ($this->isHibarrField($field)) {
            return $this->resolveHibarrField($deal, $field);
        }

        // 2. Custom fields (format: custom_field_{id})
        if (Str::startsWith($field, 'custom_field_')) {
            return $this->resolveCustomField($deal, $field);
        }

        // 3. Related models (e.g., followups)
        if (Str::startsWith($field, 'followup_') || Str::startsWith($field, 'last_followup_')) {
            return $this->resolveFollowupField($deal, $field);
        }

        // 4. Native Deal fields (Fallback)
        // We try to access it directly. If it's a valid attribute or accessor, it will return value.
        // If it doesn't exist, it might return null or throw error depending on strictness.
        // Eloquent returns null for non-existent attributes usually.
        return $deal->{$field} ?? null;
    }

    protected function isNativeField(Deal $deal, string $field): bool
    {
        // Deprecated: We use fallback strategy now.
        return true;
    }

    protected function isHibarrField(string $field): bool
    {
        $hibarrFields = [
            'interested_in',
            'motivation',
            'purchase_timeline',
            'budget_range',
            'message',
            'strategy_meeting_booked',
            'downpayment_paid',
            'inspection_trip_date',
            'deposit_confirmation',
            'reservation_agreement',
            'sales_contract'
        ];

        return in_array($field, $hibarrFields);
    }

    protected function resolveHibarrField(Deal $deal, string $field)
    {
        return $deal->hibarrFields?->{$field};
    }

    protected function resolveCustomField(Deal $deal, string $field)
    {
        $customFieldId = (int) Str::after($field, 'custom_field_');
        
        if ($customFieldId <= 0) {
            return null;
        }

        $value = DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('model_id', $deal->id)
            ->where('custom_field_id', $customFieldId)
            ->value('value');

        return $value;
    }

    protected function resolveFollowupField(Deal $deal, string $field)
    {
        if ($field === 'last_followup_date') {
            $lastFollowup = $deal->follow()->latest('created_at')->first();
            return $lastFollowup?->created_at;
        }

        if ($field === 'last_followup_next_date') {
            $lastFollowup = $deal->follow()->latest('created_at')->first();
            return $lastFollowup?->next_follow_up_date;
        }

        if ($field === 'last_followup_remark') {
            $lastFollowup = $deal->follow()->latest('created_at')->first();
            return $lastFollowup?->remark;
        }
        
        if ($field === 'last_followup_status') {
            $lastFollowup = $deal->follow()->latest('created_at')->first();
            return $lastFollowup?->status;
        }

        return null;
    }
}
