<?php

namespace Tests\Unit\Http;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Models\CrmEvent;
use App\Models\Lead;
use App\Models\User;
use App\Services\CrmEventService;
use App\Services\CrmEventSubmissionGuard;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * The ingestion endpoint serves two kinds of caller: a signed-in session and an
 * API token. A session submission is attributed and authorized by the server;
 * a token submission keeps its own contract. These tests pin both.
 */
class CrmEventControllerSubmissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('crm_event_types');
        Schema::dropIfExists('crm_event_categories');
        Schema::dropIfExists('leads');
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

        $this->seedFixtures();
    }

    protected function tearDown(): void
    {
        Mockery::close();

        Schema::dropIfExists('crm_event_types');
        Schema::dropIfExists('crm_event_categories');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_a_session_submission_is_attributed_to_the_signed_in_user(): void
    {
        $recorded = $this->recordWithSession([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
            // The browser tries to pass the event off as someone else's work.
            'user_id' => 999,
            'generation_type' => 'system_generated',
        ]);

        $this->assertSame(7, $recorded['user_id']);
        $this->assertSame(CrmEventGenerationType::USER_GENERATED->value, $recorded['generation_type']);
        $this->assertSame(CrmEventSource::WEB->value, $recorded['source']);
    }

    public function test_a_session_submission_without_an_author_is_still_attributed(): void
    {
        $recorded = $this->recordWithSession([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
        ]);

        $this->assertSame(7, $recorded['user_id']);
        $this->assertSame(CrmEventGenerationType::USER_GENERATED->value, $recorded['generation_type']);
        $this->assertSame(CrmEventSource::WEB->value, $recorded['source']);
    }

    public function test_a_session_submission_ignores_a_supplied_correlation(): void
    {
        $recorded = $this->recordWithSession([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
            'correlation_id' => 'forged-correlation',
            'causation_id' => 4242,
        ]);

        $this->assertNotSame('forged-correlation', $recorded['correlation_id']);
        $this->assertNull($recorded['causation_id']);
    }

    public function test_a_refused_session_submission_reports_4xx_and_records_nothing(): void
    {
        $service = $this->mockService();

        $response = $this->controller()->store($this->sessionRequest([
            'event_type_slug' => 'no_such_type',
            'model_type' => Lead::class,
            'model_id' => 1,
        ]));

        $this->assertSame(422, $response->getStatusCode());
        $this->assertNotSame(201, $response->getStatusCode());
        $this->assertNotSame(202, $response->getStatusCode());
        $this->assertSame('error', $response->getData(true)['status']);

        // Nothing was recorded — no event, no dispatch, no first-contact stamp.
        $service->shouldNotHaveReceived('record');
    }

    public function test_a_token_submission_keeps_its_own_author_and_source(): void
    {
        $service = $this->mockService();
        $service->shouldReceive('record')
            ->once()
            ->andReturnUsing(function (): CrmEvent {
                $event = Mockery::mock(CrmEvent::class);
                $event->shouldReceive('toTimelineArray')->andReturn([]);

                return $event;
            });

        $response = $this->controller()->store($this->tokenRequest([
            'event_type_slug' => 'custom_note',
            'model_type' => Lead::class,
            'model_id' => 1,
            'user_id' => 42,
            'generation_type' => 'external',
        ]));

        $this->assertSame(201, $response->getStatusCode());

        $service->shouldHaveReceived('record')
            ->once()
            ->withArgs(function (array $params): bool {
                return $params['user_id'] === 42
                    && $params['generation_type'] === 'external'
                    && $params['source'] === CrmEventSource::API->value;
            });
    }

    public function test_a_session_batch_is_validated_before_anything_is_recorded(): void
    {
        $service = $this->mockService();

        $response = $this->controller()->storeBatch($this->sessionRequest([
            'events' => [
                [
                    'event_type_slug' => 'custom_note',
                    'model_type' => Lead::class,
                    'model_id' => 1,
                ],
                [
                    // The offending item.
                    'event_type_slug' => 'no_such_type',
                    'model_type' => Lead::class,
                    'model_id' => 1,
                ],
            ],
        ]));

        $this->assertSame(422, $response->getStatusCode());

        $body = $response->getData(true);
        $this->assertStringContainsString('Event 2', $body['message']);
        $this->assertArrayHasKey(1, $body['errors']);

        // The valid first item must not have been recorded either.
        $service->shouldNotHaveReceived('recordBatch');
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function recordWithSession(array $payload): array
    {
        $captured = null;

        $service = $this->mockService();
        $service->shouldReceive('record')
            ->once()
            ->andReturnUsing(function (array $params) use (&$captured) {
                $captured = $params;

                $event = Mockery::mock(CrmEvent::class);
                $event->shouldReceive('toTimelineArray')->andReturn([]);

                return $event;
            });

        $response = $this->controller()->store($this->sessionRequest($payload));

        $this->assertSame(201, $response->getStatusCode());
        $this->assertIsArray($captured);

        return $captured;
    }

    private function mockService(): Mockery\MockInterface
    {
        $service = Mockery::mock(CrmEventService::class);
        $service->shouldReceive('startCorrelation')->andReturnUsing(fn () => 'server-correlation');

        $this->app->instance(CrmEventService::class, $service);

        return $service;
    }

    private function controller(): \App\Http\Controllers\CrmEventController
    {
        return new \App\Http\Controllers\CrmEventController(
            $this->app->make(CrmEventService::class),
            $this->app->make(CrmEventSubmissionGuard::class),
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function sessionRequest(array $payload): Request
    {
        $request = Request::create('/account/crm-events', 'POST', $payload);
        $request->setUserResolver(fn () => $this->viewer());

        return $request;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function tokenRequest(array $payload): Request
    {
        $request = Request::create('/api/v1/crm-events', 'POST', $payload);
        // A token caller has no session user.
        $request->setUserResolver(fn () => null);
        $request->attributes->set('api_token_company_id', 1);

        return $request;
    }

    private function viewer(): User
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 7;
        $user->company_id = 1;

        $user->shouldReceive('permission')->andReturn('all');
        $user->setRelation('roles', collect());

        return $user;
    }

    private function seedFixtures(): void
    {
        $category = \DB::table('crm_event_categories')->insertGetId([
            'company_id' => 1,
            'slug' => 'general',
            'name' => 'General',
            'is_active' => true,
        ]);

        \DB::table('crm_event_types')->insert([
            'company_id' => null,
            'category_id' => $category,
            'slug' => 'custom_note',
            'name' => 'Custom note',
            'model_type' => null,
            'is_system' => false,
            'is_active' => true,
            'sync_processing' => true,
        ]);

        \DB::table('leads')->insert([
            'id' => 1,
            'company_id' => 1,
            'added_by' => 7,
            'lead_owner' => 7,
            'client_name' => 'Jane',
        ]);
    }
}
