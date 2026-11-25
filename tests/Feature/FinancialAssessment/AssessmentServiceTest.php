<?php

namespace Tests\Feature\FinancialAssessment;

use App\Enums\FinancialAssessmentSource;
use App\Enums\FinancialAssessmentStatus;
use App\Events\FinancialAssessmentFinalised;
use App\Events\FinancialAssessmentVerified;
use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLine;
use App\Models\Lead;
use App\Models\LeadFinancialSummary;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\AssessmentException;
use App\Services\FinancialAssessment\AssessmentService;
use App\Services\FinancialAssessment\FinancialAssessmentDefaults;
use App\Services\FinancialAssessment\MissingRatesException;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\FinancialAssessmentTestCase;

class AssessmentServiceTest extends FinancialAssessmentTestCase
{
    private AssessmentService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-11-12 10:00:00');
        $this->service = app(AssessmentService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function draftWith(Lead $lead, array $lines): FinancialAssessment
    {
        $draft = $this->service->startDraft($lead, $this->userId, FinancialAssessmentSource::Call);

        foreach ($lines as $type => $attributes) {
            $this->service->addLine($draft, $type, $attributes);
        }

        return $draft->fresh();
    }

    public function test_a_draft_uses_the_company_currency_and_is_reused_while_open(): void
    {
        $lead = $this->makeLead();

        $first = $this->service->startDraft($lead, $this->userId, FinancialAssessmentSource::Call);
        $second = $this->service->startDraft($lead, $this->userId, FinancialAssessmentSource::Manual);

        $this->assertSame($first->id, $second->id);
        $this->assertSame('EUR', $first->currency);
        $this->assertSame(FinancialAssessmentStatus::Draft, $first->status);
        $this->assertSame('2026-11-12', $first->as_of_date->toDateString());
        $this->assertSame($lead->id, (int) $first->draft_lead_id);
    }

    public function test_the_reporting_currency_setting_overrides_the_company_currency(): void
    {
        DB::table('lead_setting')->insert(['company_id' => $this->companyId, 'user_id' => $this->userId, 'financial_reporting_currency' => 'USD']);

        $draft = $this->service->startDraft($this->makeLead());

        $this->assertSame('USD', $draft->currency);
    }

    public function test_the_database_refuses_a_second_open_draft_for_a_lead(): void
    {
        $lead = $this->makeLead();
        $this->service->startDraft($lead);

        $this->expectException(QueryException::class);

        FinancialAssessment::withoutGlobalScope(CompanyScope::class)->create([
            'company_id' => $this->companyId,
            'lead_id' => $lead->id,
            'as_of_date' => '2026-11-12',
            'status' => FinancialAssessmentStatus::Draft,
            'currency' => 'EUR',
            'draft_lead_id' => $lead->id,
        ]);
    }

    public function test_a_new_line_takes_the_defaults_of_its_type(): void
    {
        $draft = $this->service->startDraft($this->makeLead());

        $line = $this->service->addLine($draft, 'salary', ['amount' => 6500]);

        $this->assertSame('monthly', $line->frequency->value);
        $this->assertSame('confirmed', $line->certainty->value);
        $this->assertSame('EUR', $line->currency);
        $this->assertEquals(6500, $line->amount);
    }

    public function test_invalid_lines_are_rejected_with_a_machine_readable_reason(): void
    {
        $draft = $this->service->startDraft($this->makeLead());

        $cases = [
            'not_available' => fn () => $this->service->addLine($draft, 'no_such_type', ['amount' => 1]),
            'invalid_value' => fn () => $this->service->addLine($draft, 'salary', ['amount' => -5]),
        ];

        foreach ($cases as $reason => $attempt) {
            try {
                $attempt();
                $this->fail("Expected {$reason}");
            } catch (AssessmentException $e) {
                $this->assertSame($reason, $e->reason);
            }
        }

        foreach ([['amount' => 'abc'], ['amount' => 5, 'currency' => 'NOPE1'], ['amount' => 5, 'frequency' => 'weekly'], ['amount' => 5, 'available_from' => 'not a date']] as $bad) {
            try {
                $this->service->addLine($draft, 'salary', $bad);
                $this->fail('Expected an invalid_value error for '.json_encode($bad));
            } catch (AssessmentException $e) {
                $this->assertSame('invalid_value', $e->reason);
            }
        }
    }

    public function test_a_longer_crypto_ticker_is_only_accepted_while_the_asset_is_enabled(): void
    {
        $draft = $this->service->startDraft($this->makeLead());

        $this->service->addLine($draft, 'crypto', ['amount' => 100, 'currency' => 'USDT']);

        DB::table('financial_crypto_assets')->where('ticker', 'USDC')->update(['is_active' => false]);
        $this->expectException(AssessmentException::class);
        $this->service->addLine($draft, 'crypto', ['amount' => 1, 'currency' => 'USDC']);
    }

    public function test_a_deactivated_type_can_no_longer_be_added(): void
    {
        DB::table('financial_assessment_line_types')->where('key', 'rent')->update(['is_active' => false]);
        $draft = $this->service->startDraft($this->makeLead());

        $this->expectException(AssessmentException::class);
        $this->service->addLine($draft, 'rent', ['amount' => 1200]);
    }

    public function test_finalising_freezes_totals_takes_the_current_slot_and_projects_the_summary(): void
    {
        Event::fake([FinancialAssessmentFinalised::class]);
        $lead = $this->makeLead();
        $draft = $this->draftWith($lead, [
            'salary' => ['amount' => 6500],
            'mortgage' => ['amount' => 1450],
            'bank' => ['amount' => 42000],
            'family_gift' => ['amount' => 30000, 'available_from' => '2027-06-01'],
        ]);

        $final = $this->service->finalise($draft, $this->userId);

        $this->assertSame(FinancialAssessmentStatus::Final, $final->status);
        $this->assertNull($final->draft_lead_id);
        $this->assertSame($lead->id, (int) $final->current_lead_id);
        $this->assertNotNull($final->finalised_at);
        $this->assertEquals(6500.0, $final->totals['income_monthly']);
        $this->assertEquals(5050.0, $final->totals['disposable_monthly']);
        $this->assertEquals(42000.0, $final->totals['available_now']);
        $this->assertEquals(30000.0, $final->totals['uncertain_total']);
        $this->assertSame('base', $final->totals['rates']['EUR']['source']);
        $this->assertSame(1, $final->totals['calc_version']);

        $summary = LeadFinancialSummary::withoutGlobalScopes()->find($lead->id);
        $this->assertNotNull($summary);
        $this->assertEquals(42000, $summary->available_now);
        $this->assertEquals(5050, $summary->disposable_monthly);
        $this->assertFalse($summary->verified);
        $this->assertSame('2027-02-10', $summary->refresh_due_on->toDateString());
        $this->assertSame($final->id, (int) $summary->current_assessment_id);

        Event::assertDispatched(FinancialAssessmentFinalised::class, fn ($e) => $e->assessment->id === $final->id && $e->superseded === null);
    }

    public function test_a_draft_never_reaches_the_summary_read_model(): void
    {
        $lead = $this->makeLead();
        $this->draftWith($lead, ['bank' => ['amount' => 5000]]);

        $this->assertNull(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id));
    }

