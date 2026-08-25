<?php

namespace App\Support;

use App\Models\DealAutomation;
use Illuminate\Support\Facades\Log;

/**
 * Gates automation v2 (lead automations, waits, date triggers, email/task/note/meta
 * actions, React settings hub). When disabled, deal automations behave like the
 * pre-v2 release: deal-scoped, pipeline-exact, stage/set-field/lock actions only.
 */
class AutomationV2Feature
{
    public const FLAG = 'crm.automation-v2';

    /** @var array<int, string> */
    private const LEGACY_DEAL_ACTION_TYPES = ['stage_transition', 'set_field_value', 'lock_deal'];

    /** @var array<int, string> */
    private const V2_ONLY_TRIGGERS = [
        'lead_created',
        'lead_updated',
        DealAutomation::TRIGGER_LEAD_FOLLOWUP_CREATED,
        DealAutomation::TRIGGER_DATE_BASED,
    ];

    public static function enabled(): bool
    {
        return FeatureFlags::enabled(self::FLAG);
    }

    public static function supportsAutomation(DealAutomation $automation): bool
    {
        if (self::enabled()) {
            return true;
        }

        if (($automation->subject_type ?? DealAutomation::SUBJECT_DEAL) !== DealAutomation::SUBJECT_DEAL) {
            return false;
        }

        if (in_array($automation->trigger, self::V2_ONLY_TRIGGERS, true)) {
            return false;
        }

        if ($automation->wait_duration_value && (int) $automation->wait_duration_value > 0) {
            return false;
        }

        foreach ($automation->actions ?? [] as $action) {
            $type = $action->action_type ?? 'stage_transition';
            if (! self::supportsActionType($type)) {
                return false;
            }
        }

        return true;
    }

    public static function supportsActionType(string $actionType): bool
    {
        if (self::enabled()) {
            return true;
        }

        return in_array($actionType, self::LEGACY_DEAL_ACTION_TYPES, true);
    }

    public static function usesLegacyDealPipelineScope(): bool
    {
        return ! self::enabled();
    }

    /**
     * When v2 is off, automations that only work with v2 would otherwise stay
     * "active" in the DB but never run — log once when encountered.
     */
    public static function warnIfUnsupported(DealAutomation $automation): void
    {
        if (self::enabled() || ! $automation->active) {
            return;
        }

        if (self::supportsAutomation($automation)) {
            return;
        }

        Log::warning(
            "Skipping automation '{$automation->name}' (ID: {$automation->id}) — requires ".self::FLAG.'.'
        );
    }
}
