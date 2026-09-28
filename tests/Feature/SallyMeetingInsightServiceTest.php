<?php

namespace Tests\Feature;

use App\Services\SallyMeetingInsightService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The lead page shows a lead's Sally insights, including the ones that hang
 * off one of the lead's deals (meetings created from the Deals workspace only
 * carry deal_id), minus any whose deal the user may not view.
 */
class SallyMeetingInsightServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureTables();
    }

    public function test_for_lead_includes_insights_attached_to_the_leads_deals(): void
    {
        $leadId = $this->makeLead();
        $dealId = $this->makeDeal($leadId);
        $directMeetingId = $this->makeMeeting(['lead_id' => $leadId]);
        $dealMeetingId = $this->makeMeeting(['deal_id' => $dealId]);

        $this->makeInsight($directMeetingId, ['lead_id' => $leadId]);
        $this->makeInsight($dealMeetingId, ['deal_id' => $dealId]);

        $ids = app(SallyMeetingInsightService::class)
            ->forLead($leadId)
            ->pluck('id')
            ->all();

        $this->assertCount(2, $ids, 'A deal-scoped insight must surface on the lead page.');
    }

    public function test_for_lead_excludes_insights_from_another_leads_deals(): void
    {
        $leadId = $this->makeLead();
        $otherLeadId = $this->makeLead();
        $otherDealId = $this->makeDeal($otherLeadId);
        $otherMeetingId = $this->makeMeeting(['deal_id' => $otherDealId]);

        $this->makeInsight($otherMeetingId, ['deal_id' => $otherDealId]);

        $this->assertCount(
            0,
            app(SallyMeetingInsightService::class)->forLead($leadId),
        );
    }

    public function test_upsert_decodes_escaped_newlines_in_a_markdown_summary(): void
    {
        $companyId = 1;
        $leadId = $this->makeLead();
        $meetingId = $this->makeMeeting(['lead_id' => $leadId]);

        $result = app(\App\Services\ApiV2\CrmWriteService::class)
            ->upsertSallyMeetingInsight($companyId, [
                'meeting_id' => $meetingId,
                'summary' => 'Fee is **1,400 per account**.\n\nA joint account still counts as **one account**.',
                'bullet_points' => ['Two accounts cost 2,800.\nA deposit was discussed.'],
            ]);

        $stored = $result['insight']->fresh();

        // Real newlines, so markdown renders as paragraphs rather than as
        // one run-on line with literal \n in it.
        $this->assertStringNotContainsString('\n', $stored->summary);
        $this->assertStringContainsString("\n\n", $stored->summary);
        $this->assertStringContainsString('**1,400 per account**', $stored->summary);

        // bullet_points is cast to array by the model.
        $bullets = $stored->bullet_points;
        $this->assertStringNotContainsString('\n', $bullets[0]);
        $this->assertStringContainsString("\n", $bullets[0]);
    }

    public function test_sanitize_summary_keeps_rich_text_and_strips_dangerous_markup(): void
    {
        $clean = SallyMeetingInsightService::sanitizeSummary(
            '<p>Client wants a <strong>villa</strong> with <em>sea view</em>.</p>'
            .'<script>alert(1)</script>'
            .'<p onclick="steal()">Call back</p>'
            .'<a href="javascript:alert(2)">link</a>',
        );

        $this->assertStringContainsString('<strong>villa</strong>', $clean);
        $this->assertStringContainsString('<em>sea view</em>', $clean);
        $this->assertStringNotContainsString('<script', $clean);
        $this->assertStringNotContainsString('onclick', $clean);
        $this->assertStringNotContainsString('javascript:', $clean);
    }

    public function test_serializer_exposes_the_meeting_timezone(): void
    {
        $leadId = $this->makeLead();
        $meetingId = $this->makeMeeting([
            'lead_id' => $leadId,
            'timezone' => 'Europe/Nicosia',
        ]);
        $insight = $this->makeInsight($meetingId, ['lead_id' => $leadId]);
        $insight->load('meetingFollowUp');

        $payload = app(SallyMeetingInsightService::class)->serialize($insight);

        $this->assertSame('Europe/Nicosia', $payload['meeting']['timezone']);
    }

    private function makeLead(int $companyId = 1): int
    {
        return DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeDeal(int $leadId, int $companyId = 1): int
    {
        return DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeMeeting(array $attributes = []): int
    {
        return DB::table('lead_follow_up')->insertGetId(array_merge([
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function makeInsight(int $meetingId, array $attributes = [])
    {
        $id = DB::table('sally_meeting_insights')->insertGetId(array_merge([
            'company_id' => 1,
            'meeting_follow_up_id' => $meetingId,
            'summary' => 'Summary',
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));

        return \App\Models\SallyMeetingInsight::withoutGlobalScopes()->find($id);
    }

    private function ensureTables(): void
    {
        if (! Schema::hasTable('leads')) {
            Schema::create('leads', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('deals')) {
            Schema::create('deals', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedBigInteger('lead_id')->nullable();
                $table->string('name')->nullable();
                $table->unsignedInteger('added_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('lead_follow_up')) {
            Schema::create('lead_follow_up', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('lead_id')->nullable();
                $table->unsignedBigInteger('deal_id')->nullable();
                $table->string('remark')->nullable();
                $table->string('location')->nullable();
                $table->string('timezone')->nullable();
                $table->timestamp('next_follow_up_date')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('sally_meeting_insights')) {
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
                $table->timestamps();
            });
        }
    }
}
