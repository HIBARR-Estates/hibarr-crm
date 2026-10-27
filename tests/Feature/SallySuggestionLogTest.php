<?php

namespace Tests\Feature;

use App\Http\Controllers\LeadContactController;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Logging a Sally suggested note turns it into a normal CRM note on the
 * insight's lead (or its deal, when the insight has no lead): authored by the
 * agent who logged it, carrying the Sally integration-origin badge, and
 * logged exactly once — the sally_suggestion_logs unique key refuses a
 * second attempt.
 *
 * Controller methods are called directly, as in
 * SallyInsightAuthorizationTest — the gates under test are the note
 * permissions plus the insight's read/edit visibility, not routing.
 */
class SallySuggestionLogTest extends TestCase
{
    private const ACTOR_ID = 1;

    private const DEAL_AGENT_ID = 2;

    private const DEAL_WATCHER_ID = 3;

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
        $this->buildSchema();
        $this->seedFixtures();

        Cache::flush();
        Notification::fake();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_logging_as_is_creates_a_lead_note_with_the_sally_badge(): void
    {
        $this->grant(self::ACTOR_ID, 'view_lead', 'all');
        $this->grant(self::ACTOR_ID, 'add_lead_note', 'all');

        $insightId = $this->makeInsight(1, null, [
            ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Deposit is too high', 'edited' => false],
        ]);

        $this->actingAsUser(self::ACTOR_ID);

        $response = $this->log($insightId, 'obj-1');

        $this->assertSame('success', $response['status']);
        $suggestion = $response['data']['suggested_notes'][0];
        $this->assertTrue($suggestion['logged']);
        $this->assertSame('as_is', $suggestion['logged_mode']);
        $this->assertSame(self::ACTOR_ID, $suggestion['logged_by']);
        $this->assertNotNull($suggestion['logged_note_id']);

        $note = DB::table('lead_notes')->where('id', $suggestion['logged_note_id'])->first();
        $this->assertSame((int) $note->lead_id, 1);
        $this->assertSame('sally', $note->integration_origin);
        $this->assertSame((string) self::ACTOR_ID, (string) $note->added_by);
        // The suggestion text becomes the note body, escaped into paragraphs.
        $this->assertStringContainsString('<p>Deposit is too high</p>', (string) $note->details);

        $this->assertSame(
            1,
            DB::table('sally_suggestion_logs')->where('sally_meeting_insight_id', $insightId)->count(),
        );
    }

    public function test_edited_text_is_logged_after_edit(): void
    {
        $this->grant(self::DEAL_AGENT_ID, 'view_lead', 'all');
        $this->grant(self::DEAL_AGENT_ID, 'edit_lead', 'all');
        $this->grant(self::DEAL_AGENT_ID, 'add_lead_note', 'all');

        $insightId = $this->makeInsight(1, null, [
            ['id' => 'ins-1', 'type' => 'insight', 'text' => 'Budget around 1,400', 'edited' => false],
        ]);

        $this->actingAsUser(self::DEAL_AGENT_ID);

        $this->updateSuggestion($insightId, 'ins-1', 'Budget confirmed at 1,400 per account');
        $response = $this->log($insightId, 'ins-1', 'Budget confirmed at 1,400 per account');

        $suggestion = $response['data']['suggested_notes'][0];
        $this->assertTrue($suggestion['logged']);
        $this->assertSame('after_edit', $suggestion['logged_mode']);
        $this->assertTrue($suggestion['edited']);

        $note = DB::table('lead_notes')->where('id', $suggestion['logged_note_id'])->first();
        $this->assertStringContainsString('Budget confirmed at 1,400 per account', (string) $note->details);
    }

    public function test_a_logged_suggestion_cannot_be_logged_twice(): void
    {
        $this->grant(self::ACTOR_ID, 'view_lead', 'all');
        $this->grant(self::ACTOR_ID, 'add_lead_note', 'all');

        $insightId = $this->makeInsight(1, null, [
            ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Deposit is too high', 'edited' => false],
        ]);

        $this->actingAsUser(self::ACTOR_ID);

        $this->log($insightId, 'obj-1');

        try {
            $this->log($insightId, 'obj-1', 'a second, different text');
            $this->fail('A logged suggestion must refuse a second log.');
        } catch (ValidationException $e) {
            $this->assertStringContainsString('already logged', implode(' ', $e->errors()['suggestion'] ?? []));
        }

        $this->assertSame(
            1,
            DB::table('lead_notes')->where('integration_origin', 'sally')->count(),
        );
    }

