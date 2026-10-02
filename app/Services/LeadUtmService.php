<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadMarketing;
use App\Models\LeadUtmTouch;
use Illuminate\Support\Facades\DB;

/**
 * First-touch attribution for lead UTM data.
 *
 * lead_marketing.utm_* holds the FIRST UTM set a lead ever arrived with and is
 * never overwritten. Every UTM set that arrives afterwards is appended to
 * lead_utm_touches, so the full history is kept on top of the original.
 */
class LeadUtmService
{
    /**
     * Pull the UTM keys out of a marketing payload.
     *
     * @return array{0: array<string, string>, 1: array<string, mixed>} [utm values, remaining payload]
     */
    public function splitPayload(array $payload): array
    {
        $utm = [];
        foreach (LeadUtmTouch::UTM_FIELDS as $field) {
            if (array_key_exists($field, $payload) && $payload[$field] !== null && $payload[$field] !== '') {
                $utm[$field] = (string) $payload[$field];
            }
            unset($payload[$field]);
        }

        return [$utm, $payload];
    }

    /**
     * Record an incoming UTM set for a lead. Returns the touch that was logged,
     * or null when there was nothing new to log.
     */
    public function record(Lead $lead, array $utm, ?string $origin = null): ?LeadUtmTouch
    {
        $utm = array_intersect_key(array_filter($utm, fn ($v) => $v !== null && $v !== ''), array_flip(LeadUtmTouch::UTM_FIELDS));

        if ($utm === []) {
            return null;
        }

        return DB::transaction(function () use ($lead, $utm, $origin) {
            // Lock the parent lead first: when no lead_marketing row exists yet
            // there is nothing to lock on it, so concurrent calls could each
            // decide they are the first touch.
            Lead::withoutGlobalScopes()->whereKey($lead->id)->lockForUpdate()->value('id');

            $marketing = LeadMarketing::query()->where('lead_id', $lead->id)->lockForUpdate()->first();

            $hasFirstTouch = $marketing && collect(LeadUtmTouch::UTM_FIELDS)->contains(fn ($f) => filled($marketing->{$f}));
            $isFirst = ! $hasFirstTouch;

            if ($isFirst) {
                // First in wins: lead_marketing keeps these values from now on.
                LeadMarketing::query()->updateOrCreate(['lead_id' => $lead->id], $utm);
            }

            // Skip an exact repeat of the most recent touch (e.g. API retries).
            $latest = LeadUtmTouch::query()->where('lead_id', $lead->id)->latest('id')->first();
            if ($latest && $this->sameUtm($latest, $utm)) {
                return null;
            }

            return LeadUtmTouch::create($utm + [
                'lead_id' => $lead->id,
                'origin' => $origin,
                'is_first_touch' => $isFirst,
            ]);
        });
    }

    private function sameUtm(LeadUtmTouch $touch, array $utm): bool
    {
        foreach (LeadUtmTouch::UTM_FIELDS as $field) {
            if (($touch->{$field} ?? null) !== ($utm[$field] ?? null)) {
                return false;
            }
        }

        return true;
    }
}
