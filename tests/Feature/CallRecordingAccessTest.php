<?php

namespace Tests\Feature;

use App\Models\CallRecording;
use App\Models\CrmEvent;
use App\Models\Lead;
use App\Models\User;
use App\Services\CallRecording\CallRecordingTranscoder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

/**
 * Call recordings are tenant data: the bytes sit in object storage behind a
 * durable bearer link, so every read path has to authorise the caller before
 * it hands anything out.
 *
 * These cover the rules that protect that link:
 *  - the listing must never leak the raw storage URL;
 *  - playback and download must check ownership, tenancy and expiry;
 *  - an upload must not be labelled with a record or a line from another
 *    tenant, nor with a record the uploader may not see;
 *  - `call_ref` must not let one agent annotate another agent's call rows.
 */
class CallRecordingAccessTest extends TestCase
{
    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    private const USER_ID = 99;

    private const OTHER_USER_ID = 100;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        // Keep the upload on the local disk: no storage gateway, no network.
        Config::set('file_storage.base_url', '');
        Storage::fake('local');

        // No ffmpeg in the test environment — the controller then keeps the
        // original file, which is the fallback path we want to exercise.
        $this->instance(
            CallRecordingTranscoder::class,
            new CallRecordingTranscoder('/does/not/exist/ffmpeg')
        );

        Lead::unsetEventDispatcher();

        $this->seedEventTypes();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();

