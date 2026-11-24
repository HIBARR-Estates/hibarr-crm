<?php

namespace Tests\Feature\EntitySummary;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The rollback of the per-viewer summary migration.
 *
 * A lead summary is built from the records its viewer may read, so a
 * viewer-scoped row cannot be collapsed into an entity-wide one: keeping it
 * would serve one viewer's private records to everyone once the column is
 * gone. The rollback therefore drops those rows instead of keeping the
 * newest one, and only the shared rows survive.
 */
class ViewerKeyMigrationRollbackTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('entity_ai_summaries');
        $this->createSchema();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('entity_ai_summaries');

        parent::tearDown();
    }

    public function test_rollback_drops_viewer_scoped_lead_summaries(): void
    {
        $migration = $this->migration();
        $migration->up();

        $this->seedSummary('lead', 1, '');
        $this->seedSummary('lead', 1, '7');
        $this->seedSummary('lead', 2, '9');
        $this->seedSummary('deal', 5, '');

        $migration->down();

        $this->assertFalse(Schema::hasColumn('entity_ai_summaries', 'viewer_key'));

        $this->assertSame(
            1,
            DB::table('entity_ai_summaries')->where('entity_type', 'lead')->where('entity_id', 1)->count(),
            'the shared lead summary should survive the rollback'
        );

        // Lead 2 only ever had a viewer-scoped summary. Collapsing it into an
        // entity-wide row would hand one viewer's records to everyone.
        $this->assertSame(
            0,
            DB::table('entity_ai_summaries')->where('entity_type', 'lead')->where('entity_id', 2)->count(),
            'a viewer-scoped lead summary must not be promoted to an entity-wide one'
        );

        $this->assertSame(
            1,
            DB::table('entity_ai_summaries')->where('entity_type', 'deal')->where('entity_id', 5)->count(),
            'deal summaries are shared and should survive the rollback'
        );
    }

    public function test_rollback_restores_the_entity_wide_unique_key(): void
    {
        $migration = $this->migration();
        $migration->up();

        $this->seedSummary('lead', 1, '');
        $this->seedSummary('lead', 1, '7');

        $migration->down();

        $indexes = collect(DB::select("PRAGMA index_list('entity_ai_summaries')"))
            ->pluck('name')
            ->all();

        $this->assertContains('entity_ai_summaries_entity_unique', $indexes);
        $this->assertNotContains('entity_ai_summaries_entity_viewer_unique', $indexes);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function migration(): Migration
    {
        // require, not require_once: each test needs its own instance, and the
        // file returns a fresh anonymous class every time it is evaluated.
        return require database_path('migrations/2026_10_20_000002_add_viewer_key_to_entity_ai_summaries.php');
    }

    private function seedSummary(string $entityType, int $entityId, string $viewerKey): void
    {
        DB::table('entity_ai_summaries')->insert([
            'company_id' => 1,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'viewer_key' => $viewerKey,
            'summary_json' => json_encode(['headline' => 'Summary for '.$entityType.' '.$entityId]),
            'input_hash' => hash('sha256', $entityType.$entityId.$viewerKey),
            'prompt_version' => 'v1',
            'generated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createSchema(): void
    {
        // The shape the migration sees before it runs: one row per entity.
        Schema::create('entity_ai_summaries', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 16);
            $table->unsignedBigInteger('entity_id');
            $table->json('summary_json');
            $table->string('input_hash', 64);
            $table->string('prompt_version', 32)->default('v1');
            $table->timestamp('generated_at');
            $table->unsignedInteger('generated_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'entity_type', 'entity_id'], 'entity_ai_summaries_entity_unique');
            $table->index(['company_id', 'entity_type']);
        });
    }
}
