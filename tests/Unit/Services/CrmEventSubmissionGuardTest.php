<?php

namespace Tests\Unit\Services;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Exceptions\CrmEventSubmissionException;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Services\CrmEventSubmissionGuard;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * A CRM event logged through a session is attributed and authorized by the
 * server, not by the browser. These tests pin that contract.
 */
class CrmEventSubmissionGuardTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('deal_watchers');
        Schema::dropIfExists('deal_participants');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('crm_event_types');
        Schema::dropIfExists('crm_event_categories');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->unsignedBigInteger('lead_owner')->nullable();
            $table->string('client_name')->nullable();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_participants', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
        });

        Schema::create('deal_watchers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
        });

        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug')->nullable();
            $table->string('name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->string('slug')->nullable();
            $table->string('name')->nullable();
            $table->string('model_type')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(true);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();

        Schema::dropIfExists('deal_watchers');
        Schema::dropIfExists('deal_participants');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('crm_event_types');
        Schema::dropIfExists('crm_event_categories');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_the_server_owns_the_attribution(): void
    {
        $this->seedFixtures();

        $prepared = $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
            // A browser trying to pass off the event as someone else's.
            'user_id' => 999,
            'generation_type' => 'system_generated',
            'correlation_id' => 'forged-correlation',
            'causation_id' => 4242,
        ], $this->viewer(), 1);

        $this->assertSame(7, $prepared['user_id']);
        $this->assertSame(CrmEventGenerationType::USER_GENERATED->value, $prepared['generation_type']);
        $this->assertSame(CrmEventSource::WEB->value, $prepared['source']);
        $this->assertNotSame('forged-correlation', $prepared['correlation_id']);
        $this->assertNotEmpty($prepared['correlation_id']);
        $this->assertNull($prepared['causation_id']);
    }

    public function test_omitting_the_author_produces_the_same_attribution(): void
    {
        $this->seedFixtures();

        $prepared = $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
        ], $this->viewer(), 1);

        $this->assertSame(7, $prepared['user_id']);
        $this->assertSame(CrmEventGenerationType::USER_GENERATED->value, $prepared['generation_type']);
        $this->assertSame(CrmEventSource::WEB->value, $prepared['source']);
    }

    public function test_a_system_event_type_is_refused(): void
    {
        $this->seedFixtures();

        $this->assertRejected('lead_updated', 'System event types');
    }

    public function test_an_inactive_event_type_is_refused(): void
    {
        $this->seedFixtures();

        $this->assertRejected('inactive_type', 'not active');
    }

    public function test_an_unknown_event_type_is_refused(): void
    {
        $this->seedFixtures();

        $this->assertRejected('no_such_type', 'Unknown event type');
    }

    public function test_an_event_type_for_another_record_type_is_refused(): void
    {
        $this->seedFixtures();

        $this->assertRejected('deal_only_type', 'not available for this record');
    }

    public function test_a_missing_target_is_refused(): void
    {
        $this->seedFixtures();

        $this->expectException(CrmEventSubmissionException::class);

        $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 404,
        ], $this->viewer(), 1);
    }

    public function test_an_inaccessible_target_is_refused(): void
    {
        $this->seedFixtures();

        $this->expectException(CrmEventSubmissionException::class);

        // 'none' on view_lead — the caller may not read the lead at all.
        $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
        ], $this->viewer('none'), 1);
    }

    public function test_an_unsupported_target_type_is_refused(): void
    {
        $this->seedFixtures();

        $this->expectException(CrmEventSubmissionException::class);

        $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => 'App\\Models\\Task',
            'model_id' => 1,
        ], $this->viewer(), 1);
    }

    public function test_a_future_occurrence_date_is_refused(): void
    {
        $this->seedFixtures();

        $this->expectException(CrmEventSubmissionException::class);

        $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
            'occurred_at' => now()->addDay()->toIso8601String(),
        ], $this->viewer(), 1);
    }

    public function test_a_historical_occurrence_date_is_allowed(): void
    {
        $this->seedFixtures();

        $prepared = $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
            // Before the record was created — a legitimate historical claim.
            'occurred_at' => now()->subYears(3)->toIso8601String(),
        ], $this->viewer(), 1);

        $this->assertNotNull($prepared['occurred_at']);
    }

    public function test_no_occurrence_date_leaves_it_to_the_server(): void
    {
        $this->seedFixtures();

        $prepared = $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
        ], $this->viewer(), 1);

        $this->assertNull($prepared['occurred_at']);
    }

    public function test_a_deal_target_is_supported(): void
    {
        $this->seedFixtures();

        $prepared = $this->guard()->prepare([
            'event_type_slug' => 'custom_note',
            'model_type' => Deal::class,
            'model_id' => 1,
        ], $this->viewer(), 1);

        $this->assertSame(Deal::class, $prepared['model_type']);
        $this->assertSame(1, $prepared['model_id']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function assertRejected(string $slug, string $expectedMessage): void
    {
        try {
            $this->guard()->prepare(array_merge([
                'event_type_slug' => $slug,
                'model_type' => Lead::class,
                'model_id' => 1,
            ], $this->overrides()), $this->viewer(), 1);
        } catch (CrmEventSubmissionException $e) {
            $this->assertStringContainsString($expectedMessage, $e->getMessage());
            $this->assertGreaterThanOrEqual(400, $e->status);
            $this->assertLessThan(500, $e->status);

            return;
        }

        $this->fail('Expected the submission to be refused.');
    }

    /**
     * @return array<string, mixed>
     */
    private function overrides(): array
    {
        return [];
    }

    private function guard(): CrmEventSubmissionGuard
    {
        return app(CrmEventSubmissionGuard::class);
    }

    private function seedFixtures(): void
    {
        $category = \DB::table('crm_event_categories')->insertGetId([
            'company_id' => 1,
            'slug' => 'general',
            'name' => 'General',
            'is_active' => true,
        ]);

        $this->eventType('custom_note', $category);
        $this->eventType('lead_updated', $category, ['is_system' => true]);
        $this->eventType('inactive_type', $category, ['is_active' => false]);
        $this->eventType('deal_only_type', $category, ['model_type' => Deal::class]);

        \DB::table('leads')->insert([
            'id' => 1,
            'company_id' => 1,
            'added_by' => 7,
            'lead_owner' => 7,
            'client_name' => 'Jane',
        ]);

        \DB::table('deals')->insert([
            'id' => 1,
            'company_id' => 1,
            'added_by' => 7,
            'name' => 'Deal',
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function eventType(string $slug, int $categoryId, array $attributes = []): void
    {
        \DB::table('crm_event_types')->insert(array_merge([
            'company_id' => null,
            'category_id' => $categoryId,
            'slug' => $slug,
            'name' => ucfirst(str_replace('_', ' ', $slug)),
            'model_type' => null,
            'is_system' => false,
            'is_active' => true,
            'sync_processing' => true,
        ], $attributes));
    }

    /**
     * A signed-in user holding the given read scope.
     */
    private function viewer(string $scope = 'all', int $userId = 7): User
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = $userId;

        $user->shouldReceive('permission')
            ->andReturnUsing(fn (string $name) => $scope);

        $user->setRelation('roles', collect());

        return $user;
    }
}
