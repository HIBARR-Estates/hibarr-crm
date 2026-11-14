<?php

namespace App\Support;

/**
 * Marks the leads taking part in a merge while it runs, so the Lead observer
 * can tell a merge's saves and soft delete apart from ordinary edits:
 *
 * - the duplicate's soft delete must not send "Lead removed from pipeline"
 *   (the merge sends its own "Lead merged" notice instead);
 * - neither lead's merge saves run lead/deal automations;
 * - an owner change from the merge's ownership picks is announced by the
 *   "Lead merged" notice, not a separate "Lead assigned to you" email.
 *
 * Request-scoped (static), and always cleared in a finally block.
 */
final class LeadMergeContext
{
    /** @var array<int, true> */
    private static array $leadIds = [];

    /**
     * @template T
     *
     * @param  list<int>  $leadIds
     * @param  callable(): T  $callback
     * @return T
     */
    public static function run(array $leadIds, callable $callback): mixed
    {
        $added = [];
        foreach ($leadIds as $id) {
            $id = (int) $id;
            if (! isset(self::$leadIds[$id])) {
                self::$leadIds[$id] = true;
                $added[] = $id;
            }
        }

        try {
            return $callback();
        } finally {
            foreach ($added as $id) {
                unset(self::$leadIds[$id]);
            }
        }
    }

    public static function involves(?int $leadId): bool
    {
        return $leadId !== null && isset(self::$leadIds[(int) $leadId]);
    }
}
