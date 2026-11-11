<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backfill persisted crm_events rows that use the legacy `App\Model\lead`
     * model_type so they use the canonical `App\Models\Lead` type expected by
     * model timeline equality filters.
     *
     * PolymorphicModelType::canonicalize() handles new events, but rows
     * recorded before that was added may still carry the legacy format.
     */
    /**
     * The known model types, keyed the way PolymorphicModelType::canonicalize()
     * compares them: separator-free, lowercased, with `Models` folded to
     * `Model` so the legacy singular namespace matches the canonical one.
     */
    private const CANONICAL_TYPES = [
        'appmodellead' => 'App\Models\Lead',
        'appmodeldeal' => 'App\Models\Deal',
        'appmodeltask' => 'App\Models\Task',
    ];

    public function up(): void
    {
        // Canonicalize model_type values that use the legacy App\Model\ format
        // or other non-canonical variants. The canonical form is App\Models\Lead.
        //
        // Every predicate lives in one closure: chunkById() appends its own
        // `id > cursor` condition, and ungrouped orWhere() calls would bind
        // to that condition instead of to the whole set — the same rows would
        // then be fetched again for every chunk.
        DB::table('crm_events')
            ->where(function ($query) {
                // The legacy singular namespace (`App\Model\lead`). The
                // backslash is escaped with an explicit ESCAPE character so it
                // matches literally on every driver — SQLite has no default
                // LIKE escape, so the raw backslash would be swallowed by
                // MySQL's own escaping — while the trailing `%` stays a
                // wildcard.
                $query->whereRaw("model_type LIKE ? ESCAPE '!'", ['App\\Model\\%'])
                    // Separator variants (`App/Models/Lead`, `App//Models//Lead`).
                    ->orWhere('model_type', 'like', 'App/Models/%')
                    ->orWhere('model_type', 'like', 'App//Models//%')
                    // The remaining spellings PolymorphicModelType::canonicalize()
                    // knows: the over-escaped namespace (`App\\Models\\Lead`) and
                    // the stripslashes() artefact (`AppModelsLead`).
                    ->orWhere('model_type', 'like', 'App%Models%');
            })
            ->chunkById(1000, function ($events) {
                foreach ($events as $event) {
                    $canonical = $this->canonicalizeModelType($event->model_type);
                    if ($canonical !== $event->model_type) {
                        DB::table('crm_events')
                            ->where('id', $event->id)
                            ->update(['model_type' => $canonical]);
                    }
                }
            });
    }

    /**
     * Reverse the migration — no-op since we can't reliably determine
     * which rows were modified.
     */
    public function down(): void
    {
        // No-op: we can't reliably reverse the canonicalization
    }

    /**
     * Canormalize a model_type string to the canonical FQCN format.
     *
     * Mirrors PolymorphicModelType::canonicalize() for the legacy variants
     * that may exist in persisted rows.
     */
    private function canonicalizeModelType(string $modelType): string
    {
        // Remove leading backslash
        $modelType = ltrim($modelType, '\\');

        // Replace forward slashes with backslashes
        $modelType = str_replace('/', '\\', $modelType);

        // Remove duplicate backslashes
        $modelType = preg_replace('/\\\\+/', '\\', $modelType);

        // Known types are matched the way PolymorphicModelType::canonicalize()
        // matches them, so the legacy `App\Model\lead` spelling folds onto the
        // canonical `App\Models\Lead` instead of being passed through.
        $key = str_replace('models', 'model', strtolower((string) preg_replace('/[^a-z0-9]/i', '', $modelType)));

        if (isset(self::CANONICAL_TYPES[$key])) {
            return self::CANONICAL_TYPES[$key];
        }

        // Ensure it starts with App\
        if (! str_starts_with($modelType, 'App\\')) {
            $modelType = 'App\\' . $modelType;
        }

        return $modelType;
    }
};
