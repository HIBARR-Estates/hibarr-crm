<?php

namespace Tests\Unit\Meetings;

use App\Models\Company;
use App\Models\DealFollowUp;
use App\Models\User;
use App\Services\MeetingAttendanceConfirmationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * The eligibility window ("ended >= 5 minutes ago") and the non-retroactivity
 * cutoff (never prompt for a meeting that already existed — i.e. started —
 * before the feature was turned on for the company, regardless of when it
 * happens to end) are the two hard requirements for this feature — this test
 * is about proving both hold, not general CRUD coverage.
 */
class MeetingAttendanceConfirmationServiceTest extends TestCase
{
    use SetsFeatureFlags;

    private MeetingAttendanceConfirmationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        Cache::flush();
        Config::set('meetings.attendance_confirmation_company_allowlist', '10');
        // Pinned explicitly so a developer's local .env (MEETING_ATTENDANCE_CONFIRMATION_FORCE_ENABLE,
        // MEETING_ATTENDANCE_CONFIRMATION_DELAY_MINUTES, ... — set for manual browser
        // testing) can't leak into this suite and short-circuit globallyEnabled() ahead
        // of the remote-flag override below, or shift the 5-minute eligibility window
        // the tests below assume.
        Config::set('meetings.attendance_confirmation_force_enable', false);
        Config::set('meetings.attendance_confirmation_delay_minutes', 5);
        $this->setFeatureFlag('crm.meeting-attendance-confirmation', true);

        DB::table('companies')->insert(['id' => 10, 'company_name' => 'Acme']);
        DB::table('users')->insert(['id' => 5, 'company_id' => 10, 'name' => 'Agent', 'email' => 'agent@example.test']);
        DB::table('users')->insert(['id' => 6, 'company_id' => 10, 'name' => 'Other Agent', 'email' => 'other@example.test']);
        DB::table('lead_agents')->insert(['id' => 1, 'user_id' => 5]);
        DB::table('lead_agents')->insert(['id' => 2, 'user_id' => 6]);
        DB::table('leads')->insert(['id' => 1, 'company_id' => 10, 'client_name' => 'Daniel Rivas', 'lead_owner' => 5]);
        DB::table('deals')->insert(['id' => 1, 'company_id' => 10, 'agent_id' => 1, 'lead_id' => 1]);

        $this->service = app(MeetingAttendanceConfirmationService::class);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_meeting_not_yet_five_minutes_past_end_is_not_eligible(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 4);

