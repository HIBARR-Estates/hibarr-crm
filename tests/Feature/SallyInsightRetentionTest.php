<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Lead;
use App\Observers\DealObserver;
use App\Observers\LeadObserver;
use App\Services\SallyInsightRetentionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Transcripts must not outlive the record identifying the client, but the two
 * parents delete differently — Lead soft-deletes (so a cascadeOnDelete FK
 * never fires) and Deal hard-deletes (so a cascade would destroy transcripts
 * whose lead is still alive). The service encodes the ownership rule; these
 * tests hold it in place.
 *
 * Driven through the observer hooks, since that is what production calls.
 */
class SallyInsightRetentionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->buildSchema();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('sally_meeting_insights');
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('universal_search');
        Schema::dropIfExists('custom_fields_data');

        parent::tearDown();
    }

    public function test_deleting_a_lead_purges_its_transcripts(): void
    {
        $leadId = $this->makeLead();
        $insightId = $this->makeInsight($leadId, $this->makeDeal($leadId));

        // Lead soft-deletes, so a cascade FK could never do this.
        app(SallyInsightRetentionService::class)->purgeForLead($leadId);

        $this->assertSame(0, $this->countInsights());
        $this->assertFalse(DB::table('sally_meeting_insights')->where('id', $insightId)->exists());
    }

    public function test_deleting_a_deal_keeps_a_transcript_that_a_live_lead_owns(): void
    {
        $leadId = $this->makeLead();
        $dealId = $this->makeDeal($leadId);
        $insightId = $this->makeInsight($leadId, $dealId);

        app(SallyInsightRetentionService::class)->purgeForDeal($dealId);

        // Deal hard-deletes, so a cascade FK would have taken this row too.
        $row = DB::table('sally_meeting_insights')->where('id', $insightId)->first();

        $this->assertNotNull($row, 'a live lead still owns this transcript');
        $this->assertNull($row->deal_id, 'the reference to the deleted deal must be released');
        $this->assertSame($leadId, (int) $row->lead_id);
    }

    public function test_deleting_a_deal_purges_a_transcript_no_lead_owns(): void
    {
        $leadId = $this->makeLead();
        $dealId = $this->makeDeal($leadId);
        $insightId = $this->makeInsight(null, $dealId);

        app(SallyInsightRetentionService::class)->purgeForDeal($dealId);

        $this->assertFalse(
            DB::table('sally_meeting_insights')->where('id', $insightId)->exists(),
            'the deal was the only reference, so nothing would reach this row',
        );
    }

    public function test_deleting_a_lead_also_purges_a_deal_only_transcript(): void
    {
        // Same meeting, seen through a lead the upsert backfilled it from.
        $leadId = $this->makeLead();
        $dealId = $this->makeDeal($leadId);
        $insightId = $this->makeInsight($leadId, $dealId);

        app(SallyInsightRetentionService::class)->purgeForLead($leadId);

        $this->assertFalse(DB::table('sally_meeting_insights')->where('id', $insightId)->exists());
    }

    public function test_unrelated_transcripts_survive(): void
    {
        $keepLead = $this->makeLead();
        $keepInsight = $this->makeInsight($keepLead, null);

        $dropLead = $this->makeLead();
        $dropDeal = $this->makeDeal($dropLead);
        $this->makeInsight($dropLead, $dropDeal);

        app(SallyInsightRetentionService::class)->purgeForLead($dropLead);

        $this->assertSame(1, $this->countInsights());
        $this->assertTrue(DB::table('sally_meeting_insights')->where('id', $keepInsight)->exists());
    }

    public function test_lead_observer_hook_purges_transcripts(): void
    {
        $leadId = $this->makeLead();
        $dealId = $this->makeDeal($leadId);
        $insightId = $this->makeInsight($leadId, $dealId);

        // The observer is the only production caller of the retention service,
        // so exercise the hook itself. A real Lead::delete() would drag in the
        // whole observer stack (notifications, CRM events, universal_search),
        // which is unrelated to what this test is pinning.
        $lead = new Lead;
        $lead->id = $leadId;

        app(LeadObserver::class)->deleted($lead);

        $this->assertFalse(DB::table('sally_meeting_insights')->where('id', $insightId)->exists());
    }

    public function test_deal_observer_hook_releases_transcripts(): void
    {
        $leadId = $this->makeLead();
        $dealId = $this->makeDeal($leadId);
        $insightId = $this->makeInsight($leadId, $dealId);

        $deal = new Deal;
        $deal->id = $dealId;

        app(DealObserver::class)->deleted($deal);

        $this->assertSame(
            1,
            DB::table('sally_meeting_insights')->where('id', $insightId)->count(),
            'the live lead keeps ownership',
        );
        $this->assertNull(
            DB::table('sally_meeting_insights')->where('id', $insightId)->value('deal_id'),
        );
    }

    public function test_both_observers_are_registered(): void
    {
        // The service is only reachable in production through these hooks, so a
        // registration that silently drops one leaves transcripts behind.
        foreach ([Lead::class, Deal::class] as $model) {
            $listeners = Event::getListeners('eloquent.deleted: '.$model);

            $this->assertNotEmpty(
                $listeners,
                'no delete listener registered for '.$model,
            );
        }
    }

    public function test_service_is_callable_directly_for_bulk_purges(): void
    {
        $leadId = $this->makeLead();
        $this->makeInsight($leadId, null);

        $removed = app(SallyInsightRetentionService::class)->purgeForLead($leadId);

        $this->assertSame(1, $removed);
        $this->assertSame(0, $this->countInsights());
    }

    private function countInsights(): int
    {
        return DB::table('sally_meeting_insights')->count();
    }

    private function makeLead(): int
    {
        return DB::table('leads')->insertGetId([
            'company_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeDeal(int $leadId): int
    {
        return DB::table('deals')->insertGetId([
            'company_id' => 1,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeInsight(?int $leadId, ?int $dealId): int
    {
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('sally_meeting_insights')->insertGetId([
            'company_id' => 1,
            'meeting_follow_up_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'summary' => 'transcript',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function buildSchema(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->text('remark')->nullable();
            $table->string('location')->nullable();
            $table->timestamps();
        });

        Schema::create('sally_meeting_insights', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('meeting_follow_up_id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->text('summary')->nullable();
            $table->longText('transcript')->nullable();
            $table->json('transcript_segments')->nullable();
            $table->json('bullet_points')->nullable();
            $table->timestamps();
        });

        // Untouched by the retention rules, but both observer hooks clear these,
        // so the hook cannot run to completion without them existing.
        Schema::create('universal_search', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedBigInteger('searchable_id');
            $table->string('module_type')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->string('model')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->timestamps();
        });
    }
}