    public function test_an_empty_draft_cannot_be_finalised(): void
    {
        $draft = $this->service->startDraft($this->makeLead());

        try {
            $this->service->finalise($draft);
            $this->fail('Expected an empty_assessment error');
        } catch (AssessmentException $e) {
            $this->assertSame('empty_assessment', $e->reason);
        }
    }

    public function test_an_update_copies_the_last_final_and_finalising_it_supersedes_the_old_one(): void
    {
        Event::fake([FinancialAssessmentFinalised::class]);
        $lead = $this->makeLead();
        $first = $this->service->finalise($this->draftWith($lead, [
            'salary' => ['amount' => 6000],
            'bank' => ['amount' => 38000],
        ]), $this->userId);

        Carbon::setTestNow('2026-12-01 09:00:00');
        $draft = $this->service->startDraft($lead, $this->userId, FinancialAssessmentSource::Consultation);

        $this->assertSame($first->id, (int) $draft->supersedes_assessment_id);
        $copied = FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->get();
        $this->assertCount(2, $copied);
        $this->assertEmpty($copied->filter(fn ($line) => $line->previous_line_id === null));

        $salary = $copied->first(fn ($line) => $line->type->key === 'salary');
        $this->service->updateLine($salary, ['amount' => 6500]);
        $second = $this->service->finalise($draft, $this->userId);

        $this->assertSame(FinancialAssessmentStatus::Superseded, $first->fresh()->status);
        $this->assertNull($first->fresh()->current_lead_id);
        $this->assertSame(FinancialAssessmentStatus::Final, $second->status);
        $this->assertSame($first->id, (int) $second->supersedes_assessment_id);
        $this->assertSame(1, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->where('status', 'final')->count());
        $this->assertEquals(6500, LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->income_monthly);

        // The old assessment is untouched history.
        $this->assertEquals(6000.0, $first->fresh()->totals['income_monthly']);

        Event::assertDispatched(FinancialAssessmentFinalised::class, fn ($e) => $e->assessment->id === $second->id && $e->superseded?->id === $first->id);
    }