        $this->assertTrue($this->service->pendingListForUser($this->agent())->isEmpty());
    }

    public function test_meeting_five_minutes_past_end_is_eligible(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 6);

        $pending = $this->service->pendingListForUser($this->agent());

        $this->assertCount(1, $pending);
        $this->assertSame(1, $pending->first()->id);
    }

    public function test_meeting_that_ended_before_company_activation_is_never_eligible(): void
    {
        // Meeting ended an hour ago; the company only activated the feature 10 minutes ago.
        $this->activateCompany(10, now()->subMinutes(10));
        $this->makeFollowUp(1, endedMinutesAgo: 60);

        $this->assertTrue(
            $this->service->pendingListForUser($this->agent())->isEmpty(),
            'A meeting that ended before the feature was activated must never be prompted, even though the flag is on now.'
        );
    }

    public function test_meeting_ending_after_activation_is_eligible(): void
    {
        $this->activateCompany(10, now()->subHours(2));
        $this->makeFollowUp(1, endedMinutesAgo: 60);

        $this->assertCount(1, $this->service->pendingListForUser($this->agent()));
    }

    public function test_meeting_that_started_before_activation_is_excluded_even_if_it_ended_after(): void
    {
        // Meeting: started 20 min ago, 10-min duration -> ended 10 min ago.
        // Activation: stamped 15 min ago -- after the meeting started, before it ended.
        // A meeting already on the calendar before activation is "existing" and must
        // stay excluded, even though its end time is after activation and clears the
        // 5-minute delay on its own.
        $this->activateCompany(10, now()->subMinutes(15));
        $this->makeFollowUp(1, endedMinutesAgo: 10, duration: 10);

        $this->assertTrue(
            $this->service->pendingListForUser($this->agent())->isEmpty(),
            'A meeting that started before activation must never be prompted, even if it ended after activation.'
        );
    }

    public function test_already_logged_meeting_is_excluded(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30, attendanceOutcomeLoggedAt: now()->subMinutes(5));

        $this->assertTrue($this->service->pendingListForUser($this->agent())->isEmpty());
    }

    public function test_meeting_assigned_to_a_different_agent_is_excluded(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30);

        $this->assertTrue($this->service->pendingListForUser($this->agent(id: 6))->isEmpty());
    }

    public function test_feature_disabled_globally_returns_null_even_when_otherwise_eligible(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30);
        $this->setFeatureFlag('crm.meeting-attendance-confirmation', false);

        $this->assertTrue($this->service->pendingListForUser($this->agent())->isEmpty());
    }

    public function test_activation_is_stamped_once_and_visible_on_the_same_call(): void
    {
        // No pre-existing activation timestamp: this call is the company's first
        // observation of the flag being on. The just-ended meeting should still
        // be excluded (it ended before "now", the stamp), but a meeting ending
        // five minutes from now, checked ~5 minutes later, must find the stamp
        // already in place rather than reading it stale.
        $this->makeFollowUp(1, endedMinutesAgo: 30);

        $this->assertTrue(
            $this->service->pendingListForUser($this->agent())->isEmpty(),
            'A meeting that ended before activation was stamped must not be eligible on the same call.'
        );

        $company = Company::query()->find(10);
        $this->assertInstanceOf(Company::class, $company);
        $this->assertNotNull(
            $company->meeting_attendance_confirmation_enabled_at,
            'enabledForCompany() should lazily stamp activation on first observation.'
        );
    }

    public function test_multiple_eligible_meetings_are_returned_oldest_first(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 10);
        $this->makeFollowUp(2, endedMinutesAgo: 60);
        $this->makeFollowUp(3, endedMinutesAgo: 30);

        $pending = $this->service->pendingListForUser($this->agent());

        $this->assertSame([2, 3, 1], $pending->pluck('id')->all());
    }

    public function test_snoozed_meeting_is_excluded_until_its_snooze_elapses(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30, snoozedUntil: now()->addHour());

        $this->assertTrue(
            $this->service->pendingListForUser($this->agent())->isEmpty(),
            'A meeting snoozed into the future must not resurface yet.'
        );
    }

    public function test_meeting_with_an_elapsed_snooze_is_eligible_again(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30, snoozedUntil: now()->subMinute());

        $this->assertCount(1, $this->service->pendingListForUser($this->agent()));
    }

    public function test_snooze_sets_the_snoozed_until_timestamp(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30);

        $followUp = DealFollowUp::query()->find(1);
        $snoozed = $this->service->snooze($followUp, 45);

        $this->assertNotNull($snoozed->attendance_confirmation_snoozed_until);
        $this->assertTrue($snoozed->attendance_confirmation_snoozed_until->between(now()->addMinutes(44), now()->addMinutes(46)));
    }

    public function test_snooze_zero_minutes_clears_an_existing_snooze_immediately(): void
    {
        // This is the "Undo" mechanism the frontend uses — a zero-minute
        // snooze must resolve to a moment already in the past, not "now plus
        // zero", so the meeting is immediately eligible again.
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30, snoozedUntil: now()->addHour());

        $followUp = DealFollowUp::query()->find(1);
        $snoozed = $this->service->snooze($followUp, 0);

        $this->assertTrue($snoozed->attendance_confirmation_snoozed_until->lte(now()));
        $this->assertCount(1, $this->service->pendingListForUser($this->agent()));
    }

    public function test_snooze_is_a_no_op_on_an_already_resolved_meeting(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30, attendanceOutcomeLoggedAt: now()->subMinutes(5));

        $followUp = DealFollowUp::query()->find(1);
        $snoozed = $this->service->snooze($followUp, 45);

        $this->assertNull(
            $snoozed->attendance_confirmation_snoozed_until,
            'A resolved meeting must never be snoozed — the guard update should have matched zero rows.'
        );
    }

    public function test_snooze_is_a_no_op_on_a_meeting_that_has_not_ended_yet(): void
    {
        $this->activateCompany(10, now()->subDay());
        // Started 10 minutes ago, ends in 20 (duration 30) — hasn't ended, let
        // alone cleared the 5-minute delay.
        $this->makeFollowUp(1, endedMinutesAgo: -20, duration: 30);

        $followUp = DealFollowUp::query()->find(1);
        $snoozed = $this->service->snooze($followUp, 45);

        $this->assertNull(
            $snoozed->attendance_confirmation_snoozed_until,
            'A follow-up that is not yet actionable must be rejected even when assigned to the requesting user.'
        );
    }

    public function test_snooze_is_a_no_op_on_a_cancelled_meeting(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: 30, status: 'cancelled');

        $followUp = DealFollowUp::query()->find(1);
        $snoozed = $this->service->snooze($followUp, 45);

        $this->assertNull($snoozed->attendance_confirmation_snoozed_until);
    }

    public function test_confirm_is_a_no_op_on_a_meeting_that_has_not_ended_yet(): void
    {
        $this->activateCompany(10, now()->subDay());
        $this->makeFollowUp(1, endedMinutesAgo: -20, duration: 30);

        $followUp = DealFollowUp::query()->find(1);
        $confirmed = $this->service->confirm(
            $followUp,
            $this->agent(),
            \App\Enums\MeetingAttendanceOutcome::Attended,
            null
        );

        $this->assertNull(
            $confirmed->attendance_outcome_logged_at,
            'A follow-up that is not yet actionable must be rejected even when assigned to the requesting user.'
        );
    }

    public function test_confirm_is_a_no_op_on_a_meeting_that_predates_activation(): void
    {
        // Activated 10 minutes ago; the meeting started an hour ago — "existing"
        // and must stay off-limits for a direct confirm() call too, not just
        // pendingListForUser()'s listing.
        $this->activateCompany(10, now()->subMinutes(10));
        $this->makeFollowUp(1, endedMinutesAgo: 60);

        $followUp = DealFollowUp::query()->find(1);
        $confirmed = $this->service->confirm(
            $followUp,
            $this->agent(),
            \App\Enums\MeetingAttendanceOutcome::Attended,
            null
        );

        $this->assertNull($confirmed->attendance_outcome_logged_at);
    }

    public function test_pending_limit_does_not_starve_a_later_eligible_meeting(): void
    {
        $this->activateCompany(10, now()->subDay());

        // 21 meetings that started long ago (so they sort first) but are still
        // "in progress" — a very long duration means none of them have ended
        // yet. A single SQL LIMIT ordered by start time alone would let these
        // crowd out a later, already-concluded meeting.
        for ($id = 2; $id <= 22; $id++) {
            $this->makeFollowUp($id, endedMinutesAgo: 0, duration: 100000);
        }

        // Starts far more recently than the above, but it already ended.
        $this->makeFollowUp(1, endedMinutesAgo: 30, duration: 30);

        $pending = $this->service->pendingListForUser($this->agent(), limit: 1);

        $this->assertCount(1, $pending);
        $this->assertSame(1, $pending->first()->id);
    }

    /**
     * Built in-memory rather than fetched via Eloquent: User::$with eagerly
     * loads several relations (clientDetails, employeeDetail, ...) that this
     * test's minimal schema doesn't have tables for, and pendingForUser()
     * only ever reads $user->id / $user->company_id off the instance anyway.
     */
    private function agent(int $id = 5, int $companyId = 10): User
    {
        $user = new User();
        $user->id = $id;
        $user->company_id = $companyId;

        return $user;
    }

    private function activateCompany(int $companyId, Carbon $enabledAt): void
    {
        DB::table('companies')->where('id', $companyId)->update([
            'meeting_attendance_confirmation_enabled_at' => $enabledAt,
        ]);
        // Skip the lazy-stamp cache short-circuit so tests can set an explicit,
        // pre-existing activation timestamp without it being overwritten.
        Cache::put("meeting_attendance_confirmation:activated:{$companyId}", true, 3600);
    }

    private function makeFollowUp(
        int $id,
        int $endedMinutesAgo,
        ?Carbon $attendanceOutcomeLoggedAt = null,
        int $duration = 30,
        ?Carbon $snoozedUntil = null,
        string $status = 'scheduled'
    ): void {
        $start = now()->subMinutes($endedMinutesAgo + $duration);

        DB::table('lead_follow_up')->insert([
            'id' => $id,
            'deal_id' => 1,
            'lead_id' => null,
            'next_follow_up_date' => $start,
            'duration' => $duration,
            'status' => $status,
            'attendance_outcome_logged_at' => $attendanceOutcomeLoggedAt,
            'attendance_confirmation_snoozed_until' => $snoozedUntil,
        ]);
    }

    private function resetSchema(): void
    {
        foreach (['lead_follow_up', 'deals', 'leads', 'lead_agents', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamp('meeting_attendance_confirmation_enabled_at')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('meeting_type_id')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->integer('duration')->nullable();
            $table->string('status')->nullable();
            $table->string('attendance_outcome')->nullable();
            $table->timestamp('attendance_outcome_logged_at')->nullable();
            $table->unsignedInteger('attendance_outcome_logged_by')->nullable();
            $table->timestamp('attendance_confirmation_snoozed_until')->nullable();
            $table->timestamps();
        });
    }
}
