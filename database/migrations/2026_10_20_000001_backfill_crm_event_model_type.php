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
    public function up(): void
    {
        // Canonicalize model_type values that use the legacy App\Model\ format
        // or other non-canonical variants. The canonical form is App\Models\Lead.
        DB::table('crm_events')
            ->where('model_type', 'like', 'App\Model\%')
            ->orWhere('model_type', 'like', 'App/Models/%')
            ->orWhere('model_type', 'like', 'App//Models//%')
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

        // Ensure it starts with App\
        if (! str_starts_with($modelType, 'App\\')) {
            $modelType = 'App\\' . $modelType;
        }

        return $modelType;
    }
};
