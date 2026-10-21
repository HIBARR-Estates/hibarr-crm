<?php

namespace App\Support;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;

/**
 * Canonicalises the polymorphic `model_type` column on `crm_events`.
 *
 * Events reach `CrmEventService::record()` from several directions — HTTP, gRPC,
 * the call bridge — and not every caller sends a well-formed FQCN. In practice
 * these variants all turn up:
 *
 *   App\Models\Lead      the canonical form (what Eloquent writes)
 *   App\\Models\\Lead    over-escaped, e.g. from a JS string literal
 *   App/Models/Lead      slash separators
 *   AppModelsLead        stripslashes() artefact
 *   App\Model\lead       singular namespace + lowercase class
 *
 * Any of the non-canonical spellings stored verbatim, then fails the
 * `where('model_type', ...)` filter the entity timeline uses to fetch a record's
 * history — so the event is written successfully and then never displayed. That
 * failure is silent: no error, just a missing row.
 *
 * Matching is therefore done on a separator-free, lowercased key rather than by
 * string equality, and the singular-namespace variant is folded in so
 * `App\Model\lead` resolves to `App\Models\Lead`.
 */
final class PolymorphicModelType
{
    /** Models the timeline filters on, in the order they are tried. */
    private const CANDIDATES = [
        Lead::class,
        Deal::class,
        Task::class,
    ];

    /**
     * Return the canonical class name for $modelType, or $modelType unchanged
     * when it is not one of the models we know about.
     */
    public static function canonicalize(?string $modelType): ?string
    {
        if ($modelType === null) {
            return null;
        }

        $trimmed = trim($modelType);

        if ($trimmed === '') {
            return null;
        }

        $key = self::key($trimmed);

        foreach (self::CANDIDATES as $candidate) {
            if (self::key($candidate) === $key) {
                return $candidate;
            }
        }

        return $trimmed;
    }

    /**
     * Separator-free, lowercased comparison key.
     *
     * The `Models` namespace is folded to `Model` so the singular form
     * (`App\Model\lead`) compares equal to the canonical `App\Models\Lead`.
     */
    private static function key(string $value): string
    {
        $stripped = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $value));

        return str_replace('models', 'model', $stripped);
    }
}
