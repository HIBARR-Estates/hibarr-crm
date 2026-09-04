<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use Illuminate\Support\Collection;

/**
 * The set of Deal/Lead fields exposed to deal automation conditions and email
 * template merge tags/variable mappings — shared so the dropdowns in both UIs
 * (and the field keys FieldResolverService knows how to resolve) never drift
 * apart from each other.
 */
class AutomationFieldCatalog
{
    public const HIBARR_FIELDS = [
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

    /**
     * lead_marketing columns exposed to automation conditions and merge tags.
     * Read through the `lead_marketing_` prefix (FieldResolverService resolves
     * it against the lead's marketing row — the deal's contact for a deal
     * automation, the lead itself for a lead automation), so these keys can't
     * collide with a same-named Lead or Deal column.
     *
     * Keys must match FieldResolverService::LEAD_MARKETING_FIELDS.
     */
    public const LEAD_MARKETING_FIELDS = [
        // UTM & campaign tracking
        'utm_source' => 'UTM Source',
        'utm_medium' => 'UTM Medium',
        'utm_campaign' => 'UTM Campaign',
        'utm_content' => 'UTM Content',
        'utm_term' => 'UTM Term',
        'utm_audience' => 'UTM Audience',
        'traffic_source_id' => 'Traffic Source',
        // Ad-platform identifiers
        'facebook_click_id' => 'Facebook Click ID',
        'facebook_lead_id' => 'Facebook Lead ID',
        'facebook_browser_id' => 'Facebook Browser ID',
        'user_agent' => 'User Agent',
        'ip_address' => 'IP Address',
        // Engagement
        'has_registered_for_the_webinar' => 'Registered For Webinar',
        'has_attended_the_webinar' => 'Attended Webinar',
        'last_webinar_date' => 'Last Webinar Date',
        'registered_for_zoom_meeting' => 'Registered For Zoom Meeting',
        'has_joined_the_facebook_group' => 'Joined Facebook Group',
        'has_joined_the_whatsapp_group' => 'Joined WhatsApp Group',
        'has_downloaded_the_ebook' => 'Downloaded Ebook',
        // Scoring
        'contact_score' => 'Contact Score',
    ];

    /**
     * Marketing columns that must never leave the system through a merge tag.
     *
     * These are device/browser/ad-network identifiers — personal data under
     * GDPR, and useless for personalization. A send_email action can address
     * `custom_email` (any typed address), so a template resolving
     * {{lead_marketing_ip_address}} would hand a lead's IP and browser
     * fingerprint to an arbitrary third party. They stay fully available to
     * *condition* evaluation, which never emits the value — only branches on
     * it.
     *
     * Enforced at the single outbound chokepoint,
     * DealAutomationService::resolveTagValue(), not just hidden in the
     * pickers: a tag can also be hand-typed into a template body or POSTed
     * straight into a variable mapping.
     */
    public const LEAD_MARKETING_CONDITION_ONLY_FIELDS = [
        'ip_address',
        'user_agent',
        'facebook_click_id',
        'facebook_lead_id',
        'facebook_browser_id',
    ];

    /**
     * The marketing fields a merge tag may resolve — campaign attribution,
     * engagement and score, minus the raw identifiers above.
     *
     * @return array<string, string>
     */
    public static function outboundLeadMarketingFields(): array
    {
        return array_diff_key(
            self::LEAD_MARKETING_FIELDS,
            array_flip(self::LEAD_MARKETING_CONDITION_ONLY_FIELDS)
        );
    }

    /**
     * Whether a resolved field key is a marketing identifier barred from
     * outbound use. Accepts the prefixed automation key
     * ("lead_marketing_ip_address").
     */
    public static function isOutboundBlockedField(string $fieldKey): bool
    {
        if (! str_starts_with($fieldKey, 'lead_marketing_')) {
            return false;
        }

        return in_array(
            substr($fieldKey, strlen('lead_marketing_')),
            self::LEAD_MARKETING_CONDITION_ONLY_FIELDS,
            true
        );
    }

    /** Marketing columns stored as 0/1 — offered as a Yes/No picker, not free text. */
    public const LEAD_MARKETING_BOOLEAN_FIELDS = [
        'has_registered_for_the_webinar',
        'has_attended_the_webinar',
        'registered_for_zoom_meeting',
        'has_joined_the_facebook_group',
        'has_joined_the_whatsapp_group',
        'has_downloaded_the_ebook',
    ];

    public const RELATED_FIELDS = [
        'followup_count' => 'Follow-up Count',
        'last_followup_days_ago' => 'Days Since Last Follow-up',
        'last_followup_status' => 'Last Follow-up Status',
        'next_followup_date' => 'Next Follow-up Date',
    ];

    // Keys must match FieldResolverService::LEAD_FIELDS.
    public const LEAD_FIELDS = [
        'client_name' => 'Lead Name',
        'client_email' => 'Lead Email',
        'mobile' => 'Lead Mobile',
        'cell' => 'Lead Alternate Phone',
        'office' => 'Lead Office Phone',
        'client_whatsapp' => 'Lead WhatsApp',
        'client_instagram' => 'Lead Instagram',
        'client_telegram' => 'Lead Telegram',
        'country' => 'Lead Country',
        'city' => 'Lead City',
        'state' => 'Lead State',
        'postal_code' => 'Lead Postal Code',
        'address' => 'Lead Address',
        'website' => 'Lead Website',
        'company_name' => 'Lead Company Name',
        'note' => 'Lead Note',
        'salutation' => 'Lead Salutation',
        'age' => 'Lead Age',
        'age_range' => 'Lead Age Range',
        'date_of_birth' => 'Lead Date of Birth',
        'gender' => 'Lead Gender',
        'nationality' => 'Lead Nationality',
        'occupation' => 'Lead Occupation',
        'primary_language' => 'Lead Primary Language',
        'preferred_contact_time' => 'Lead Preferred Contact Time',
        'type' => 'Lead Contact Type',
        'temperature' => 'Lead Temperature',
        'category_id' => 'Lead Category',
        'source_id' => 'Lead Source',
        'lead_lifecycle_status_id' => 'Lead Status',
        'lead_owner' => 'Lead Owner (User ID)',
        'referred_by_agent_id' => 'Referring Agent (ID)',
        'assigned_at' => 'Lead Assigned At',
        'first_contacted_at' => 'Lead First Contacted At',
        'created_at' => 'Lead Created Date',
    ];

    /**
     * Date fields a date_based trigger can anchor on, grouped by automation
     * subject type. Every key must resolve to a parseable date through
     * FieldResolverService::resolve() — bare Lead columns for lead automations,
     * prefixed/native keys for deal automations. Custom fields of type 'date'
     * are appended at render time (custom_field_{id} / lead_custom_field_{id}).
     */
    public const DATE_FIELDS = [
        'lead' => [
            'date_of_birth' => "Client's Date of Birth",
            'created_at' => 'Lead Created Date',
        ],
        'deal' => [
            'lead_field_date_of_birth' => "Client's Date of Birth (Deal's Lead)",
            'inspection_trip_date' => 'Inspection Trip Date',
            'close_date' => 'Deal Close Date',
        ],
    ];

    /**
     * How a date_based trigger repeats.
     */
    public const DATE_RECURRENCES = [
        'yearly' => 'Every Year (birthdays, anniversaries)',
        'once' => 'One Time Only',
    ];

    /**
     * Action types valid for each automation subject type — stage_transition/lock_deal
     * only make sense for a Deal (pipeline stage, commission-affecting lock). Tasks
     * and notes attach to either a Deal or a Lead, so both subject types get them.
     * "wait" pauses the sequence and resumes at the next step later — see
     * DealAutomationService::executeActions()/queueResume().
     */
    public const DEAL_ACTION_TYPES = ['stage_transition', 'set_field_value', 'lock_deal', 'send_email', 'create_task', 'create_note', 'meta_conversion', 'wait'];

    public const LEAD_ACTION_TYPES = ['set_field_value', 'send_email', 'create_task', 'create_note', 'meta_conversion', 'wait'];

    /**
     * Units a create_task action's due-date delta can be expressed in — the
     * delta is measured from the moment the automation actually creates the
     * task, not from the triggering deal/lead's own created_at.
     */
    public const DUE_DATE_DELTA_UNITS = [
        'minutes' => 'Minute(s)',
        'hours' => 'Hour(s)',
        'days' => 'Day(s)',
    ];

    /**
     * Units an automation's "wait before running" can be expressed in.
     */
    public const WAIT_DURATION_UNITS = [
        'minutes' => 'Minute(s)',
        'hours' => 'Hour(s)',
        'days' => 'Day(s)',
    ];

    /**
     * Who a create_task/create_note action's assignee (task only) or assigner
     * (task + note "created/added by") resolves to at execution time.
     */
    public const ASSIGNMENT_TYPES = [
        'lead_owner' => 'Lead Owner',
        'specific_user' => 'Specific User',
    ];

    /**
     * Lead columns a "Set Field Value" action can write to (raw column name,
     * unprefixed — the action sets $lead->{field_name} directly).
     */
    public const LEAD_SETTABLE_FIELDS = [
        'temperature' => 'Lead Temperature',
        'category_id' => 'Lead Category (ID)',
        'lead_lifecycle_status_id' => 'Lead Status (ID)',
        'lead_owner' => 'Lead Owner (User ID)',
    ];

    /**
     * Where a CTA URL variable mapping links to. An email template isn't tied
     * to one automation subject type — it can be reused by both deal and lead
     * automations — so all four are always offered; 'deal' simply resolves to
     * nothing (DealAutomationService::resolveCtaUrl() returns null) if the
     * template is used by a lead-subject automation, since a lead isn't tied
     * to exactly one deal.
     */
    public const CTA_TARGETS = [
        'record' => 'This Record (Deal or Lead — whichever triggered it)',
        'deal' => 'The Deal (deal automations only)',
        'lead' => 'The Lead / Contact',
        'custom' => 'Custom URL',
    ];

    /**
     * Who a send_email action can target — checkboxes, any combination.
     * "deal_team" is Deal's own documented convention (agent + participants =
     * full read/write access), not a separate DB concept — there's no other
     * "team" model on Deal. 'subject' gates which automation type shows it
     * ('any' = shown for both deal- and lead-subject automations).
     */
    public const RECIPIENT_TYPES = [
        'client' => ['label' => 'Client (Lead)', 'subject' => 'any'],
        'deal_agent' => ['label' => 'Deal Agent', 'subject' => 'deal'],
        'deal_watchers' => ['label' => 'Deal Watchers', 'subject' => 'deal'],
        'deal_participants' => ['label' => 'Deal Participants', 'subject' => 'deal'],
        'deal_team' => ['label' => 'Deal Team (Agent + Participants)', 'subject' => 'deal'],
        'lead_owner' => ['label' => 'Lead Owner', 'subject' => 'lead'],
        'referred_by_agent' => ['label' => 'Referring Agent', 'subject' => 'lead'],
        'specific_user' => ['label' => 'Specific User(s)', 'subject' => 'any'],
        'custom_email' => ['label' => 'Custom Email Address(es)', 'subject' => 'any'],
    ];

    public static function dealCustomFields(): Collection
    {
        $group = CustomFieldGroup::where('model', 'App\Models\Deal')->first();

        return $group ? CustomField::where('custom_field_group_id', $group->id)->get() : collect([]);
    }

    public static function leadCustomFields(): Collection
    {
        $group = CustomFieldGroup::where('model', 'App\Models\Lead')->first();

        return $group ? CustomField::where('custom_field_group_id', $group->id)->get() : collect([]);
    }

    /**
     * {id, name} option lists for every lead field that's backed by a real
     * lookup table (not a fixed enum) — used to populate the condition
     * builder's Value picker instead of a free-text box. Fixed enums
     * (gender, contact type, age range) don't need a DB round trip and are
     * hardcoded client-side instead (config/builderFields.ts).
     *
     * @return array<string, Collection>
     */
    public static function leadLookups(): array
    {
        return [
            'leadCategories' => \App\Models\LeadCategory::orderBy('category_name')
                ->get(['id', 'category_name as name']),
            'leadSources' => \App\Models\LeadSource::orderBy('sort_order')
                ->get(['id', 'type as name']),
            'leadLifecycleStatuses' => \App\Models\LeadLifecycleStatus::orderBy('sort_order')
                ->get(['id', 'label as name']),
            'leadAgents' => \App\Models\LeadAgent::with('user:id,name')
                ->get()
                ->map(fn ($agent) => [
                    'id' => $agent->id,
                    'name' => $agent->user?->name,
                ])
                ->values(),
        ];
    }

    /**
     * Event names already in use somewhere — either a pipeline-stage Meta
     * Conversion trigger, or another automation's meta_conversion action —
     * so an action editor can offer them as a picker instead of the user
     * having to remember/retype an existing event name exactly.
     *
     * @return array<int, string>
     */
    public static function knownMetaEventNames(): array
    {
        return \App\Models\MetaConversionTrigger::query()
            ->pluck('event_name')
            ->merge(\App\Models\DealAutomationAction::query()->whereNotNull('meta_event_name')->pluck('meta_event_name'))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}
