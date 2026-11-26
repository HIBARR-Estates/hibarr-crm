<?php

namespace App\Support;

/**
 * Gates routing a lead on the channel it entered through: the `lead_entry_received` trigger and the
 * assign_lead_owner action. Storing entries (and showing them on the lead) is not gated, so history
 * builds up before routing is switched on. Routing needs automation v2, which owns the automations.
 */
class LeadEntryRouting
{
    public const FLAG = 'crm.lead-entry-routing';

    public static function enabled(): bool
    {
        return AutomationV2Feature::enabled() && FeatureFlags::enabled(self::FLAG);
    }
}
