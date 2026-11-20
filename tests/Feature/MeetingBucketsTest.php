<?php

namespace Tests\Feature;

use App\Support\MeetingBuckets;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Every meeting is in exactly one of Upcoming / Past, and a meeting in
 * progress is Upcoming (and live), not nowhere.
 *
 * The list, the tab tallies and the "next up" cards all read these
 * conditions; before MeetingBuckets they each restated them and disagreed.
 */
class MeetingBucketsTest extends TestCase
{
    private Carbon $now;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('lead_follow_up');
        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->string('status')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->unsignedInteger('duration')->nullable();
        });

        $this->now = Carbon::parse('2026-11-20 12:00:00', 'UTC');
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('lead_follow_up');
        parent::tearDown();
    }

    public function test_a_future_meeting_that_is_no_longer_scheduled_is_past_not_upcoming(): void
    {
        $cancelled = $this->insertMeeting('cancelled', '+1 day');
        $completed = $this->insertMeeting('completed', '+2 hours');
        $scheduled = $this->insertMeeting('scheduled', '+1 day');

        $this->assertSame([$scheduled], $this->ids('scopeUpcoming'));
        $this->assertEqualsCanonicalizing([$cancelled, $completed], $this->ids('scopePast'));
    }

    public function test_a_meeting_in_progress_is_upcoming_and_live_not_nowhere(): void
    {
        // Started 10 minutes ago, 30-minute default duration: still running.
        $running = $this->insertMeeting('scheduled', '-10 minutes');
        // Started 45 minutes ago: over.
        $ended = $this->insertMeeting('scheduled', '-45 minutes');

        $this->assertSame([$running], $this->ids('scopeUpcoming'));
        $this->assertSame([$running], $this->ids('scopeLive'));
        $this->assertSame([$ended], $this->ids('scopePast'));
    }

    public function test_a_running_meeting_that_was_cancelled_is_not_live(): void
    {
        $this->insertMeeting('cancelled', '-10 minutes');

        $this->assertSame([], $this->ids('scopeLive'));
        $this->assertSame([], $this->ids('scopeUpcoming'));
    }

    public function test_an_explicit_duration_overrides_the_default(): void
    {
        // 60-minute meeting that started 45 minutes ago is still running.
        $long = $this->insertMeeting('scheduled', '-45 minutes', 60);

        $this->assertSame([$long], $this->ids('scopeLive'));
    }

    public function test_a_missing_status_reads_as_scheduled(): void
    {
        $future = $this->insertMeeting(null, '+1 day');
        $old = $this->insertMeeting(null, '-1 day');

        $this->assertSame([$future], $this->ids('scopeUpcoming'));
        $this->assertSame([$old], $this->ids('scopePast'));
    }

    public function test_upcoming_and_past_partition_every_meeting(): void
    {
        $offsets = ['-5 hours', '-45 minutes', '-30 minutes', '-29 minutes', '-10 minutes', 'now', '+10 minutes', '+10 hours'];

        foreach ([null, 'scheduled', 'completed', 'cancelled', 'canceled'] as $status) {
            foreach ($offsets as $offset) {
                foreach ([null, 15, 60] as $duration) {
                    $this->insertMeeting($status, $offset, $duration);
                }
            }
        }

        $all = DB::table('lead_follow_up')->pluck('id')->all();
        $upcoming = $this->ids('scopeUpcoming');
        $past = $this->ids('scopePast');
        $live = $this->ids('scopeLive');

        $this->assertSame([], array_values(array_intersect($upcoming, $past)), 'a meeting is in both tabs');
        $this->assertEqualsCanonicalizing($all, array_merge($upcoming, $past), 'a meeting is in neither tab');
        $this->assertSame([], array_values(array_diff($live, $upcoming)), 'live must be a subset of upcoming');
    }

    public function test_the_count_sql_agrees_with_the_scopes(): void
    {
        $this->insertMeeting('scheduled', '+1 day');
        $this->insertMeeting('scheduled', '-10 minutes');
        $this->insertMeeting('cancelled', '+1 day');
        $this->insertMeeting('completed', '-1 day');
        $this->insertMeeting('scheduled', '-1 day');

        $buckets = new MeetingBuckets($this->now);
        [$upcomingSql, $upcomingBindings] = $buckets->upcoming();
        [$pastSql, $pastBindings] = $buckets->past();

        $counts = DB::table('lead_follow_up')
            ->selectRaw(
                "SUM($upcomingSql) as upcoming, SUM($pastSql) as past",
                [...$upcomingBindings, ...$pastBindings]
            )
            ->first();

        $this->assertSame(count($this->ids('scopeUpcoming')), (int) $counts->upcoming);
        $this->assertSame(count($this->ids('scopePast')), (int) $counts->past);
        $this->assertSame(5, (int) $counts->upcoming + (int) $counts->past);
    }

    public function test_legacy_mode_keeps_the_rules_from_before_the_improvements(): void
    {
        // Without crm.meetings-page-improvements: Upcoming is "starts after now".
        $cancelledFuture = $this->insertMeeting('cancelled', '+1 day');
        $running = $this->insertMeeting('scheduled', '-10 minutes');
        $scheduledFuture = $this->insertMeeting('scheduled', '+1 day');
        $ended = $this->insertMeeting('scheduled', '-45 minutes');

        $upcoming = $this->ids('scopeUpcoming', legacy: true);
        $past = $this->ids('scopePast', legacy: true);

        // A cancelled future meeting is in both tabs, a running one in neither
        // — the behaviour the improvements fix, kept while the flag is off.
        $this->assertEqualsCanonicalizing([$cancelledFuture, $scheduledFuture], $upcoming);
        $this->assertEqualsCanonicalizing([$cancelledFuture, $ended], $past);
        $this->assertNotContains($running, array_merge($upcoming, $past));
        // Live is the same in both modes.
        $this->assertSame([$running], $this->ids('scopeLive', legacy: true));
    }

    public function test_legacy_count_sql_reads_upcoming_as_starting_after_now(): void
    {
        $this->insertMeeting('cancelled', '+1 day');
        $this->insertMeeting('scheduled', '-10 minutes');

        [$sql, $bindings] = (new MeetingBuckets($this->now, legacy: true))->upcoming();

        $count = (int) DB::table('lead_follow_up')->selectRaw("SUM($sql) as n", $bindings)->value('n');

        $this->assertSame(1, $count);
    }

    /** @return array<int, int> */
    private function ids(string $scope, bool $legacy = false): array
    {
        $query = DB::table('lead_follow_up');

        (new MeetingBuckets($this->now, legacy: $legacy))->{$scope}($query);

        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function insertMeeting(?string $status, string $offset, ?int $duration = null): int
    {
        return (int) DB::table('lead_follow_up')->insertGetId([
            'status' => $status,
            'next_follow_up_date' => $this->now->copy()->modify($offset)->format('Y-m-d H:i:s'),
            'duration' => $duration,
        ]);
    }
}
