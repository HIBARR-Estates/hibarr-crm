<?php

namespace App\Services\CallLog;

use App\Models\CrmEvent;
use App\Models\CrmEventType;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Which call a `call_*` event belongs to, stored in `crm_events.call_key`.
 *
 * Every agent's leg of one call (ringing, answered, missed, passed, ended)
 * gets the same key, so the call log groups and looks calls up on one
 * indexed column instead of working the identity out on every request.
 *
 * The key is set when the event is written (CrmEvent::created) and, for
 * rows written before the column existed, by backfill(). The rules live in
 * one SQL expression (expression()) so write time and backfill agree.
 */
class CallKey
{
    /** How far back a legacy missed leg looks for its own ringing event. */
    private const RING_LOOKBACK_SECONDS = 300;

    /** How long after dialling an outbound outcome still belongs to that "started". */
    private const OUTBOUND_WINDOW_SECONDS = 7200;

    private static ?bool $hasColumn = null;

    /**
     * Set the key of a freshly written call event. An outbound outcome also
     * re-keys the agent's recent "started" rows for that number, which had no
     * id of their own until this outcome arrived.
     *
     * Never throws: a missing key must not stop the event being recorded.
     */
    public function assignFor(CrmEvent $event): void
    {
        try {
            if (! self::hasColumn()) {
                return;
            }

            $types = $this->callTypes((int) $event->company_id);
            if (! in_array((int) $event->event_type_id, $types->values()->all(), true)) {
                return;
            }

            $ids = [(int) $event->id];

            $startedId = $types['call_started'] ?? null;
            $direction = $event->direction?->value ?? $event->getRawOriginal('direction');
            $phone = ((array) ($event->metadata ?? []))['phone_number'] ?? null;

            if ($direction === 'outbound' && $startedId !== null && (int) $event->event_type_id !== (int) $startedId
                && $event->user_id !== null && $phone !== null && $event->occurred_at !== null) {
                $earlier = DB::table('crm_events')
                    ->where('company_id', (int) $event->company_id)
                    ->where('event_type_id', (int) $startedId)
                    ->where('direction', 'outbound')
                    ->where('user_id', (int) $event->user_id)
                    ->where('metadata->phone_number', $phone)
                    ->whereBetween('occurred_at', [
                        $event->occurred_at->copy()->subSeconds(self::OUTBOUND_WINDOW_SECONDS),
                        $event->occurred_at,
                    ])
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->all();
                $ids = array_merge($ids, $earlier);
            }

            $this->assign((int) $event->company_id, $ids, $types);
        } catch (\Throwable $e) {
            Log::warning('CallKey: could not set call_key', ['event_id' => $event->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Fill in the key of call events that have none, in id order and in
     * chunks, so it can run on a large table and be re-run safely.
     *
     * @return int rows keyed
     */
    public function backfill(int $chunk = 500): int
    {
        if (! self::hasColumn(refresh: true)) {
            return 0;
        }

        $done = 0;
        $companies = DB::table('crm_events')
            ->whereIn('event_type_id', $this->allCallTypeIds())
            ->whereNull('call_key')
            ->distinct()
            ->pluck('company_id');

        foreach ($companies as $companyId) {
            $types = $this->callTypes((int) $companyId);
            if ($types->isEmpty()) {
                continue;
            }

            DB::table('crm_events')
                ->select('id')
                ->where('company_id', (int) $companyId)
                ->whereIn('event_type_id', $types->values()->all())
                ->whereNull('call_key')
                ->chunkById($chunk, function (Collection $rows) use ($companyId, $types, &$done) {
                    $ids = $rows->pluck('id')->map(fn ($id) => (int) $id)->all();
                    $this->assign((int) $companyId, $ids, $types);
                    $done += count($ids);
                });
        }

        return $done;
    }

    /**
     * Work the keys out in SQL (a SELECT, since MySQL cannot update a table
     * from a subquery on itself) and write them back.
     *
     * @param  list<int>  $ids
     * @param  Collection<string, int>  $types
     */
    private function assign(int $companyId, array $ids, Collection $types): void
    {
        $ids = array_values(array_unique($ids));
        if ($ids === []) {
            return;
        }

        $connection = DB::connection();
        $keys = DB::table('crm_events')
            ->where('company_id', $companyId)
            ->whereIn('id', $ids)
            ->selectRaw('id, '.$this->expression($connection, $types).' as call_key')
            ->pluck('call_key', 'id');

        foreach ($keys as $id => $key) {
            DB::table('crm_events')
                ->where('id', (int) $id)
                ->update(['call_key' => mb_substr((string) ($key ?? ('e:'.$id)), 0, 191)]);
        }
    }

    /** @return Collection<string, int> slug => id */
    public function callTypes(int $companyId): Collection
    {
        // System types are seeded with company_id NULL and shared by everyone.
        return CrmEventType::withoutGlobalScopes()
            ->where(fn ($q) => $q->whereNull('company_id')->orWhere('company_id', $companyId))
            ->whereIn('slug', array_map(fn ($o) => 'call_'.$o, CallLogService::OUTCOMES))
            ->pluck('id', 'slug');
    }

    /** @return list<int> */
    private function allCallTypeIds(): array
    {
        return CrmEventType::withoutGlobalScopes()
            ->whereIn('slug', array_map(fn ($o) => 'call_'.$o, CallLogService::OUTCOMES))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Only "yes" is remembered: a long-running worker that started before the
     * migration must pick the column up once it exists.
     */
    private static function hasColumn(bool $refresh = false): bool
    {
        if (! $refresh && self::$hasColumn === true) {
            return true;
        }

        try {
            self::$hasColumn = Schema::hasColumn('crm_events', 'call_key');
        } catch (\Throwable) {
            self::$hasColumn = false;
        }

        return self::$hasColumn;
    }

    /**
     * SQL for "which call is this event part of".
     *
     * In order:
     *
     * 1. The event's own id: the shared SIP Call-ID (`call_id`), else its
     *    `call_ref`, which the answering browser puts on both the start and
     *    the end of its call. Placeholder ids ("call-179") are reused across
     *    calls and never count.
     * 2. Older missed/declined legs logged under a per-browser id (call_id =
     *    call_ref) take the SIP Call-ID of the ringing event (`incoming_call`,
     *    stored as call_started) for the same caller number just before them,
     *    preferring the same agent's own, within five minutes, so they land in
     *    the same call as the answered and ringing legs. With no ringing event,
     *    caller number within a three-minute window.
     * 3. An outbound "started" with no id of its own (click-to-call logs it as
     *    it dials) takes the id of the next outcome the same agent logged for
     *    the same number, within two hours and before that agent dialled the
     *    number again, so "started" and "completed" are one call while
     *    back-to-back attempts stay apart.
     * 4. The bridge correlation id; else the event stands alone.
     *
     * @param  Collection<string, int>  $types
     */
    public function expression(ConnectionInterface $connection, Collection $types): string
    {
        $grammar = $connection->getQueryGrammar();
        $callId = $grammar->wrap('crm_events.metadata->call_id');
        $callRef = $grammar->wrap('crm_events.metadata->call_ref');
        $phone = $grammar->wrap('crm_events.metadata->phone_number');
        $sqlite = $connection->getDriverName() === 'sqlite';

        // Browser-local placeholders ("call-3", "call-waiting-3") are reused
        // across calls; every other id identifies one call. Same rule as
        // TelephonySoftphoneEventController::isAuthoritativeCallId().
        $placeholder = fn (string $expr) => $sqlite
            ? "(({$expr} GLOB 'call-[0-9]*' AND SUBSTR({$expr}, 6) NOT GLOB '*[^0-9]*')"
                ." OR ({$expr} GLOB 'call-waiting-[0-9]*' AND SUBSTR({$expr}, 14) NOT GLOB '*[^0-9]*'))"
            : "({$expr} REGEXP '^call-(waiting-)?[0-9]+$')";

        // An id that identifies one call, or NULL.
        $usable = fn (string $expr) => "(CASE WHEN {$expr} IS NULL OR {$expr} = '' OR ".$placeholder($expr)." THEN NULL ELSE {$expr} END)";
        $ownId = fn (string $alias) => 'COALESCE('
            .$usable($grammar->wrap("{$alias}.metadata->call_id")).', '
            .$usable($grammar->wrap("{$alias}.metadata->call_ref")).')';

        $bucket = $sqlite
            ? "CAST(CAST(strftime('%s', crm_events.occurred_at) AS INTEGER) / 180 AS TEXT)"
            : 'CAST(FLOOR(UNIX_TIMESTAMP(crm_events.occurred_at) / 180) AS CHAR)';
        $id = $sqlite ? 'CAST(crm_events.id AS TEXT)' : 'CAST(crm_events.id AS CHAR)';
        $concat = fn (string ...$parts) => $sqlite
            ? '('.implode(' || ', $parts).')'
            : 'CONCAT('.implode(', ', $parts).')';

        $legacyKey = $concat("'p:'", $phone, "':'", $bucket);

        $startedId = isset($types['call_started']) ? (int) $types['call_started'] : null;
        if ($startedId !== null) {
            $ringCallId = $grammar->wrap('ring.metadata->call_id');
            $ringCallRef = $grammar->wrap('ring.metadata->call_ref');
            $ringPhone = $grammar->wrap('ring.metadata->phone_number');
            $lookback = (int) self::RING_LOOKBACK_SECONDS;
            $since = $sqlite
                ? "datetime(crm_events.occurred_at, '-{$lookback} seconds')"
                : "crm_events.occurred_at - INTERVAL {$lookback} SECOND";

            // Latest ringing event for this number just before the leg; the
            // outer row is only referenced in WHERE (SQLite rejects it in
            // ORDER BY), so "same agent first" is two lookups, not one sort.
            $ringing = fn (string $extra) => "(SELECT {$ringCallId} FROM crm_events ring"
                .' WHERE ring.company_id = crm_events.company_id'
                ." AND ring.event_type_id = {$startedId}"
                ." AND ring.direction = 'inbound'"
                ." AND {$ringPhone} = {$phone}"
                .' AND '.$usable($ringCallId).' IS NOT NULL'
                ." AND ({$ringCallRef} IS NULL OR {$ringCallId} <> {$ringCallRef})"
                ." AND ring.occurred_at BETWEEN {$since} AND crm_events.occurred_at"
                .$extra
                .' ORDER BY ring.occurred_at DESC, ring.id DESC'
                .' LIMIT 1)';

            $legacyKey = 'COALESCE('
                .$ringing(' AND ring.user_id = crm_events.user_id').', '
                .$ringing('').', '
                ."{$legacyKey})";
        }

        $fallback = 'COALESCE(crm_events.correlation_id, '.$concat("'e:'", $id).')';
        $outboundStart = null;

        if ($startedId !== null) {
            $outcomePhone = $grammar->wrap('outcome.metadata->phone_number');
            $redialPhone = $grammar->wrap('redial.metadata->phone_number');
            $window = self::OUTBOUND_WINDOW_SECONDS;
            $until = $sqlite
                ? "datetime(crm_events.occurred_at, '+{$window} seconds')"
                : "crm_events.occurred_at + INTERVAL {$window} SECOND";

            $nextOutcome = '(SELECT '.$ownId('outcome').' FROM crm_events outcome'
                .' WHERE outcome.company_id = crm_events.company_id'
                ." AND outcome.event_type_id <> {$startedId}"
                .' AND outcome.event_type_id IN ('.implode(',', array_map('intval', $types->values()->all())).')'
                ." AND outcome.direction = 'outbound'"
                .' AND outcome.user_id = crm_events.user_id'
                ." AND {$outcomePhone} = {$phone}"
                .' AND (outcome.occurred_at > crm_events.occurred_at'
                .' OR (outcome.occurred_at = crm_events.occurred_at AND outcome.id > crm_events.id))'
                ." AND outcome.occurred_at <= {$until}"
                .' AND '.$ownId('outcome').' IS NOT NULL'
                .' AND NOT EXISTS (SELECT 1 FROM crm_events redial'
                .' WHERE redial.company_id = crm_events.company_id'
                ." AND redial.event_type_id = {$startedId}"
                ." AND redial.direction = 'outbound'"
                .' AND redial.user_id = crm_events.user_id'
                ." AND {$redialPhone} = {$phone}"
                .' AND (redial.occurred_at > crm_events.occurred_at'
                .' OR (redial.occurred_at = crm_events.occurred_at AND redial.id > crm_events.id))'
                .' AND (redial.occurred_at < outcome.occurred_at'
                .' OR (redial.occurred_at = outcome.occurred_at AND redial.id < outcome.id)))'
                .' ORDER BY outcome.occurred_at, outcome.id'
                .' LIMIT 1)';

            $outboundStart = "WHEN crm_events.direction = 'outbound' AND crm_events.event_type_id = {$startedId} AND {$phone} IS NOT NULL "
                ."THEN COALESCE({$nextOutcome}, {$fallback}) ";
        }

        return "(CASE WHEN crm_events.direction = 'inbound' AND {$callId} IS NOT NULL AND {$callId} = {$callRef} AND {$phone} IS NOT NULL "
            ."THEN {$legacyKey} "
            .'WHEN '.$ownId('crm_events').' IS NOT NULL THEN '.$ownId('crm_events').' '
            .($outboundStart ?? '')
            ."ELSE {$fallback} END)";
    }
}
