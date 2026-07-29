<?php

namespace Tests\Unit\Services;

use App\Models\CustomFieldCategoryScope;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Services\PipelineScopeResolverService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Covers the stage-precedence rules documented on PipelineScopeResolverService:
 * stage assignment overrides pipeline-wide, resolution is cumulative up to and
 * including the current stage, and null means "show all" (no scopes configured).
 *
 * The equivalent rules are re-implemented in resources/js/Features/Deals/pipelineScopeUtils.ts
 * for pages that don't yet receive server-resolved scopes; keep both in sync.
 */
class PipelineScopeResolverServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Avoid firing model observers (e.g. LeadStageObserver) that expect the
        // full application schema — this test only needs a handful of tables.
        Event::fake();

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('slug')->nullable();
            $table->integer('priority')->default(0);
            $table->string('label_color')->nullable();
            $table->integer('default')->default(0);
            $table->boolean('hide_all_categories')->default(false);
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_pipeline_id')->nullable();
            $table->string('name')->nullable();
            $table->string('slug')->nullable();
            $table->integer('priority')->default(0);
            $table->string('type')->default('lead');
            $table->integer('default')->default(0);
            $table->string('label_color')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_field_category_scopes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('custom_field_category_scopes');
        Schema::dropIfExists('pipeline_stages');
        Schema::dropIfExists('lead_pipelines');

        parent::tearDown();
    }

    /**
     * @return array{0: LeadPipeline, 1: PipelineStage[]}
     */
    private function makePipelineWithStages(int $stageCount = 3): array
    {
        $pipeline = LeadPipeline::create(['name' => 'Sales Pipeline', 'priority' => 1]);

        $stages = [];
        for ($i = 1; $i <= $stageCount; $i++) {
            $stages[] = PipelineStage::create([
                'lead_pipeline_id' => $pipeline->id,
                'name' => "Stage {$i}",
                'priority' => $i,
                'type' => 'lead',
            ]);
        }

        return [$pipeline, $stages];
    }

    public function test_get_stage_ids_up_to_and_including_returns_cumulative_ids_in_priority_order(): void
    {
        [$pipeline, $stages] = $this->makePipelineWithStages(3);

        $resolver = app(PipelineScopeResolverService::class);

        $this->assertSame(
            [$stages[0]->id, $stages[1]->id],
            $resolver->getStageIdsUpToAndIncluding($pipeline->id, $stages[1]->id)
        );

        $this->assertSame(
            [$stages[0]->id],
            $resolver->getStageIdsUpToAndIncluding($pipeline->id, $stages[0]->id)
        );
    }

    public function test_resolve_category_ids_returns_null_when_no_scopes_configured(): void
    {
        [$pipeline, $stages] = $this->makePipelineWithStages(2);

        $resolver = app(PipelineScopeResolverService::class);

        $this->assertNull($resolver->resolveCategoryIds($pipeline->id, $stages[0]->id, 1));
    }

    public function test_resolve_category_ids_stage_assignment_overrides_pipeline_wide(): void
    {
        [$pipeline, $stages] = $this->makePipelineWithStages(2);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 100,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => null, // pipeline-wide
        ]);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 200,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => $stages[0]->id,
        ]);

        $resolver = app(PipelineScopeResolverService::class);

        // Stage 0 has its own scoped category (200); the pipeline-wide category (100)
        // must not leak in because the stage assignment takes precedence.
        $result = $resolver->resolveCategoryIds($pipeline->id, $stages[0]->id, 1);

        $this->assertSame([200], $result);
    }

    public function test_resolve_category_ids_is_cumulative_up_to_current_stage(): void
    {
        [$pipeline, $stages] = $this->makePipelineWithStages(3);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 10,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => $stages[0]->id,
        ]);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 20,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => $stages[1]->id,
        ]);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 30,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => $stages[2]->id,
        ]);

        $resolver = app(PipelineScopeResolverService::class);

        // At stage 2 (index 1), categories from stage 1 and stage 2 are visible,
        // but stage 3's category must not appear yet.
        $result = $resolver->resolveCategoryIds($pipeline->id, $stages[1]->id, 1);

        sort($result);
        $this->assertSame([10, 20], $result);
    }

    public function test_hide_all_categories_wins_outright_over_configured_scopes(): void
    {
        [$pipeline, $stages] = $this->makePipelineWithStages(2);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 100,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => null, // pipeline-wide
        ]);

        CustomFieldCategoryScope::create([
            'company_id' => 1,
            'category_id' => 200,
            'pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => $stages[0]->id,
        ]);

        $pipeline->company_id = 1;
        $pipeline->hide_all_categories = true;
        $pipeline->save();

        $resolver = app(PipelineScopeResolverService::class);

        // Even with real scopes configured, "hide all" overrides them entirely.
        $this->assertSame([], $resolver->resolveCategoryIds($pipeline->id, $stages[0]->id, 1));
        $this->assertSame([], $resolver->resolveAllCategoryIds($pipeline->id, 1));
        $this->assertTrue($resolver->pipelineHidesAllCategories($pipeline->id));
        $this->assertSame([$pipeline->id], $resolver->getHideAllCategoriesPipelineIds(1));
    }
}
