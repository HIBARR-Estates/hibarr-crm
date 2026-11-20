<?php

namespace Tests\Feature;

use App\Models\DealFollowUp;
use App\Models\MeetingSavedView;
use App\Services\MeetingFilters;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * "Is not" and "not recorded yet" on the Meetings filters (`<key>_mode`), plus
 * the "is one of" behaviour those filters had before they moved out of
 * MeetingsController, so the move is covered as well as the new modes.
 */
class MeetingFilterExclusionTest extends TestCase
{
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
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('meeting_type_id')->nullable();
            $table->string('status')->default('scheduled');
            $table->string('location')->nullable();
            $table->unsignedInteger('host_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->string('attendance_outcome')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('lead_follow_up');
        parent::tearDown();
    }

    // ── meeting type and platform ────────────────────────────────────────

    public function test_meeting_type_not_in_empty_and_the_unchanged_is_one_of(): void
    {
        $intro = $this->insertMeeting(['meeting_type_id' => 1]);
        $viewing = $this->insertMeeting(['meeting_type_id' => 2]);
        $untyped = $this->insertMeeting(['meeting_type_id' => null]);

        $this->assertSame([$viewing, $untyped], $this->ids(['meeting_type_id' => '1', 'meeting_type_id_mode' => 'not_in']));
        $this->assertSame([$untyped], $this->ids(['meeting_type_id_mode' => 'empty']));
        $this->assertSame([$intro, $viewing], $this->ids(['meeting_type_id' => '1,2']));
    }

    public function test_platform_not_in_keeps_meetings_with_no_platform_and_treats_blank_as_empty(): void
    {
        $zoom = $this->insertMeeting(['location' => 'zoom']);
        $phone = $this->insertMeeting(['location' => 'phone']);
        $blank = $this->insertMeeting(['location' => '']);
        $none = $this->insertMeeting(['location' => null]);

        $this->assertSame([$zoom, $blank, $none], $this->ids(['location' => 'phone', 'location_mode' => 'not_in']));
        $this->assertSame([$blank, $none], $this->ids(['location_mode' => 'empty']));
        $this->assertSame([$zoom, $phone], $this->ids(['location' => 'zoom,phone']));
    }

    // ── status ───────────────────────────────────────────────────────────

    public function test_status_not_in_and_the_fixed_set_of_values(): void
    {
        $scheduled = $this->insertMeeting(['status' => 'scheduled']);
        $completed = $this->insertMeeting(['status' => 'completed']);
        $cancelled = $this->insertMeeting(['status' => 'cancelled']);

        $this->assertSame([$scheduled, $completed], $this->ids(['status' => 'cancelled', 'status_mode' => 'not_in']));
        // Unchanged: "is one of", and a value that is not a status is dropped.
        $this->assertSame([$completed], $this->ids(['status' => 'completed']));
        $this->assertSame([$scheduled, $completed, $cancelled], $this->ids(['status' => 'nonsense']));
    }

    // ── host (the named host, otherwise whoever booked it) ───────────────

    public function test_host_not_in_uses_the_same_reading_of_who_owns_the_meeting(): void
    {
        $hostedByAnna = $this->insertMeeting(['host_id' => 11, 'added_by' => 12]);
        $bookedByAnna = $this->insertMeeting(['host_id' => null, 'added_by' => 11]);
        $hostedByBen = $this->insertMeeting(['host_id' => 12, 'added_by' => 11]);
        $bookedByBen = $this->insertMeeting(['host_id' => null, 'added_by' => 12]);
        $unowned = $this->insertMeeting(['host_id' => null, 'added_by' => null]);

        // Anna owns the first two (named host, then booker). The third is Ben's
        // even though Anna booked it, because the named host wins.
        $this->assertSame(
            [$hostedByBen, $bookedByBen, $unowned],
            $this->ids(['host_id' => '11', 'host_id_mode' => 'not_in'])
        );
        // Unchanged: "is one of".
        $this->assertSame([$hostedByAnna, $bookedByAnna], $this->ids(['host_id' => '11']));
    }

    // ── attendance ───────────────────────────────────────────────────────

