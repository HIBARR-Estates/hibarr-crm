<?php

namespace Tests\Unit\EntitySummary;

use App\Models\Deal;
use App\Models\DealHistory;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Services\EntitySummary\DealSummaryInputBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class DealSummaryInputBuilderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('slug')->nullable();
            $table->integer('priority')->default(0);
            $table->string('label_color')->nullable();
            $table->integer('default')->default(0);
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

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('hash')->nullable();
            $table->unsignedBigInteger('lead_pipeline_id')->nullable();
            $table->unsignedBigInteger('pipeline_stage_id')->nullable();
            $table->string('next_follow_up')->default('no');
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->text('details')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->string('remark')->nullable();
            $table->timestamp('next_follow_up_date')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_files', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->string('filename')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_histories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->string('event_type')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('heading')->nullable();
            $table->unsignedBigInteger('board_column_id')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('taskable_id');
            $table->string('taskable_type');
        });

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('model')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('custom_field_group_id')->nullable();
            $table->string('label')->nullable();
            $table->string('name')->nullable();
            $table->string('type')->nullable();
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('custom_field_id');
            $table->string('model')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->text('value')->nullable();
        });

        Schema::create('lead_flight_itineraries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->string('direction')->nullable();
            $table->string('airport_name')->nullable();
            $table->string('flight_number')->nullable();
            $table->timestamp('flight_date')->nullable();
            $table->string('status')->nullable();
            $table->boolean('is_transfer_required')->default(false);
            $table->string('ticket_image_url')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();

        Schema::dropIfExists('lead_flight_itineraries');
        Schema::dropIfExists('custom_fields_data');
        Schema::dropIfExists('custom_fields');
        Schema::dropIfExists('custom_field_groups');
        Schema::dropIfExists('taskables');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('deal_histories');
        Schema::dropIfExists('deal_files');
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('deal_notes');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('pipeline_stages');
        Schema::dropIfExists('lead_pipelines');

        parent::tearDown();
    }

    public function test_build_includes_pipeline_stages_ordered_by_priority(): void
    {
        $pipeline = LeadPipeline::create([
            'name' => 'Sales Pipeline',
            'slug' => 'sales-pipeline',
            'priority' => 1,
            'label_color' => '#3366ff',
            'default' => 0,
        ]);

        $firstStage = PipelineStage::create([
            'lead_pipeline_id' => $pipeline->id,
            'name' => 'Consultation',
            'slug' => 'consultation',
            'priority' => 1,
            'type' => 'lead',
            'default' => 0,
            'label_color' => '#3366ff',
        ]);

        PipelineStage::create([
            'lead_pipeline_id' => $pipeline->id,
            'name' => 'Closing',
            'slug' => 'closing',
            'priority' => 2,
            'type' => 'lead',
            'default' => 0,
            'label_color' => '#00aa00',
        ]);

        $deal = $this->makeDealForBuilder([
            'id' => 1,
            'name' => 'Pipeline Deal',
            'value' => 10000,
            'lead_pipeline_id' => $pipeline->id,
            'pipeline_stage_id' => $firstStage->id,
        ], [
            'leadStage' => $firstStage,
            'pipeline' => $pipeline,
            'packages' => collect(),
            'products' => collect(),
            'hibarrFields' => null,
        ]);

        $payload = app(DealSummaryInputBuilder::class)->build($deal);

        $this->assertSame('Sales Pipeline', $payload['pipeline']['name']);
        $this->assertCount(2, $payload['pipeline']['stages']);
        $this->assertSame('consultation', $payload['pipeline']['current_stage_key']);
        $this->assertSame('Consultation', $payload['pipeline']['stages'][0]['label']);
    }

    public function test_build_omits_empty_sections(): void
    {
        $deal = $this->makeDealForBuilder([
            'id' => 1,
            'name' => 'Empty Deal',
            'value' => 5000,
        ], [
            'packages' => collect(),
            'products' => collect(),
            'hibarrFields' => null,
        ]);

        $payload = app(DealSummaryInputBuilder::class)->build($deal);

        $this->assertArrayNotHasKey('sections', $payload);
        $this->assertCount(8, $payload['action_taxonomy']);
        $this->assertSame([], $payload['deal']['packages']);
        $this->assertArrayHasKey('value', $payload['deal']);
        $this->assertArrayNotHasKey('calculated_value', $payload['deal']);
        $this->assertArrayNotHasKey('manual_value', $payload['deal']);
        $this->assertArrayHasKey('viewer', $payload);
        $this->assertArrayHasKey('timezone', $payload['viewer']);
        $this->assertNull($payload['deal']['currency']);
    }

    public function test_build_activity_distinguishes_system_and_agent(): void
    {
        $deal = Model::withoutEvents(fn () => Deal::create([
            'name' => 'Activity Deal',
            'value' => 5000,
            'hash' => md5('activity-deal'),
            'next_follow_up' => 'no',
        ]));

        DealHistory::create([
            'deal_id' => $deal->id,
            'event_type' => 'follow-up-created',
        ]);

        DealHistory::create([
            'deal_id' => $deal->id,
            'event_type' => 'note_added',
        ]);

        $builderDeal = $this->makeDealForBuilder([
            'id' => $deal->id,
            'name' => 'Activity Deal',
            'value' => 5000,
        ], [
            'packages' => collect(),
            'products' => collect(),
            'hibarrFields' => null,
        ]);

        $payload = app(DealSummaryInputBuilder::class)->build($builderDeal);

        $this->assertArrayHasKey('activity', $payload['sections']);
        $types = collect($payload['sections']['activity'])->pluck('type')->all();

        $this->assertContains('system', $types);
        $this->assertContains('agent', $types);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $relations
     */
    private function makeDealForBuilder(array $attributes, array $relations = []): Deal
    {
        $deal = Mockery::mock(Deal::class)->makePartial();

        foreach ($attributes as $key => $value) {
            $deal->{$key} = $value;
        }

        $deal->shouldReceive('loadMissing')
            ->andReturnUsing(function () use ($deal, $relations) {
                foreach ($relations as $name => $relation) {
                    $deal->setRelation($name, $relation);
                }

                return $deal;
            });

        $emptyTasks = Mockery::mock();
        $emptyTasks->shouldReceive('with')->andReturnSelf();
        $emptyTasks->shouldReceive('orderByDesc')->andReturnSelf();
        $emptyTasks->shouldReceive('limit')->andReturnSelf();
        $emptyTasks->shouldReceive('get')->andReturn(collect());

        $deal->shouldReceive('tasks')->andReturn($emptyTasks);

        if (! array_key_exists('products', $relations)) {
            $deal->setRelation('products', new Collection());
        }

        if (! array_key_exists('hibarrFields', $relations)) {
            $deal->setRelation('hibarrFields', null);
        }

        if (! array_key_exists('packages', $relations)) {
            $deal->setRelation('packages', new Collection());
        }

        return $deal;
    }
}
