<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FieldResolverService
{
    /**
     * Whitelist of native Lead columns exposed to automation conditions/merge tags,
     * read via rawAttribute() so enum/array casts on Lead don't leak into the
     * evaluator (which only understands scalars, dates, and arrays from 'contains').
     */
    protected const LEAD_FIELDS = [
        'client_name',
        'client_email',
        'mobile',
        'cell',
        'office',
        'client_whatsapp',
        'client_instagram',
        'client_telegram',
        'country',
        'city',
        'state',
        'postal_code',
        'address',
        'website',
        'company_name',
        'note',
        'salutation',
        'age',
        'age_range',
        'date_of_birth',
        'gender',
        'nationality',
        'occupation',
        'primary_language',
        'preferred_contact_time',
        'type',
        'temperature',
        'category_id',
        'source_id',
        'lead_lifecycle_status_id',
        'lead_owner',
        'referred_by_agent_id',
        'assigned_at',
        'first_contacted_at',
        'created_at',
    ];

    /**
     * Whitelist of lead_marketing columns exposed to automation
     * conditions/merge tags, addressed as `lead_marketing_{column}`. Keys must
     * match AutomationFieldCatalog::LEAD_MARKETING_FIELDS.
     */
    protected const LEAD_MARKETING_FIELDS = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'utm_audience',
        'traffic_source_id',
        'facebook_click_id',
        'facebook_lead_id',
        'facebook_browser_id',
        'user_agent',
        'ip_address',
        'has_registered_for_the_webinar',
        'has_attended_the_webinar',
        'last_webinar_date',
        'registered_for_zoom_meeting',
        'has_joined_the_facebook_group',
        'has_joined_the_whatsapp_group',
        'has_downloaded_the_ebook',
        'contact_score',
    ];

    /**
     * Resolve a value for a given field from a Deal or Lead instance — a Lead
     * subject means the automation runs directly on the lead (no pipeline),
     * so lead_field_ / lead_custom_field_ prefixed keys resolve against it
     * directly instead of hopping through Deal->contact.
     *
     * @return mixed
     */
    public function resolve(Deal|Lead $subject, string $field)
    {
        if ($subject instanceof Lead) {
            return $this->resolveLeadSubjectField($subject, $field);
        }

        $deal = $subject;

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

        // 4. Lead marketing fields (format: lead_marketing_{column}) — checked
        // before the lead_ prefixes below, which would otherwise swallow it.
        if (Str::startsWith($field, 'lead_marketing_')) {
            return $this->resolveLeadMarketingFor($deal->contact, Str::after($field, 'lead_marketing_'));
        }

        // 5. Lead (contact) custom fields (format: lead_custom_field_{id})
        if (Str::startsWith($field, 'lead_custom_field_')) {
            return $this->resolveLeadCustomField($deal, $field);
        }

        // 6. Lead (contact) native fields (format: lead_field_{name})
        if (Str::startsWith($field, 'lead_field_')) {
            return $this->resolveLeadField($deal, $field);
        }

        // 7. Native Deal fields (Fallback)
        // We try to access it directly. If it's a valid attribute or accessor, it will return value.
        // If it doesn't exist, it might return null or throw error depending on strictness.
        // Eloquent returns null for non-existent attributes usually.
        return $deal->{$field} ?? null;
    }

    /**
     * The underlying Eloquent attribute name on $subject itself when $field
     * resolves directly to one of its own columns — the only case a
     * 'changed' condition can be evaluated, since Eloquent's wasChanged()
     * only tracks the model it's called on. Returns null for anything that
     * isn't a plain attribute of $subject: a custom field (DB-queried, no
     * in-memory dirty-tracking), a hibarr/lead_marketing/followup field
     * (lives on a related model or row), or a lead_field_/lead_custom_field_
     * hop from a Deal onto its contact (a different model than $subject).
     */
    public function nativeColumn(Deal|Lead $subject, string $field): ?string
    {
        if ($subject instanceof Lead) {
            if (Str::startsWith($field, 'lead_custom_field_')
                || Str::startsWith($field, 'custom_field_')
                || Str::startsWith($field, 'lead_marketing_')
                || Str::startsWith($field, 'followup_')
                || Str::startsWith($field, 'last_followup_')) {
                return null;
            }

            $column = Str::startsWith($field, 'lead_field_') ? Str::after($field, 'lead_field_') : $field;

            return in_array($column, self::LEAD_FIELDS, true) ? $column : null;
        }

        if ($this->isHibarrField($field)
            || Str::startsWith($field, 'custom_field_')
            || Str::startsWith($field, 'followup_')
            || Str::startsWith($field, 'last_followup_')
            || Str::startsWith($field, 'lead_marketing_')
            || Str::startsWith($field, 'lead_custom_field_')
            || Str::startsWith($field, 'lead_field_')) {
            return null;
        }

        return $field;
    }

    /**
     * Resolve a field against a Lead that is itself the automation subject
     * (not a Deal's related contact). Accepts the same lead_field_ /
     * lead_custom_field_ prefixed keys used elsewhere for consistency, plus
     * bare custom_field_{id}/native column names as a convenience.
     */
    protected function resolveLeadSubjectField(Lead $lead, string $field)
    {
        if (Str::startsWith($field, 'lead_custom_field_')) {
            return $this->resolveLeadCustomFieldFor($lead, Str::after($field, 'lead_custom_field_'));
        }

        if (Str::startsWith($field, 'custom_field_')) {
            return $this->resolveLeadCustomFieldFor($lead, Str::after($field, 'custom_field_'));
        }

        if (Str::startsWith($field, 'lead_marketing_')) {
            return $this->resolveLeadMarketingFor($lead, Str::after($field, 'lead_marketing_'));
        }

        $column = Str::startsWith($field, 'lead_field_') ? Str::after($field, 'lead_field_') : $field;

        if (in_array($column, self::LEAD_FIELDS)) {
            return $this->rawAttribute($lead, $column);
        }

        return $lead->{$field} ?? null;
    }

    /**
     * The current, uncast value of a model attribute — bypasses casts the
     * same way getRawOriginal() does, but reads the model's *current*
     * attributes rather than its pre-change snapshot.
     *
     * getRawOriginal() is the wrong tool for this: Eloquent only calls
     * syncOriginal() after the 'saved' event fires, which is *after*
     * 'updated' — so calling getRawOriginal() from an 'updated' observer
     * (exactly where automation conditions are evaluated) returns the
     * value the attribute had *before* this save, not the one that was
     * just persisted. getAttributes() reflects whatever is currently set
     * on the instance, in memory or freshly loaded, with no such lag.
     */
    protected function rawAttribute(\Illuminate\Database\Eloquent\Model $model, string $column)
    {
        return $model->getAttributes()[$column] ?? null;
    }

    /**
     * A column off the lead's `lead_marketing` row (UTM/campaign attribution,
     * engagement flags, contact score). Returns null when the lead has no
     * marketing row yet — same "unset" semantics an empty column would give,
     * so an `exists` condition reads false rather than erroring.
     *
     * Raw original, matching the LEAD_FIELDS path: LeadMarketing casts its
     * flags to bool and last_webinar_date to a Carbon date, neither of which
     * ConditionEvaluatorService compares usefully — it wants the stored 0/1
     * and the raw date string.
     */
    protected function resolveLeadMarketingFor(?Lead $lead, string $column)
    {
        if (! $lead || ! in_array($column, self::LEAD_MARKETING_FIELDS, true)) {
            return null;
        }

        $marketing = $lead->marketing;

        return $marketing ? $this->rawAttribute($marketing, $column) : null;
    }

    protected function resolveLeadCustomFieldFor(Lead $lead, string $customFieldId)
    {
        $customFieldId = (int) $customFieldId;

        if ($customFieldId <= 0) {
            return null;
        }

        return DB::table('custom_fields_data')
            ->where('model', Lead::CUSTOM_FIELD_MODEL)
            ->where('model_id', $lead->id)
            ->where('custom_field_id', $customFieldId)
            ->value('value');
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
            'sales_contract',
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

    protected function resolveLeadField(Deal $deal, string $field)
    {
        $lead = $deal->contact;

        if (! $lead) {
            return null;
        }

        $column = Str::after($field, 'lead_field_');

        if (! in_array($column, self::LEAD_FIELDS)) {
            return null;
        }

        return $this->rawAttribute($lead, $column);
    }

    protected function resolveLeadCustomField(Deal $deal, string $field)
    {
        $lead = $deal->contact;

        if (! $lead) {
            return null;
        }

        return $this->resolveLeadCustomFieldFor($lead, Str::after($field, 'lead_custom_field_'));
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
