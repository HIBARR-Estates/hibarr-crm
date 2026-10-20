<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The lead AI summary is built from the viewer's visible records — the
     * linked deals they may read and the notes they may read. Serving one
     * viewer's summary to another would expose records the other cannot open,
     * so a summary is stored per viewer.
     *
     * `viewer_key` is the authenticated viewer's id, and empty for the
     * background/system context that has no viewer. The unique key gains the
     * column so each viewer gets their own row; deal summaries keep the
     * empty key and stay shared.
     */
    public function up(): void
    {
        Schema::table('entity_ai_summaries', function (Blueprint $table): void {
            $table->string('viewer_key', 64)->default('')->after('entity_id');
        });

        Schema::table('entity_ai_summaries', function (Blueprint $table): void {
            // The per-viewer key is created first: the existing rows are
            // already unique on the old key, so they satisfy the wider one.
            $table->unique(
                ['company_id', 'entity_type', 'entity_id', 'viewer_key'],
                'entity_ai_summaries_entity_viewer_unique'
            );
        });

        Schema::table('entity_ai_summaries', function (Blueprint $table): void {
            // The old unique key spans every viewer; it has to go before the
            // per-viewer rows can coexist.
            $table->dropUnique('entity_ai_summaries_entity_unique');
        });
    }

    public function down(): void
    {
        // Collapse the per-viewer rows back to one per entity, keeping the
        // most recently generated — the old unique key cannot hold two rows
        // for the same entity.
        $keep = DB::table('entity_ai_summaries')
            ->selectRaw('company_id, entity_type, entity_id, MAX(id) as id')
            ->groupBy('company_id', 'entity_type', 'entity_id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        DB::table('entity_ai_summaries')
            ->whereNotIn('id', $keep)
            ->delete();

        Schema::table('entity_ai_summaries', function (Blueprint $table): void {
            $table->unique(['company_id', 'entity_type', 'entity_id'], 'entity_ai_summaries_entity_unique');
        });

        Schema::table('entity_ai_summaries', function (Blueprint $table): void {
            $table->dropUnique('entity_ai_summaries_entity_viewer_unique');
        });

        Schema::table('entity_ai_summaries', function (Blueprint $table): void {
            $table->dropColumn('viewer_key');
        });
    }
};