    public function test_logging_requires_the_note_permission(): void
    {
        // Read access to the lead, but no add_lead_note.
        $this->grant(self::ACTOR_ID, 'view_lead', 'all');

        $insightId = $this->makeInsight(1, null, [
            ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Deposit is too high', 'edited' => false],
        ]);

        $this->actingAsUser(self::ACTOR_ID);

        try {
            $this->log($insightId, 'obj-1');
            $this->fail('add_lead_note must gate logging.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $this->assertSame(0, DB::table('sally_suggestion_logs')->count());
    }

    public function test_deal_only_insight_logs_a_deal_note_for_a_deal_agent(): void
    {
        $this->grant(self::DEAL_AGENT_ID, 'view_deals', 'owned');
        $this->grant(self::DEAL_AGENT_ID, 'add_deal_note', 'all');

        $insightId = $this->makeInsight(null, 1, [
            ['id' => 'dec-1', 'type' => 'decision', 'text' => 'Confirm unit on Friday', 'edited' => false],
        ]);

        $this->actingAsUser(self::DEAL_AGENT_ID);

        $response = $this->log($insightId, 'dec-1');

        $suggestion = $response['data']['suggested_notes'][0];
        $this->assertTrue($suggestion['logged']);

        $note = DB::table('deal_notes')->where('id', $suggestion['logged_note_id'])->first();
        $this->assertSame(1, (int) $note->deal_id);
        $this->assertSame('sally', $note->integration_origin);
        $this->assertSame((string) self::DEAL_AGENT_ID, (string) $note->added_by);
    }

    public function test_deal_watcher_cannot_log_on_a_deal_only_insight(): void
    {
        $this->grant(self::DEAL_WATCHER_ID, 'view_deals', 'owned');
        $this->grant(self::DEAL_WATCHER_ID, 'add_deal_note', 'all');

        DB::table('deal_watchers')->insert(['deal_id' => 1, 'user_id' => self::DEAL_WATCHER_ID]);

        $insightId = $this->makeInsight(null, 1, [
            ['id' => 'dec-1', 'type' => 'decision', 'text' => 'Confirm unit on Friday', 'edited' => false],
        ]);

        $this->actingAsUser(self::DEAL_WATCHER_ID, ['employee']);

        try {
            $this->log($insightId, 'dec-1');
            $this->fail('A watcher may read the card but must not log notes from it.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $this->assertSame(0, DB::table('deal_notes')->count());
    }

    /**
     * @return array<string, mixed>
     */
    private function log(int $insightId, string $suggestionId, ?string $text = null): array
    {
        $payload = $text === null ? [] : ['text' => $text];
        $request = Request::create(
            "/account/sally-insights/{$insightId}/suggestions/{$suggestionId}/log",
            'POST',
            $payload,
        );

        return json_decode(
            app(LeadContactController::class)->logSallySuggestion($request, $insightId, $suggestionId)->getContent(),
            true,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function updateSuggestion(int $insightId, string $suggestionId, string $text): array
    {
        $request = Request::create(
            "/account/sally-insights/{$insightId}/suggestions/{$suggestionId}",
            'PATCH',
            ['text' => $text],
        );

        return json_decode(
            app(LeadContactController::class)->updateSallySuggestion($request, $insightId, $suggestionId)->getContent(),
            true,
        );
    }

    /**
     * user() reads the session before auth(); permission() only needs the id.
     */
    private function actingAsUser(int $userId, array $roles = ['admin']): void
    {
        $actor = new User;
        $actor->id = $userId;
        $actor->company_id = 1;

        session(['user' => $actor, 'user_roles' => $roles]);
        session(['company' => Company::query()->findOrFail(1)]);
        Cache::put('user_modules_'.$userId, []);
    }

    private function makeInsight(?int $leadId, ?int $dealId, array $suggestions): int
    {
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'deal_id' => $dealId,
            'lead_id' => $leadId,
            'remark' => 'Call',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('sally_meeting_insights')->insertGetId([
            'company_id' => 1,
            'meeting_follow_up_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'suggested_notes' => json_encode($suggestions),
            'original_suggested_notes' => json_encode(array_map(
                fn (array $note) => ['id' => $note['id'], 'type' => $note['type'], 'text' => $note['text']],
                $suggestions,
            )),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function grant(int $userId, string $permission, string $type): void
    {
        DB::table('user_permissions')->insert([
            'user_id' => $userId,
            'permission_id' => DB::table('permissions')->where('name', $permission)->value('id'),
            'permission_type_id' => DB::table('permission_types')->where('name', $type)->value('id'),
        ]);
    }

    private function seedFixtures(): void
    {
        DB::table('companies')->insert([
            'id' => 1, 'company_name' => 'Acme', 'timezone' => 'UTC',
        ]);

        DB::table('users')->insert(array_map(
            fn (int $id) => [
                'id' => $id, 'company_id' => 1, 'status' => 'active',
                'name' => 'User '.$id, 'email' => "user{$id}@example.test",
            ],
            [self::ACTOR_ID, self::DEAL_AGENT_ID, self::DEAL_WATCHER_ID],
        ));

        DB::table('permission_types')->insert([
            ['id' => 1, 'name' => 'all'],
            ['id' => 2, 'name' => 'owned'],
        ]);

        foreach (['view_lead', 'edit_lead', 'view_deals', 'edit_deals', 'add_lead_note', 'add_deal_note'] as $index => $name) {
            DB::table('permissions')->insert(['id' => $index + 1, 'name' => $name]);
        }

        // The deal's agent: DEAL_AGENT_ID has team access (lead agent row).
        DB::table('lead_agents')->insert([
            'id' => 1, 'company_id' => 1, 'user_id' => self::DEAL_AGENT_ID,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('deals')->insert([
            'id' => 1, 'company_id' => 1, 'lead_id' => 1,
            'added_by' => self::ACTOR_ID, 'agent_id' => 1, 'name' => 'Deal',
        ]);
        DB::table('deal_participants')->insert([
            'deal_id' => 1, 'user_id' => self::DEAL_AGENT_ID,
        ]);

        DB::table('leads')->insert([
            'id' => 1, 'company_id' => 1, 'client_name' => 'Test Lead', 'lead_owner' => null,
        ]);

        // CrmEventService skips quietly when the slug is unknown, but the
        // lookup itself needs the tables to exist.
        DB::table('crm_event_categories')->insert([
            'id' => 1, 'company_id' => null, 'name' => 'Deal', 'slug' => 'deal', 'is_active' => 1,
        ]);
        DB::table('crm_event_types')->insert([
            'id' => 1, 'company_id' => null, 'category_id' => 1,
            'name' => 'lead_note_added', 'slug' => 'lead_note_added',
            'model_type' => \App\Models\Lead::class, 'is_active' => 1, 'is_system' => 1, 'sync_processing' => 1,
        ]);
    }

    private function buildSchema(): void
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
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            // The User model's global scope filters on these.
            $table->string('status')->default('active');
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('permission_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('permission_type_id');
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->string('client_name')->nullable();
            // The first note/email on a lead stamps this.
            $table->timestamp('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            // hasTeamMemberAccess() reads the deal's agent through this.
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_participants', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('user_id');
        });

        Schema::create('deal_watchers', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('user_id');
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->text('remark')->nullable();
            $table->string('location')->nullable();
            $table->string('timezone')->nullable();
            $table->timestamp('next_follow_up_date')->nullable();
            $table->timestamps();
        });

        Schema::create('sally_meeting_insights', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('meeting_follow_up_id')->unique();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->text('summary')->nullable();
            $table->longText('transcript')->nullable();
            $table->json('transcript_segments')->nullable();
            $table->json('bullet_points')->nullable();
            $table->text('recording_url')->nullable();
            $table->text('original_summary')->nullable();
            $table->json('original_bullet_points')->nullable();
            $table->json('suggested_notes')->nullable();
            $table->json('original_suggested_notes')->nullable();
            $table->timestamp('summary_edited_at')->nullable();
            $table->timestamp('bullet_points_edited_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sally_suggestion_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('sally_meeting_insight_id');
            $table->string('suggestion_id', 64);
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->unsignedInteger('note_id');
            $table->string('logged_mode', 16);
            $table->longText('logged_text')->nullable();
            $table->unsignedInteger('logged_by')->nullable();
            $table->timestamp('logged_at');
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->string('title')->nullable();
            $table->longText('details')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('type')->default(0);
            $table->string('integration_origin')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->string('title')->nullable();
            $table->longText('details')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->string('integration_origin')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        // LeadNote::members — private-note visibility (not used by Sally
        // notes, but the reminder sync loads the relation).
        Schema::create('lead_user_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_note_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });

        Schema::create('deal_histories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->string('event_type');
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('note_id')->nullable();
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('email_notification_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->boolean('is_active')->default(1);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->string('model_type')->nullable();
            $table->boolean('is_active')->default(1);
            $table->boolean('is_system')->default(0);
            $table->boolean('sync_processing')->default(0);
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
        foreach ([
            'crm_events', 'crm_event_types', 'crm_event_categories',
            'email_notification_settings', 'lead_pipelines', 'pipeline_stages',
            'deal_histories', 'lead_user_notes', 'deal_notes', 'lead_notes',
            'sally_suggestion_logs', 'sally_meeting_insights', 'lead_follow_up',
            'deal_watchers', 'deal_participants', 'lead_agents', 'deals', 'leads',
            'user_permissions', 'permission_types', 'permissions', 'users', 'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