        parent::tearDown();
    }

    // ─── Listing ────────────────────────────────────────────────────────

    public function test_the_listing_never_hands_out_the_raw_storage_url(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $this->insertRecording([
            'user_id' => self::USER_ID,
            'external_url' => 'https://minio.test/call-recordings/99/call-1.mp3',
        ]);

        $response = $this->getJson(route('call-recordings.index'));

        $response->assertOk();

        $body = $response->getContent();

        $this->assertStringNotContainsString('minio.test', $body);
        $this->assertStringNotContainsString('external_url', $body);

        $row = $response->json('data.0');

        $this->assertSame(
            route('call-recordings.download', $row['id']),
            $row['download_url']
        );
    }

    public function test_the_listing_only_shows_the_callers_own_recordings(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $mine = $this->insertRecording(['user_id' => self::USER_ID]);
        $theirs = $this->insertRecording(['user_id' => self::OTHER_USER_ID]);

        $response = $this->getJson(route('call-recordings.index'));

        $response->assertOk();

        $ids = array_column($response->json('data'), 'id');

        $this->assertContains($mine, $ids);
        $this->assertNotContains($theirs, $ids);
    }

    // ─── Playback ───────────────────────────────────────────────────────

    public function test_play_is_forbidden_for_another_agents_recording(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::OTHER_USER_ID,
            'external_url' => 'https://minio.test/call-recordings/100/call-2.mp3',
        ]);

        $this->get($this->playUrl($recording))->assertForbidden();
    }

    public function test_play_is_forbidden_for_a_recording_from_another_company(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::USER_ID,
            'company_id' => self::OTHER_COMPANY_ID,
            'external_url' => 'https://minio.test/call-recordings/99/call-3.mp3',
        ]);

        $this->get($this->playUrl($recording))->assertForbidden();
    }

    public function test_play_is_gone_once_the_recording_has_expired(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::USER_ID,
            'expires_at' => now()->subDay(),
            'external_url' => 'https://minio.test/call-recordings/99/call-4.mp3',
        ]);

        $this->get($this->playUrl($recording))->assertStatus(410);
    }

    // ─── Download ───────────────────────────────────────────────────────

    public function test_download_is_forbidden_for_another_agents_recording(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::OTHER_USER_ID,
            'external_url' => 'https://minio.test/call-recordings/100/call-5.mp3',
        ]);

        $this->get($this->downloadUrl($recording))->assertForbidden();
    }

    public function test_download_is_forbidden_for_a_recording_from_another_company(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::USER_ID,
            'company_id' => self::OTHER_COMPANY_ID,
            'external_url' => 'https://minio.test/call-recordings/99/call-6.mp3',
        ]);

        $this->get($this->downloadUrl($recording))->assertForbidden();
    }

    public function test_download_is_gone_once_the_recording_has_expired(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::USER_ID,
            'expires_at' => now()->subDay(),
            'external_url' => 'https://minio.test/call-recordings/99/call-7.mp3',
        ]);

        $this->get($this->downloadUrl($recording))->assertStatus(410);
    }

    public function test_download_streams_the_bytes_through_the_app(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $recording = $this->insertRecording([
            'user_id' => self::USER_ID,
            'filename' => 'call-8.mp3',
            'mime_type' => 'audio/mpeg',
            'external_url' => 'https://minio.test/call-recordings/99/call-8.mp3',
        ]);

        Http::fake([
            '*' => Http::response('audio-bytes', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $response = $this->get($this->downloadUrl($recording).'?download=1');

        $response->assertOk();
        $response->assertHeader('Content-Disposition', 'attachment; filename="call-8.mp3"');
    }

    // ─── Upload ─────────────────────────────────────────────────────────

    public function test_store_rejects_a_line_from_another_company(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $deviceId = $this->insertDevice(self::OTHER_COMPANY_ID);

        $this->post(route('call-recordings.store'), [
            'recording' => UploadedFile::fake()->create('call.webm', 10, 'audio/webm'),
            'device_id' => $deviceId,
        ])->assertNotFound();

        $this->assertSame(0, CallRecording::count());
    }

    public function test_store_rejects_an_entity_from_another_company(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $leadId = $this->insertLead(self::OTHER_COMPANY_ID);

        $this->post(route('call-recordings.store'), [
            'recording' => UploadedFile::fake()->create('call.webm', 10, 'audio/webm'),
            'entity_type' => 'lead',
            'entity_id' => $leadId,
        ])->assertNotFound();

        $this->assertSame(0, CallRecording::count());
    }

    public function test_store_rejects_an_entity_the_caller_may_not_view(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser(['view_lead' => 'none']);

        $leadId = $this->insertLead(self::COMPANY_ID);

        $this->post(route('call-recordings.store'), [
            'recording' => UploadedFile::fake()->create('call.webm', 10, 'audio/webm'),
            'entity_type' => 'lead',
            'entity_id' => $leadId,
        ])->assertForbidden();

        $this->assertSame(0, CallRecording::count());
    }

    public function test_store_requires_both_halves_of_the_entity_reference(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $leadId = $this->insertLead(self::COMPANY_ID);

        $this->post(route('call-recordings.store'), [
            'recording' => UploadedFile::fake()->create('call.webm', 10, 'audio/webm'),
            'entity_id' => $leadId,
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertSame(0, CallRecording::count());
    }

    public function test_store_does_not_annotate_another_agents_call_events(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser();

        $mineId = $this->insertCallEvent(self::USER_ID, 'shared-call-ref');
        $theirsId = $this->insertCallEvent(self::OTHER_USER_ID, 'shared-call-ref');

        $this->post(route('call-recordings.store'), [
            'recording' => UploadedFile::fake()->create('call.webm', 10, 'audio/webm'),
            'call_ref' => 'shared-call-ref',
        ])->assertOk();

        $recordingId = (int) CallRecording::query()->max('id');

        $this->assertArrayNotHasKey(
            'recording_id',
            $this->eventMetadata($theirsId),
            "A recording must not be attached to another agent's call rows."
        );

        // Positive control: the uploader's own row is annotated.
        $this->assertSame(
            $recordingId,
            $this->eventMetadata($mineId)['recording_id'] ?? null
        );
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    /**
     * `SubstituteBindings` lives in the `web` middleware group, which these
     * tests disable, so the recording is handed to the controller through the
     * container rather than through the route parameter.
     */
    private function playUrl(int $recordingId): string
    {
        return route('call-recordings.play', $this->bindRecording($recordingId));
    }

    private function downloadUrl(int $recordingId): string
    {
        return route('call-recordings.download', $this->bindRecording($recordingId));
    }

    private function bindRecording(int $recordingId): CallRecording
    {
        $recording = CallRecording::query()->findOrFail($recordingId);

        $this->instance(CallRecording::class, $recording);

        return $recording;
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function actingAsUser(array $permissions = []): void
    {
        $permissions = array_merge([
            'make_softphone_calls' => 'all',
            'view_lead' => 'all',
            'view_deals' => 'all',
        ], $permissions);

        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = self::USER_ID;
        $user->company_id = self::COMPANY_ID;
        $user->shouldReceive('permission')->andReturnUsing(
            fn (string $name) => $permissions[$name] ?? 'none'
        );
        $user->shouldReceive('hasRole')->andReturn(false);

        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => self::COMPANY_ID]]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertRecording(array $attributes = []): int
    {
        return (int) DB::table('call_recordings')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'user_id' => self::USER_ID,
            'entity_type' => null,
            'entity_id' => null,
            'device_id' => null,
            'lead_name' => null,
            'phone_number' => null,
            'direction' => null,
            'routing_reason' => null,
            'filename' => 'call.mp3',
            'mime_type' => 'audio/mpeg',
            'size' => 1024,
            'duration_seconds' => 30,
            'object_path' => null,
            'external_url' => null,
            'expires_at' => now()->addDays(30),
            'call_ref' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function insertDevice(int $companyId): int
    {
        return (int) DB::table('softphone_devices')->insertGetId([
            'company_id' => $companyId,
            'label' => 'Line 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertLead(int $companyId): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'client_name' => 'Lead',
            'added_by' => self::USER_ID,
            'lead_owner' => self::USER_ID,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Insert a `call_ended` event carrying the given call reference. */
    private function insertCallEvent(int $userId, string $callRef): int
    {
        $typeId = (int) DB::table('crm_event_types')->where('slug', 'call_ended')->value('id');

        return (int) DB::table('crm_events')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'company_id' => self::COMPANY_ID,
            'event_type_id' => $typeId,
            'generation_type' => 'system_generated',
            'status' => 'completed',
            'direction' => 'outbound',
            'user_id' => $userId,
            'source' => 'system',
            'metadata' => json_encode(['call_ref' => $callRef]),
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function eventMetadata(int $eventId): array
    {
        $event = CrmEvent::withoutGlobalScopes()->find($eventId);

        return is_array($event?->metadata) ? $event->metadata : [];
    }

    /** Seed the shared `call_*` event types the timeline annotates. */
    private function seedEventTypes(): void
    {
        $categoryId = (int) DB::table('crm_event_categories')->insertGetId([
            'company_id' => null,
            'name' => 'Calls',
            'slug' => 'calls',
            'description' => null,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (['call_started', 'call_ended'] as $slug) {
            DB::table('crm_event_types')->insert([
                'company_id' => null,
                'category_id' => $categoryId,
                'name' => $slug,
                'slug' => $slug,
                'description' => null,
                'model_type' => null,
                'business_rule_id' => null,
                'is_system' => true,
                'is_active' => true,
                'sync_processing' => false,
                'metadata_schema' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('softphone_devices', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label')->nullable();
            $table->timestamps();
        });

        Schema::create('call_recordings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->unsignedBigInteger('device_id')->nullable();
            $table->string('lead_name')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('direction')->nullable();
            $table->string('routing_reason')->nullable();
            $table->string('filename');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('object_path')->nullable();
            $table->text('external_url')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('call_ref')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id');
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedInteger('business_rule_id')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(false);
            $table->text('metadata_schema')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->uuid('uuid');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('event_type_id');
            $table->string('generation_type');
            $table->string('status')->default('completed');
            $table->string('direction')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->unsignedInteger('causation_id')->nullable();
            $table->string('source')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    private function resetSchema(): void
    {
        foreach ([
            'crm_events',
            'crm_event_types',
            'crm_event_categories',
            'call_recordings',
            'softphone_devices',
            'leads',
            'users',
            'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
