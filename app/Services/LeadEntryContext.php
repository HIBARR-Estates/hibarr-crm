<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadEntry;

/**
 * Which entry an automation run is reacting to. The condition resolver sees only the lead, so for the
 * run a `lead_entry_received` trigger starts, the triggering entry is parked here and entry fields
 * read from it. Outside such a run (a resumed wait, a date trigger) a field falls back to the lead's
 * latest entry, which is the best answer available.
 */
class LeadEntryContext
{
    private static ?LeadEntry $current = null;

    /**
     * Runs $callback with $entry as the triggering entry, and always clears it afterwards, so one
     * lead's entry never leaks into the next run.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function run(LeadEntry $entry, callable $callback): mixed
    {
        $previous = self::$current;
        self::$current = $entry;

        try {
            return $callback();
        } finally {
            self::$current = $previous;
        }
    }

    /** The entry that triggered this run, but only when it belongs to $lead. */
    public static function triggeringEntryFor(Lead $lead): ?LeadEntry
    {
        return self::$current && (int) self::$current->lead_id === (int) $lead->id
            ? self::$current
            : null;
    }
}
