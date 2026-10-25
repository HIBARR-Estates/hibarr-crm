<?php

namespace Tests\Feature\Deals;

use App\Models\Deal;
use App\Services\DealCreationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\LeadCoreFieldsTestCase;

/**
 * deal/create carries the booked slot (e.g. a Calendly event) as meeting.meeting_date
 * plus meeting.meeting_end_date. The CRM has no end column: the meeting's length
 * is its duration, so the end time has to land there or the meeting shows the
 * 30-minute default.
 */
class DealMeetingEndTimeTest extends LeadCoreFieldsTestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_the_end_time_becomes_the_meeting_duration(): void
    {
        $deal = $this->seedDeal();

        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-03T10:00:00Z',
            'meeting_end_date' => '2026-11-03T10:45:00Z',
            'meeting_id' => 'calendly-1',
        ]);

        $this->assertSame(45, (int) DB::table('lead_follow_up')->where('meeting_id', 'calendly-1')->value('duration'));
    }

    public function test_without_an_end_time_the_meeting_keeps_the_default_duration(): void
    {
        $deal = $this->seedDeal();

        $this->createMeeting($deal, ['meeting_date' => '2026-11-03T10:00:00Z', 'meeting_id' => 'calendly-2']);

        $this->assertNull(DB::table('lead_follow_up')->where('meeting_id', 'calendly-2')->value('duration'));
    }

    public function test_a_rescheduled_meeting_takes_the_new_duration(): void
    {
        $deal = $this->seedDeal();
        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-03T10:00:00Z',
            'meeting_end_date' => '2026-11-03T10:30:00Z',
            'meeting_id' => 'calendly-3',
        ]);

        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-04T14:00:00Z',
            'meeting_end_date' => '2026-11-04T15:00:00Z',
            'meeting_id' => 'calendly-3',
        ]);

        $rows = DB::table('lead_follow_up')->where('meeting_id', 'calendly-3')->get();
        $this->assertCount(1, $rows);
        $this->assertSame(60, (int) $rows[0]->duration);
    }

    public function test_an_update_without_an_end_time_keeps_the_stored_duration(): void
    {
        $deal = $this->seedDeal();
        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-03T10:00:00Z',
            'meeting_end_date' => '2026-11-03T10:45:00Z',
            'meeting_id' => 'calendly-4',
        ]);

        $this->createMeeting($deal, ['meeting_date' => '2026-11-03T11:00:00Z', 'meeting_id' => 'calendly-4']);

        $this->assertSame(45, (int) DB::table('lead_follow_up')->where('meeting_id', 'calendly-4')->value('duration'));
    }

    public function test_an_end_at_or_before_the_start_or_over_ten_hours_is_ignored(): void
    {
        $deal = $this->seedDeal();

        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-03T10:00:00Z',
            'meeting_end_date' => '2026-11-03T09:00:00Z',
            'meeting_id' => 'before',
        ]);
        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-03T10:00:00Z',
            'meeting_end_date' => '2026-11-04T10:00:00Z',
            'meeting_id' => 'too-long',
        ]);
        $this->createMeeting($deal, [
            'meeting_date' => '2026-11-03T10:00:00Z',
            'meeting_end_date' => 'not a date',
            'meeting_id' => 'garbage',
        ]);

        $this->assertSame(
            [null, null, null],
            DB::table('lead_follow_up')->whereIn('meeting_id', ['before', 'too-long', 'garbage'])->orderBy('id')->pluck('duration')->all()
        );
    }

    private function createMeeting(Deal $deal, array $meeting): void
    {
        $service = new DealCreationService;
        $method = new \ReflectionMethod($service, 'createMeeting');
        $method->setAccessible(true);
        $method->invoke($service, $deal, $meeting, $this->companyId);
    }

    private function seedDeal(): Deal
    {
        $id = DB::table('deals')->insertGetId(['company_id' => $this->companyId]);

        return Deal::withoutGlobalScopes()->findOrFail($id);
    }

    private function resetSchema(): void
    {
        foreach (['lead_follow_up', 'meeting_types', 'deals'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('meeting_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('meeting_type_id')->nullable();
            $table->string('location')->nullable();
            $table->string('meeting_link')->nullable();
            $table->string('meeting_id')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->integer('duration')->nullable();
            $table->string('status')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });
    }
}
