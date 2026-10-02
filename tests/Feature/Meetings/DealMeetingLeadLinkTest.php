<?php

namespace Tests\Feature\Meetings;

use App\Models\DealFollowUp;
use App\Services\DealMeetingLeadLinker;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class DealMeetingLeadLinkTest extends TestCase
{
    private DealMeetingLeadLinker $linker;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('leads');

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
        });
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
        });
        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        // Only the lead-link `saving` hook: skip the heavy DealFollowUp observers.
        DealFollowUp::flushEventListeners();
        (new ReflectionMethod(DealFollowUp::class, 'booted'))->invoke(null);

        $this->linker = app(DealMeetingLeadLinker::class);
    }

    protected function tearDown(): void
    {
        DealFollowUp::flushEventListeners();
        // booted() runs once per process; reset it so later tests get the real hooks back.
        DealFollowUp::clearBootedModels();
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('leads');
        parent::tearDown();
    }

    private function lead(): int
    {
        return DB::table('leads')->insertGetId([]);
    }

    private function deal(?int $leadId): int
    {
        return DB::table('deals')->insertGetId(['lead_id' => $leadId]);
    }

    private function raw(?int $dealId, ?int $leadId): int
    {
        return DB::table('lead_follow_up')->insertGetId(['deal_id' => $dealId, 'lead_id' => $leadId]);
    }

    private function leadOf(int $meetingId): ?int
    {
        $v = DB::table('lead_follow_up')->where('id', $meetingId)->value('lead_id');

        return $v === null ? null : (int) $v;
    }

    public function test_creating_a_deal_meeting_copies_the_deals_lead(): void
    {
        $lead = $this->lead();
        $deal = $this->deal($lead);

        $meeting = new DealFollowUp;
        $meeting->deal_id = $deal;
        $meeting->save();

        $this->assertSame($lead, $this->leadOf($meeting->id));
    }

    public function test_a_mismatching_lead_id_is_overridden_by_the_deals_lead(): void
    {
        $lead = $this->lead();
        $other = $this->lead();
        $deal = $this->deal($lead);

        $meeting = new DealFollowUp;
        $meeting->deal_id = $deal;
        $meeting->lead_id = $other;
        $meeting->save();

        $this->assertSame($lead, $this->leadOf($meeting->id));
    }

    public function test_saving_an_existing_unlinked_meeting_repairs_it(): void
    {
        $lead = $this->lead();
        $deal = $this->deal($lead);
        $id = $this->raw($deal, null);

        $meeting = DealFollowUp::find($id);
        $meeting->location = 'office';
        $meeting->save();

        $this->assertSame($lead, $this->leadOf($id));
    }

    public function test_deal_without_a_lead_leaves_the_meeting_lead_alone(): void
    {
        $lead = $this->lead();
        $deal = $this->deal(null);

        $meeting = new DealFollowUp;
        $meeting->deal_id = $deal;
        $meeting->lead_id = $lead;
        $meeting->save();

        $this->assertSame($lead, $this->leadOf($meeting->id));
    }

    public function test_lead_only_meetings_are_untouched(): void
    {
        $lead = $this->lead();

        $meeting = new DealFollowUp;
        $meeting->lead_id = $lead;
        $meeting->save();

        $this->assertSame($lead, $this->leadOf($meeting->id));
        $this->assertNull(DB::table('lead_follow_up')->where('id', $meeting->id)->value('deal_id'));
    }

    public function test_a_dangling_deal_lead_is_never_copied(): void
    {
        $deal = $this->deal(9999);

        $meeting = new DealFollowUp;
        $meeting->deal_id = $deal;
        $meeting->save();

        $this->assertNull($this->leadOf($meeting->id));
        $this->assertSame(0, $this->linker->syncAll());
    }

    public function test_sync_deal_follows_a_relinked_deal_only_for_that_deal(): void
    {
        $old = $this->lead();
        $new = $this->lead();
        $deal = $this->deal($new);
        $otherDeal = $this->deal($old);

        $moved = $this->raw($deal, $old);
        $untouched = $this->raw($otherDeal, $old);

        $this->assertSame(1, $this->linker->syncDeal($deal));

        $this->assertSame($new, $this->leadOf($moved));
        $this->assertSame($old, $this->leadOf($untouched));
    }

    public function test_sync_lead_repairs_meetings_of_all_that_leads_deals(): void
    {
        $lead = $this->lead();
        $stale = $this->lead();
        $a = $this->raw($this->deal($lead), null);
        $b = $this->raw($this->deal($lead), $stale);

        $this->assertSame(2, $this->linker->syncLead($lead));
        $this->assertSame($lead, $this->leadOf($a));
        $this->assertSame($lead, $this->leadOf($b));
    }

    public function test_sync_all_dry_run_counts_without_writing_and_is_idempotent(): void
    {
        $lead = $this->lead();
        $deal = $this->deal($lead);
        $id = $this->raw($deal, null);
        $this->raw(null, $lead);                      // lead-only meeting
        $this->raw($this->deal(null), null);          // deal without a lead

        $this->assertSame(1, $this->linker->syncAll(true));
        $this->assertNull($this->leadOf($id));

        $this->assertSame(1, $this->linker->syncAll());
        $this->assertSame($lead, $this->leadOf($id));
        $this->assertSame(0, $this->linker->syncAll());
    }

    public function test_sync_does_not_touch_updated_at(): void
    {
        $lead = $this->lead();
        $id = $this->raw($this->deal($lead), null);

        $this->linker->syncAll();

        $this->assertNull(DB::table('lead_follow_up')->where('id', $id)->value('updated_at'));
    }
}
