<?php

namespace Tests\Unit\EntitySummary;

use App\Enums\Salutation;
use App\Models\Lead;
use App\Services\EntitySummary\LeadSummaryInputBuilder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class LeadSummaryInputBuilderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();

        Schema::dropIfExists('taskables');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('lead_notes');
        Schema::dropIfExists('deals');

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->text('details')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->string('remark')->nullable();
            $table->timestamp('next_follow_up_date')->nullable();
            $table->string('status')->nullable();
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
    }

    protected function tearDown(): void
    {
        Mockery::close();

        Schema::dropIfExists('taskables');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('lead_notes');
        Schema::dropIfExists('deals');

        parent::tearDown();
    }

    public function test_build_does_not_crash_when_salutation_is_enum(): void
    {
        $lead = $this->makeLeadForBuilder([
            'id' => 8521,
            'client_name' => 'Jane Doe',
            'salutation' => Salutation::Mr,
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertSame($lead->client_name_salutation, $payload['lead']['name']);
        $this->assertStringContainsString('Jane Doe', $payload['lead']['name']);
    }

    public function test_build_uses_client_name_when_salutation_is_null(): void
    {
        $lead = $this->makeLeadForBuilder([
            'id' => 10,
            'client_name' => 'Jane Doe',
            'salutation' => null,
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertSame('Jane Doe', $payload['lead']['name']);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function makeLeadForBuilder(array $attributes): Lead
    {
        $lead = Mockery::mock(Lead::class)->makePartial();

        foreach ($attributes as $key => $value) {
            $lead->{$key} = $value;
        }

        $lead->created_at = now();
        $lead->updated_at = now();
        $lead->client_email = null;
        $lead->mobile = null;
        $lead->cell = null;
        $lead->office = null;
        $lead->gender = null;
        $lead->languages = null;
        $lead->date_of_birth = null;
        $lead->nationality = null;
        $lead->occupation = null;
        $lead->company_name = null;
        $lead->preferred_contact_times = [];
        $lead->preferred_contact_time = null;
        $lead->lead_lifecycle_status_id = null;
        $lead->lead_owner = null;
        $lead->source_id = null;
        $lead->category_id = null;

        $lead->shouldReceive('loadMissing')->andReturnUsing(function () use ($lead) {
            $lead->setRelation('leadOwner', null);
            $lead->setRelation('addedBy', null);
            $lead->setRelation('leadSource', null);
            $lead->setRelation('category', null);
            $lead->setRelation('lifecycleStatus', null);
            $lead->setRelation('marketing', null);

            return $lead;
        });

        $emptyTasks = Mockery::mock();
        $emptyTasks->shouldReceive('with')->andReturnSelf();
        $emptyTasks->shouldReceive('orderByDesc')->andReturnSelf();
        $emptyTasks->shouldReceive('limit')->andReturnSelf();
        $emptyTasks->shouldReceive('get')->andReturn(collect());
        $emptyTasks->shouldReceive('count')->andReturn(0);
        $emptyTasks->shouldReceive('max')->andReturn(null);
        $lead->shouldReceive('tasks')->andReturn($emptyTasks);

        return $lead;
    }
}
