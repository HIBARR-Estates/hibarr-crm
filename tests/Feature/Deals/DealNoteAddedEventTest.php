<?php

namespace Tests\Feature\Deals;

use App\Enums\MeetingAttendanceOutcome;
use App\Http\Controllers\DealNoteController;
use App\Http\Requests\StoreDealNote;
use App\Models\Company;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\User;
use App\Notifications\DealActivityNotification;
use App\Services\ApiV2\CrmWriteService;
use App\Services\DealAutomationService;
use App\Services\MeetingAttendanceConfirmationService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use ReflectionMethod;
use ReflectionProperty;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * A saved deal note must persist one deal_note_added event.
 *
 * PHPUnit runs in console, which makes DealNoteObserver skip event logging.
 * Tests that represent a web request flip that flag so the observer runs the
 * same way it does for the note form.
 */
class DealNoteAddedEventTest extends TestCase
{
    private DealNoteController $controller;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('queue.default', 'sync');
        Config::set('reminders.entity_reminders_company_allowlist', '');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedFixtures();

        Cache::flush();
        Notification::fake();

        // Construct while still "in console" so AccountBaseController does not
        // resolve the current route during construction.
        $this->controller = app(DealNoteController::class);
    }

    protected function tearDown(): void
    {
        $this->setRunningInConsole(true);
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_form_save_persists_one_note_added_event_with_preview_and_author(): void
    {
        $this->actingAsUser(1, ['admin']);

        $this->asWeb(function () {
            $this->controller->store($this->noteRequest(
                1,
                'Intro',
                '<p>Called the <strong>client</strong> today.</p>',
            ));
            $this->controller->store($this->noteRequest(
                1,
                'Follow up',
                '<p>Second note.</p>',
            ));
        });

        $events = $this->eventsFor('deal_note_added');
        $this->assertCount(2, $events, 'Each saved note persists one deal_note_added event.');

        $first = $events[0];
        $this->assertSame('Intro', $first['note_title']);
        $this->assertSame('Called the client today.', $first['note_preview']);
        $this->assertSame('Note added: Intro — Called the client today.', $first['comment']);
        $this->assertSame(1, (int) $first['added_by']);
        $this->assertSame(Deal::class, $first['model_type']);
        $this->assertSame(1, (int) $first['model_id']);
        $this->assertSame(1, (int) $first['user_id']);
        $this->assertSame('system_generated', $first['generation_type']);
        $this->assertSame('system', $first['source']);

        $this->assertSame(2, DB::table('deal_notes')->count());
        $this->assertSame(1, (int) DB::table('deal_notes')->where('title', 'Intro')->value('added_by'));

        $histories = DB::table('deal_histories')->where('event_type', 'note-added')->get();
        $this->assertCount(2, $histories);
        $this->assertSame(1, (int) $histories[0]->created_by);
        $this->assertNotNull($histories[0]->note_id);

        Notification::assertSentTo(User::query()->findOrFail(2), DealActivityNotification::class);

        $this->assertNotNull(DB::table('leads')->where('id', 1)->value('first_contacted_at'));
        $this->assertCount(1, $this->eventsFor('lead_first_contact'));
    }

    public function test_untitled_note_keeps_fallback_title_and_plain_text_preview(): void
    {
        $this->actingAsUser(1, ['admin']);

        $this->asWeb(function () {
            $this->controller->store($this->noteRequest(
                1,
                null,
                '<p>Called the <strong>client</strong> today.</p>',
            ));
        });

        $events = $this->eventsFor('deal_note_added');
        $this->assertCount(1, $events);
        $this->assertSame('Untitled Note', $events[0]['note_title']);
        $this->assertSame('Called the client today.', $events[0]['note_preview']);
        $this->assertSame(
            'Note added: Untitled Note — Called the client today.',
            $events[0]['comment'],
        );
        $this->assertNull(DB::table('deal_notes')->value('title'));
    }

    public function test_existing_first_contact_timestamp_is_preserved(): void
    {
        DB::table('leads')->where('id', 1)->update(['first_contacted_at' => '2026-08-01 09:00:00']);
        $this->actingAsUser(1, ['admin']);

        $this->asWeb(function () {
            $this->controller->store($this->noteRequest(1, 'Later', '<p>Already contacted.</p>'));
        });

        $this->assertSame(
            '2026-08-01 09:00:00',
            DB::table('leads')->where('id', 1)->value('first_contacted_at'),
        );
        $this->assertCount(1, $this->eventsFor('deal_note_added'));
        $this->assertCount(0, $this->eventsFor('lead_first_contact'));
    }

    public function test_deal_without_linked_lead_does_not_stamp_first_contact(): void
    {
        $this->actingAsUser(1, ['admin']);

        $this->asWeb(function () {
            $this->controller->store($this->noteRequest(3, 'No lead', '<p>Unlinked deal.</p>'));
        });

        $this->assertNull(DB::table('leads')->where('id', 1)->value('first_contacted_at'));
        $this->assertCount(1, $this->eventsFor('deal_note_added'));
        $this->assertSame(3, (int) $this->eventsFor('deal_note_added')[0]['model_id']);
        $this->assertCount(0, $this->eventsFor('lead_first_contact'));
    }

    public function test_empty_note_body_is_rejected_without_an_event(): void
    {
        $request = $this->noteRequest(1, 'Nope', '<p><br></p>');

        try {
            $request->validateResolved();
            $this->fail('An empty note body should fail validation.');
        } catch (ValidationException) {
            // Expected.
        }

        $this->assertSame(0, DB::table('deal_notes')->count());
        $this->assertCount(0, $this->eventsFor('deal_note_added'));
    }

    public function test_watcher_cannot_create_a_note_or_event(): void
    {
        $this->actingAsUser(2, ['employee']);

        try {
            $this->asWeb(function () {
                $this->controller->store($this->noteRequest(1, 'Blocked', '<p>Should not save.</p>'));
            });
            $this->fail('A watcher-only user should be rejected.');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }

        $this->assertSame(0, DB::table('deal_notes')->count());
        $this->assertCount(0, $this->eventsFor('deal_note_added'));
        $this->assertSame(0, DB::table('deal_histories')->count());
    }

    public function test_another_companys_deal_cannot_receive_a_note_or_event(): void
    {
        $this->actingAsUser(1, ['admin']);

        try {
            $this->asWeb(function () {
                $this->controller->store($this->noteRequest(2, 'Wrong tenant', '<p>No.</p>'));
            });
            $this->fail('A deal outside the company should not be found.');
        } catch (ModelNotFoundException) {
            // Company scope hides the other tenant's deal, so findOrFail 404s.
        }

        $this->assertSame(0, DB::table('deal_notes')->count());
        $this->assertCount(0, $this->eventsFor('deal_note_added'));
    }

    public function test_web_automation_logs_one_observer_event_and_skips_the_fallback(): void
    {
        $this->actingAsUser(1, ['admin']);

        $this->asWeb(function () {
            $this->performCreateNote();
        });

        $events = $this->eventsFor('deal_note_added');
        $this->assertCount(1, $events);
        $this->assertStringStartsWith('Note added: Auto title', $events[0]['comment']);
        $this->assertStringNotContainsString('by automation', $events[0]['comment']);
    }

    public function test_console_automation_logs_only_the_fallback_event(): void
    {
        $this->actingAsUser(1, ['admin']);
        $this->setRunningInConsole(true);

        $this->performCreateNote();

        $events = $this->eventsFor('deal_note_added');
        $this->assertCount(1, $events);
        $this->assertSame('Note added by automation: Auto title', $events[0]['comment']);
    }

    public function test_meeting_confirmation_logs_a_note_event_and_a_distinct_outcome_event(): void
    {
        $this->actingAsUser(1, ['admin']);
        $user = User::query()->findOrFail(1);
        $deal = Deal::query()->findOrFail(1);

        $followUp = new DealFollowUp;
        $followUp->id = 50;
        $followUp->deal_id = $deal->id;
        $followUp->exists = true;
        $followUp->setRelation('deal', $deal);
        $followUp->setRelation('lead', null);
        $followUp->setRelation('meetingType', null);

        $this->asWeb(function () use ($followUp, $user) {
            $method = new ReflectionMethod(
                MeetingAttendanceConfirmationService::class,
                'recordOutcomeNoteAndEvent',
            );
            $method->setAccessible(true);
            $method->invoke(
                app(MeetingAttendanceConfirmationService::class),
                $followUp,
                $user,
                MeetingAttendanceOutcome::Attended,
                'They showed up',
            );
        });

        $noteEvents = $this->eventsFor('deal_note_added');
        $outcomeEvents = $this->eventsFor('deal_meeting_outcome_logged');
        $this->assertCount(1, $noteEvents);
        $this->assertCount(1, $outcomeEvents);
        $this->assertSame($noteEvents[0]['note_id'], $outcomeEvents[0]['note_id']);
        $this->assertSame('attended', $outcomeEvents[0]['outcome']);
    }

    public function test_api_note_create_logs_one_event_on_the_web_and_in_console(): void
    {
        $this->actingAsUser(1, ['admin']);
        $payload = [
            'deal_id' => 1,
            'title' => 'API note',
            'details' => '<p>From the api.</p>',
            'created_by_user_id' => 1,
        ];

        $this->asWeb(function () use ($payload) {
            app(CrmWriteService::class)->createNote(1, $payload);
        });

        $this->assertCount(1, $this->eventsFor('deal_note_added'));

        $this->setRunningInConsole(true);
        app(CrmWriteService::class)->createNote(1, [
            'deal_id' => 1,
            'title' => 'Console api note',
            'details' => '<p>From a job.</p>',
            'created_by_user_id' => 1,
        ]);

        $this->assertCount(2, $this->eventsFor('deal_note_added'));
    }

    private function performCreateNote(): void
    {
        $method = new ReflectionMethod(DealAutomationService::class, 'performCreateNote');
        $method->setAccessible(true);
        $method->invoke(
            app(DealAutomationService::class),
            Deal::query()->findOrFail(1),
            (object) [
                'title' => 'Auto title',
                'content' => 'Auto body',
                'assigner_type' => 'specific_user',
                'assigner_user_id' => 1,
            ],
            null,
        );
    }

    private function asWeb(callable $callback): void
    {
        $this->setRunningInConsole(false);

        try {
            $callback();
        } finally {
            $this->setRunningInConsole(true);
        }
    }

    private function setRunningInConsole(bool $running): void
    {
        $property = new ReflectionProperty(app(), 'isRunningInConsole');
        $property->setAccessible(true);
        $property->setValue(app(), $running);
    }

    private function actingAsUser(int $userId, array $roles): void
    {
        $user = User::query()->findOrFail($userId);
        // setUser avoids the login listener, which records a device row.
        auth()->setUser($user);
        session()->forget('user');
        session(['user_roles' => $roles]);
        session(['company' => Company::query()->findOrFail($user->company_id)]);
        Cache::put('user_modules_'.$user->id, []);
    }

    private function noteRequest(int $dealId, ?string $title, string $details): StoreDealNote
    {
        $payload = [
            'lead_id' => $dealId,
            'details' => $details,
        ];

        if ($title !== null) {
            $payload['title'] = $title;
        }

        $request = StoreDealNote::create('/deal-notes', 'POST', $payload);
        $request->setContainer(app());
        $request->setRedirector(app('redirect'));

        return $request;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function eventsFor(string $slug): array
    {
        return DB::table('crm_events')
            ->join('crm_event_types', 'crm_event_types.id', '=', 'crm_events.event_type_id')
            ->where('crm_event_types.slug', $slug)
            ->orderBy('crm_events.id')
            ->get([
                'crm_events.metadata',
                'crm_events.model_type',
                'crm_events.model_id',
                'crm_events.user_id',
                'crm_events.generation_type',
                'crm_events.source',
            ])
            ->map(function ($row) {
                $metadata = json_decode($row->metadata ?? '[]', true) ?: [];

                return array_merge($metadata, [
                    'model_type' => $row->model_type,
                    'model_id' => $row->model_id,
                    'user_id' => $row->user_id,
                    'generation_type' => $row->generation_type,
                    'source' => $row->source,
                ]);
            })
            ->all();
    }

    private function seedFixtures(): void
    {
        DB::table('companies')->insert([
            ['id' => 1, 'company_name' => 'Acme', 'timezone' => 'UTC'],
            ['id' => 2, 'company_name' => 'Other', 'timezone' => 'UTC'],
        ]);

        DB::table('users')->insert([
            ['id' => 1, 'company_id' => 1, 'name' => 'Agent', 'email' => 'agent@example.test', 'status' => 'active'],
            ['id' => 2, 'company_id' => 1, 'name' => 'Watcher', 'email' => 'watcher@example.test', 'status' => 'active'],
        ]);

        DB::table('permission_types')->insert([
            ['id' => 1, 'name' => 'all'],
            ['id' => 2, 'name' => 'none'],
        ]);
        DB::table('permissions')->insert([
            ['id' => 1, 'name' => 'add_deal_note'],
            ['id' => 2, 'name' => 'edit_deals'],
        ]);
        DB::table('user_permissions')->insert([
            ['user_id' => 1, 'permission_id' => 1, 'permission_type_id' => 1],
            ['user_id' => 1, 'permission_id' => 2, 'permission_type_id' => 1],
            ['user_id' => 2, 'permission_id' => 1, 'permission_type_id' => 1],
            ['user_id' => 2, 'permission_id' => 2, 'permission_type_id' => 2],
        ]);

        DB::table('leads')->insert([
            'id' => 1,
            'company_id' => 1,
            'client_name' => 'Test Lead',
            'first_contacted_at' => null,
        ]);

        DB::table('deals')->insert([
            ['id' => 1, 'company_id' => 1, 'lead_id' => 1, 'added_by' => 1, 'name' => 'Deal'],
            ['id' => 2, 'company_id' => 2, 'lead_id' => null, 'added_by' => 1, 'name' => 'Other company'],
            ['id' => 3, 'company_id' => 1, 'lead_id' => null, 'added_by' => 1, 'name' => 'Unlinked'],
        ]);

        DB::table('deal_watchers')->insert([
            'deal_id' => 1,
            'user_id' => 2,
        ]);

        DB::table('crm_event_categories')->insert([
            'id' => 1,
            'company_id' => null,
            'name' => 'Deal',
            'slug' => 'deal',
            'is_active' => 1,
        ]);

        $types = [
            ['slug' => 'deal_note_added', 'sync_processing' => 0],
            ['slug' => 'lead_first_contact', 'sync_processing' => 1],
            ['slug' => 'deal_meeting_outcome_logged', 'sync_processing' => 1],
        ];

        foreach ($types as $index => $type) {
            DB::table('crm_event_types')->insert([
                'id' => $index + 1,
                'company_id' => null,
                'category_id' => 1,
                'name' => $type['slug'],
                'slug' => $type['slug'],
                'model_type' => Deal::class,
                'is_active' => 1,
                'is_system' => 1,
                'sync_processing' => $type['sync_processing'],
            ]);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name');
            $table->string('timezone')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('status')->nullable();
            $table->string('image')->nullable();
            $table->string('mobile')->nullable();
            $table->string('country_phonecode')->nullable();
            $table->string('salutation')->nullable();
            $table->timestamps();
        });

        Schema::create('permission_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('permission_type_id');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->timestamp('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->string('title')->nullable();
            $table->longText('details')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->string('integration_origin')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_histories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->string('event_type');
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('deal_stage_from_id')->nullable();
            $table->unsignedInteger('deal_stage_to_id')->nullable();
            $table->unsignedInteger('note_id')->nullable();
            $table->unsignedInteger('file_id')->nullable();
            $table->unsignedInteger('task_id')->nullable();
            $table->unsignedInteger('follow_up_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('proposal_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_watchers', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });

        Schema::create('deal_participants', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('email_notification_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id');
            $table->string('name');
            $table->string('slug');
            $table->string('model_type')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->string('uuid', 36);
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('event_type_id');
            $table->string('generation_type', 30)->default('user_generated');
            $table->string('status', 20)->default('completed');
            $table->string('direction', 10)->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedInteger('model_id')->nullable();
            $table->string('correlation_id', 36)->nullable();
            $table->unsignedInteger('causation_id')->nullable();
            $table->string('source', 20);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    private function resetSchema(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ([
            'crm_events',
            'crm_event_types',
            'crm_event_categories',
            'email_notification_settings',
            'lead_pipelines',
            'pipeline_stages',
            'lead_agents',
            'deal_participants',
            'deal_watchers',
            'deal_histories',
            'deal_notes',
            'deals',
            'leads',
            'user_permissions',
            'permissions',
            'permission_types',
            'users',
            'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::enableForeignKeyConstraints();
    }
}