    public function test_attendance_not_recorded_yet_and_the_unchanged_values(): void
    {
        $attended = $this->insertMeeting(['attendance_outcome' => 'attended']);
        $noShow = $this->insertMeeting(['attendance_outcome' => 'no_show']);
        $blank = $this->insertMeeting(['attendance_outcome' => '']);
        $none = $this->insertMeeting(['attendance_outcome' => null]);

        $this->assertSame([$blank, $none], $this->ids(['attendance_mode' => 'empty']));
        $this->assertSame([$attended], $this->ids(['attendance' => 'attended']));
        $this->assertSame([$attended, $noShow], $this->ids(['attendance' => 'attended,no_show']));
        // "Not recorded yet" replaces any values sent with it.
        $this->assertSame([$blank, $none], $this->ids(['attendance_mode' => 'empty', 'attendance' => 'attended']));
    }

    public function test_the_page_only_picks_the_attendance_tab_for_values_not_for_not_recorded_yet(): void
    {
        $filters = new MeetingFilters;

        $this->assertSame(
            ['no_show'],
            $filters->includedAttendance(Request::create('/', 'GET', ['attendance' => 'no_show']))
        );
        $this->assertSame(
            [],
            $filters->includedAttendance(Request::create('/', 'GET', ['attendance' => 'no_show', 'attendance_mode' => 'empty']))
        );
        $this->assertTrue($filters->wantsUnrecordedAttendance(Request::create('/', 'GET', ['attendance_mode' => 'empty'])));
        $this->assertFalse($filters->wantsUnrecordedAttendance(Request::create('/', 'GET', ['attendance' => 'attended'])));
    }

    public function test_a_mode_a_filter_does_not_take_is_ignored(): void
    {
        $a = $this->insertMeeting(['status' => 'scheduled', 'host_id' => 11]);
        $b = $this->insertMeeting(['status' => 'completed', 'host_id' => 12]);

        // Status takes not_in only; host takes not_in only.
        $this->assertSame([$a], $this->ids(['status' => 'scheduled', 'status_mode' => 'empty']));
        $this->assertSame([$a], $this->ids(['host_id' => '11', 'host_id_mode' => 'any']));
        $this->assertSame([$a, $b], $this->ids(['status_mode' => 'empty']));
    }

    // ── saved views ──────────────────────────────────────────────────────

    public function test_saved_views_keep_modes_and_drop_anything_that_is_not_one(): void
    {
        $result = MeetingSavedView::sanitizeFilters([
            'meeting_type_id_mode' => 'empty',
            'status' => 'cancelled',
            'status_mode' => 'not_in',
            'location_mode' => 'sideways',
            'attendance_mode' => 'empty',
            // Modes the filter does not offer are not modes.
            'host_id_mode' => 'empty',
            'status_mode_extra' => 'empty',
            'per_page' => 5000,
        ]);

        $this->assertSame(
            ['meeting_type_id_mode' => 'empty', 'status' => 'cancelled', 'status_mode' => 'not_in', 'attendance_mode' => 'empty'],
            $result
        );
    }

    public function test_every_mode_key_is_a_saved_view_key(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Models/MeetingSavedView.php');

        foreach (MeetingFilters::modeKeys() as $key) {
            $this->assertStringContainsString("'{$key}'", $source, "MeetingSavedView does not whitelist '{$key}'.");
        }
    }

    // ── harness ──────────────────────────────────────────────────────────

    /**
     * @param  array<string, string>  $params
     * @return array<int, int>
     */
    private function ids(array $params): array
    {
        $query = DealFollowUp::query();
        (new MeetingFilters)->apply($query, Request::create('/meetings', 'GET', $params));

        return $query->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /** @param  array<string, mixed>  $attributes */
    private function insertMeeting(array $attributes = []): int
    {
        return (int) DB::table('lead_follow_up')->insertGetId(array_merge([
            'meeting_type_id' => null,
            'status' => 'scheduled',
            'location' => null,
            'host_id' => null,
            'added_by' => null,
            'attendance_outcome' => null,
            'next_follow_up_date' => '2026-06-01 10:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