    public function test_a_final_assessment_cannot_be_edited(): void
    {
        $lead = $this->makeLead();
        $final = $this->service->finalise($this->draftWith($lead, ['bank' => ['amount' => 100]]));

        foreach ([
            fn () => $this->service->addLine($final, 'bank', ['amount' => 1]),
            fn () => $this->service->updateLine($final->lines()->withoutGlobalScopes()->first(), ['amount' => 2]),
            fn () => $this->service->discardDraft($final),
            fn () => $this->service->finalise($final),
        ] as $attempt) {
            try {
                $attempt();
                $this->fail('Expected assessment_locked');
            } catch (AssessmentException $e) {
                $this->assertSame('assessment_locked', $e->reason);
            }
        }
    }

    public function test_discarding_a_draft_frees_the_slot_for_a_new_one(): void
    {
        $lead = $this->makeLead();
        $draft = $this->draftWith($lead, ['bank' => ['amount' => 100]]);

        $this->service->discardDraft($draft);
        $next = $this->service->startDraft($lead);

        $this->assertNotSame($draft->id, $next->id);
        $this->assertSame(0, FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $next->id)->count());
    }

    public function test_finalising_is_blocked_when_a_crypto_rate_is_unavailable_and_nothing_changes(): void
    {
        Config::set('services.crypto_rates', ['provider' => 'coingecko', 'coingecko' => ['api_key' => null], 'cache_seconds' => 60]);
        $lead = $this->makeLead();
        $draft = $this->draftWith($lead, ['crypto' => ['amount' => 0.4, 'currency' => 'BTC']]);

        try {
            $this->service->finalise($draft);
            $this->fail('Expected MissingRatesException');
        } catch (MissingRatesException $e) {
            $this->assertSame(['BTC'], $e->missing);
            $this->assertSame('missing_rates', $e->reason);
        }

        $this->assertSame(FinancialAssessmentStatus::Draft, $draft->fresh()->status);
        $this->assertNull(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id));
    }

    public function test_a_manual_rate_unblocks_finalising_and_is_recorded_as_manual(): void
    {
        Config::set('services.crypto_rates', ['provider' => 'coingecko', 'coingecko' => ['api_key' => null], 'cache_seconds' => 60]);
        $draft = $this->draftWith($this->makeLead(), ['crypto' => ['amount' => 0.4, 'currency' => 'BTC', 'certainty' => 'confirmed']]);

        $final = $this->service->finalise($draft, $this->userId, ['manual_rates' => ['BTC' => 55000]]);

        $this->assertSame('manual', $final->totals['rates']['BTC']['source']);
        $this->assertEquals(22000.0, $final->totals['available_now']);
    }

    public function test_live_crypto_rates_from_coingecko_are_frozen_into_the_totals(): void
    {
        Config::set('services.crypto_rates', [
            'provider' => 'coingecko',
            'coingecko' => ['api_key' => 'test-key', 'base_url' => 'https://api.coingecko.test/v3'],
            'cache_seconds' => 60,
        ]);
        Http::fake(['api.coingecko.test/*' => Http::response(['bitcoin' => ['eur' => 60000]])]);

        $draft = $this->draftWith($this->makeLead(), ['crypto' => ['amount' => 0.4, 'currency' => 'BTC', 'certainty' => 'confirmed']]);
        $final = $this->service->finalise($draft, $this->userId);

        $this->assertEquals(24000.0, $final->totals['available_now']);
        $this->assertEquals(60000.0, $final->totals['rates']['BTC']['rate']);
        $this->assertSame('coingecko', $final->totals['rates']['BTC']['source']);
        Http::assertSent(fn ($request) => $request->hasHeader('x-cg-demo-api-key', 'test-key') && $request['ids'] === 'bitcoin' && $request['vs_currencies'] === 'eur');
    }

    public function test_overriding_available_now_needs_a_reason_and_keeps_the_computed_figure(): void
    {
        $lead = $this->makeLead();
        $draft = $this->draftWith($lead, ['bank' => ['amount' => 10000]]);

        try {
            $this->service->finalise($draft, $this->userId, ['available_now_override' => 7500]);
            $this->fail('Expected override_reason_required');
        } catch (AssessmentException $e) {
            $this->assertSame('override_reason_required', $e->reason);
        }

        $final = $this->service->finalise($draft, $this->userId, ['available_now_override' => 7500, 'override_reason' => 'Part of the balance is a deposit']);

        $this->assertEquals(7500, $final->available_now_override);
        $this->assertEquals(7500.0, $final->totals['available_now']);
        $this->assertEquals(10000.0, $final->totals['computed_available_now']);
        $this->assertTrue(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->available_now_overridden);
    }

    public function test_verifying_records_who_and_when_once_and_updates_the_summary(): void
    {
        Event::fake([FinancialAssessmentVerified::class]);
        $lead = $this->makeLead();
        $final = $this->service->finalise($this->draftWith($lead, ['bank' => ['amount' => 100]]));

        Carbon::setTestNow('2026-11-14 10:42:00');
        $verified = $this->service->verify($final, $this->userId);

        $this->assertSame('2026-11-14 10:42:00', $verified->verified_at->toDateTimeString());
        $this->assertSame($this->userId, (int) $verified->verified_by_user_id);
        $this->assertTrue(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->verified);

        Carbon::setTestNow('2026-11-20 08:00:00');
        $again = $this->service->verify($final, 99);
        $this->assertSame('2026-11-14 10:42:00', $again->verified_at->toDateTimeString());
        $this->assertSame($this->userId, (int) $again->verified_by_user_id);
        Event::assertDispatchedTimes(FinancialAssessmentVerified::class, 1);
    }

    public function test_only_the_current_final_assessment_can_be_verified(): void
    {
        $lead = $this->makeLead();
        $draft = $this->draftWith($lead, ['bank' => ['amount' => 100]]);

        $this->expectException(AssessmentException::class);
        $this->service->verify($draft, $this->userId);
    }

    public function test_writing_values_by_mode_fill_overwrite_and_append(): void
    {
        $draft = $this->service->startDraft($this->makeLead(), null, FinancialAssessmentSource::Api);

        $added = $this->service->applyValue($draft, 'bank', 35000, 'fill', ['certainty' => 'likely']);
        $this->assertSame('added', $added['action']);

        $skipped = $this->service->applyValue($draft, 'bank', 99999, 'fill');
        $this->assertSame('skipped', $skipped['action']);
        $this->assertEquals(35000, $skipped['line']->amount);

        $updated = $this->service->applyValue($draft, 'bank', 40000, 'overwrite');
        $this->assertSame('updated', $updated['action']);
        $this->assertEquals(40000, $updated['line']->fresh()->amount);

        $this->service->applyValue($draft, 'bank', 5000, 'append');
        $this->assertSame(2, FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->count());

        $this->service->applyValue($draft, 'bank', 1000, 'overwrite');
        $this->assertSame(1, FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->count());
    }

    public function test_a_proof_document_must_belong_to_the_same_lead(): void
    {
        $lead = $this->makeLead();
        $other = $this->makeLead('Someone else');
        $mine = DB::table('lead_contact_files')->insertGetId(['lead_id' => $lead->id]);
        $theirs = DB::table('lead_contact_files')->insertGetId(['lead_id' => $other->id]);
        $draft = $this->service->startDraft($lead);

        $line = $this->service->addLine($draft, 'bank', ['amount' => 1, 'proof_file_id' => $mine]);
        $this->assertSame($mine, (int) $line->proof_file_id);

        $this->expectException(AssessmentException::class);
        $this->service->addLine($draft, 'bank', ['amount' => 1, 'proof_file_id' => $theirs]);
    }

    public function test_the_refresh_date_drives_the_due_flag(): void
    {
        $lead = $this->makeLead();
        $this->service->finalise($this->draftWith($lead, ['bank' => ['amount' => 100]]));

        $this->assertFalse($this->service->isRefreshDue($lead, Carbon::parse('2027-02-10')));
        $this->assertTrue($this->service->isRefreshDue($lead, Carbon::parse('2027-02-11')));
    }

    public function test_default_seeding_is_idempotent_and_keeps_admin_changes(): void
    {
        DB::table('financial_assessment_kinds')->where('key', 'income')->update(['label' => 'Earnings']);
        DB::table('financial_assessment_line_types')->where('key', 'bank')->update(['is_active' => false]);

        FinancialAssessmentDefaults::seedForCompany($this->companyId);
        FinancialAssessmentDefaults::seedForCompany($this->companyId);

        $this->assertSame(4, DB::table('financial_assessment_kinds')->count());
        $this->assertSame(13, DB::table('financial_assessment_line_types')->count());
        $this->assertSame(5, DB::table('financial_crypto_assets')->count());
        $this->assertSame('Earnings', DB::table('financial_assessment_kinds')->where('key', 'income')->value('label'));
        $this->assertEquals(0, DB::table('financial_assessment_line_types')->where('key', 'bank')->value('is_active'));
    }
}
