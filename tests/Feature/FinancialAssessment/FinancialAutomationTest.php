<?php

namespace Tests\Feature\FinancialAssessment;

use App\Events\FinancialAssessmentFinalised;
use App\Events\FinancialAssessmentVerified;
use App\Listeners\FinancialAssessmentAutomationListener;
use App\Models\Company;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationCondition;
use App\Models\Lead;
use App\Models\LeadFinancialSummary;
use App\Services\AutomationFieldCatalog;
use App\Services\DealAutomationService;
use App\Services\FieldResolverService;
use App\Services\FinancialAssessment\AssessmentService;
use App\Services\FinancialAssessment\FinancialAutomationFields;
use App\Services\FinancialAssessment\FinancialAutomationTrigger;
use App\Services\FinancialAssessment\FinancialStaleScanner;
use App\Support\AutomationV2Feature;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Mockery\MockInterface;
use Tests\Concerns\SetsFeatureFlags;
use Tests\FinancialAssessmentTestCase;

class FinancialAutomationTest extends FinancialAssessmentTestCase
{
    use SetsFeatureFlags;

    private AssessmentService $service;

    private FinancialAutomationFields $fields;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 10:00:00');
        $this->setFeatureFlag('crm.lead-financial-assessments', true);
        $this->setFeatureFlag('crm.automation-v2', true);
        $this->service = app(AssessmentService::class);
        $this->fields = app(FinancialAutomationFields::class);

        Schema::dropIfExists('deal_automations');
        Schema::create('deal_automations', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('subject_type')->default('deal');
            $table->string('trigger')->nullable();
            $table->boolean('active')->default(true);
            $table->integer('priority')->default(0);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('deal_automations');
        Carbon::setTestNow();
        Mockery::close();
        parent::tearDown();
    }

    private function finalised(Lead $lead, array $lines, bool $verify = false)
    {
        // A new draft starts as a copy of the current final, so set carried lines instead of adding twins.
        $draft = $this->service->startDraft($lead, $this->userId);
        $carried = $draft->lines()->get()->keyBy(fn ($line) => $line->type->key);
        foreach ($lines as $type => $amount) {
            isset($carried[$type])
                ? $this->service->updateLine($carried[$type], ['amount' => $amount])
                : $this->service->addLine($draft, $type, ['amount' => $amount]);
        }
        $final = $this->service->finalise($draft, $this->userId);

        return $verify ? $this->service->verify($final, $this->userId) : $final;
    }

    private function key(string $name): string
    {
        return FinancialAutomationFields::PREFIX.$name;
    }

    // ------------------------------------------------------------ field values

    public function test_a_lead_without_an_assessment_has_unknown_numbers_and_false_flags(): void
    {
        $lead = $this->makeLead();

        $this->assertNull($this->fields->resolveKey($lead, $this->key('available_now')));
        $this->assertNull($this->fields->resolveKey($lead, $this->key('age_days')));
        $this->assertNull($this->fields->resolveKey($lead, $this->key('refresh_due_on')));
        $this->assertSame(0, $this->fields->resolveKey($lead, $this->key('has_assessment')));
        $this->assertSame(0, $this->fields->resolveKey($lead, $this->key('verified')));
        $this->assertSame(0, $this->fields->resolveKey($lead, $this->key('is_refresh_due')));
        $this->assertSame(0, $this->fields->resolveKey($lead, $this->key('has_draft')));
    }

    public function test_figures_come_from_the_current_final_assessment_only(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['salary' => 6500, 'bank' => 42000]);
        $draft = $this->service->startDraft($lead, $this->userId);
        $this->service->addLine($draft, 'bank', ['amount' => 1]);

        $this->assertSame(1, $this->fields->resolveKey($lead, $this->key('has_assessment')));
        $this->assertSame(1, $this->fields->resolveKey($lead, $this->key('has_draft')));
        // The half-entered draft changes nothing the automation can see.
        $this->assertEquals(42000.0, $this->fields->resolveKey($lead, $this->key('available_now')));
        $this->assertEquals(6500.0, $this->fields->resolveKey($lead, $this->key('income_monthly')));
        $this->assertEquals(6500.0, $this->fields->resolveKey($lead, $this->key('disposable_monthly')));
        $this->assertEquals(42000.0, $this->fields->resolveKey($lead, $this->key('total_bank')));
        $this->assertSame('2026-11-12', $this->fields->resolveKey($lead, $this->key('as_of_date')));
        $this->assertSame('2027-02-10', $this->fields->resolveKey($lead, $this->key('refresh_due_on')));
        $this->assertSame(0, $this->fields->resolveKey($lead, $this->key('age_days')));
        $this->assertSame(90, $this->fields->resolveKey($lead, $this->key('days_until_refresh')));
    }

    public function test_verified_and_staleness_flags_follow_the_assessment(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        $this->assertSame(0, $this->fields->resolveKey($lead, $this->key('verified')));
        $this->assertNull($this->fields->resolveKey($lead, $this->key('verified_at')));

        $this->service->verify(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->assessment, $this->userId);
        $this->assertSame(1, $this->fields->resolveKey($lead, $this->key('verified')));
        $this->assertSame('2026-11-12 10:00:00', $this->fields->resolveKey($lead, $this->key('verified_at')));

        Carbon::setTestNow('2027-02-11 09:00:00');
        $this->assertSame(1, $this->fields->resolveKey($lead, $this->key('is_refresh_due')));
        $this->assertSame(-1, $this->fields->resolveKey($lead, $this->key('days_until_refresh')));
        $this->assertSame(91, $this->fields->resolveKey($lead, $this->key('age_days')));
    }

    public function test_change_since_the_previous_assessment(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 30000, 'salary' => 5000]);
        $this->assertNull($this->fields->resolveKey($lead, $this->key('available_now_change')));

        Carbon::setTestNow('2026-12-12 10:00:00');
        $this->finalised($lead, ['bank' => 38000, 'salary' => 6500]);

        $this->assertEquals(8000.0, $this->fields->resolveKey($lead, $this->key('available_now_change')));
        $this->assertEquals(1500.0, $this->fields->resolveKey($lead, $this->key('disposable_monthly_change')));
    }

    public function test_everything_is_unknown_while_the_feature_flag_is_off(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        $this->setFeatureFlag('crm.lead-financial-assessments', false);

        $this->assertNull($this->fields->resolveKey($lead, $this->key('available_now')));
        $this->assertNull($this->fields->resolveKey($lead, $this->key('has_assessment')));
        $this->assertSame(['fields' => [], 'types' => []], AutomationFieldCatalog::leadFinancial($this->companyId));
    }

    public function test_unknown_names_and_foreign_keys_resolve_to_null(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);

        $this->assertNull($this->fields->resolveKey($lead, $this->key('nonsense')));
        $this->assertNull($this->fields->resolveKey($lead, 'lead_marketing_utm_source'));
        $this->assertNull($this->fields->resolveKey($lead, $this->key('total_not_a_type')));
        $this->assertNull($this->fields->resolveKey(null, $this->key('available_now')));
    }

    public function test_the_catalog_lists_metrics_and_the_companys_active_type_totals_with_value_types(): void
    {
        DB::table('financial_assessment_line_types')->where('key', 'rent')->update(['is_active' => false]);

        $catalog = AutomationFieldCatalog::leadFinancial($this->companyId);

        $this->assertSame('Available now', $catalog['fields']['lead_financial_available_now']);
        $this->assertSame('number', $catalog['types']['lead_financial_available_now']);
        $this->assertSame('boolean', $catalog['types']['lead_financial_verified']);
        $this->assertSame('date', $catalog['types']['lead_financial_refresh_due_on']);
        $this->assertSame('Total of Salary', $catalog['fields']['lead_financial_total_salary']);
        $this->assertArrayNotHasKey('lead_financial_total_rent', $catalog['fields']);
        $this->assertSame(array_keys($catalog['fields']), array_keys($catalog['types']));
    }

    // ------------------------------------------------------------ conditions

    public function test_the_field_resolver_reads_financial_fields_for_a_lead_and_through_a_deals_contact(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 12000]);
        $resolver = app(FieldResolverService::class);

        $this->assertEquals(12000.0, $resolver->resolve($lead, 'lead_financial_available_now'));

        $deal = new Deal;
        $deal->setRelation('contact', $lead);
        $this->assertEquals(12000.0, $resolver->resolve($deal, 'lead_financial_available_now'));

        $orphan = new Deal;
        $orphan->setRelation('contact', null);
        $this->assertNull($resolver->resolve($orphan, 'lead_financial_available_now'));
    }

    public function test_changed_is_not_offered_for_financial_fields(): void
    {
        $resolver = app(FieldResolverService::class);

        $this->assertNull($resolver->nativeColumn($this->makeLead(), 'lead_financial_available_now'));
        $this->assertNull($resolver->nativeColumn(new Deal, 'lead_financial_available_now'));
    }

    private function conditionsPass(Lead $lead, array $conditions, string $logic = 'all'): bool
    {
        $automation = new DealAutomation(['condition_logic' => $logic]);
        $automation->setRelation('conditions', collect(array_map(
            fn (array $c) => new DealAutomationCondition(['field' => $c[0], 'operator' => $c[1], 'value' => $c[2] ?? null]),
            $conditions,
        )));

        $method = new \ReflectionMethod(DealAutomationService::class, 'evaluateConditions');
        $method->setAccessible(true);

        return $method->invoke(app(DealAutomationService::class), $lead, $automation);
    }

    public function test_conditions_compare_amounts_and_flags(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['salary' => 6500, 'bank' => 42000], verify: true);

        $this->assertTrue($this->conditionsPass($lead, [[$this->key('available_now'), '>', '40000']]));
        $this->assertFalse($this->conditionsPass($lead, [[$this->key('available_now'), '<', '40000']]));
        $this->assertTrue($this->conditionsPass($lead, [
            [$this->key('available_now'), '>', '40000'],
            [$this->key('verified'), '=', '1'],
            [$this->key('is_refresh_due'), '=', '0'],
        ]));
        $this->assertFalse($this->conditionsPass($lead, [[$this->key('verified'), '=', '0']]));
        $this->assertTrue($this->conditionsPass($lead, [[$this->key('total_salary'), '=', '6500']]));
        $this->assertTrue($this->conditionsPass($lead, [[$this->key('refresh_due_on'), '>', '2027-01-01']]));
    }

    public function test_a_lead_never_assessed_does_not_satisfy_a_less_than_condition(): void
    {
        $lead = $this->makeLead();

        // Without the guard PHP reads null < 5000 as true and every unassessed lead would match.
        $this->assertFalse($this->conditionsPass($lead, [[$this->key('available_now'), '<', '5000']]));
        $this->assertFalse($this->conditionsPass($lead, [[$this->key('available_now'), '=', '0']]));
        $this->assertFalse($this->conditionsPass($lead, [[$this->key('available_now'), 'exists']]));
        // The flags are always defined, so "no assessment yet" is expressible.
        $this->assertTrue($this->conditionsPass($lead, [[$this->key('has_assessment'), '=', '0']]));
        // ANY logic still lets another condition carry it.
        $this->assertTrue($this->conditionsPass($lead, [
            [$this->key('available_now'), '<', '5000'],
            [$this->key('has_assessment'), '=', '0'],
        ], 'any'));
    }

    public function test_financial_fields_can_never_be_a_merge_tag(): void
    {
        $this->assertTrue(AutomationFieldCatalog::isOutboundBlockedField('lead_financial_available_now'));
        $this->assertTrue(AutomationFieldCatalog::isOutboundBlockedField('lead_financial_total_salary'));
        // Existing behaviour is unchanged.
        $this->assertTrue(AutomationFieldCatalog::isOutboundBlockedField('lead_marketing_ip_address'));
        $this->assertFalse(AutomationFieldCatalog::isOutboundBlockedField('lead_marketing_utm_source'));
        $this->assertFalse(AutomationFieldCatalog::isOutboundBlockedField('client_name'));

        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 12000]);
        $method = new \ReflectionMethod(DealAutomationService::class, 'resolveTagValue');
        $method->setAccessible(true);

        $this->assertSame('', $method->invoke(app(DealAutomationService::class), $lead, 'lead_financial_available_now', []));
        // Also through an explicit variable mapping.
        $this->assertSame('', $method->invoke(app(DealAutomationService::class), $lead, 'balance', ['balance' => ['field' => 'lead_financial_available_now']]));
    }

    // ------------------------------------------------------------ triggers

    private function listenAndSpy(): MockInterface
    {
        $spy = Mockery::mock(DealAutomationService::class);
        $this->app->instance(DealAutomationService::class, $spy);
        Event::listen(FinancialAssessmentFinalised::class, [FinancialAssessmentAutomationListener::class, 'handleFinalised']);
        Event::listen(FinancialAssessmentVerified::class, [FinancialAssessmentAutomationListener::class, 'handleVerified']);

        return $spy;
    }

    public function test_finalising_and_verifying_run_the_lead_automations_for_their_trigger(): void
    {
        $spy = $this->listenAndSpy();
        $lead = $this->makeLead();
        $seen = [];
        $spy->shouldReceive('processLead')->twice()->andReturnUsing(function (Lead $l, ?string $trigger) use (&$seen, $lead) {
            $this->assertSame($lead->id, $l->id);
            $seen[] = $trigger;
        });

        $this->finalised($lead, ['bank' => 1000], verify: true);

        $this->assertSame(['financial_assessment_finalised', 'financial_assessment_verified'], $seen);
    }

    public function test_triggers_do_nothing_while_either_feature_flag_is_off(): void
    {
        $spy = $this->listenAndSpy();
        $spy->shouldReceive('processLead')->never();
        $lead = $this->makeLead();

        $this->setFeatureFlag('crm.automation-v2', false);
        $this->finalised($lead, ['bank' => 1000]);

        $this->setFeatureFlag('crm.automation-v2', true);
        $this->setFeatureFlag('crm.lead-financial-assessments', false);
        $this->assertTrue(app(FinancialAutomationTrigger::class)->finalised($lead->id));
    }

    public function test_a_failing_automation_never_blocks_finalising(): void
    {
        $spy = $this->listenAndSpy();
        $spy->shouldReceive('processLead')->andThrow(new \RuntimeException('boom'));
        $lead = $this->makeLead();

        $final = $this->finalised($lead, ['bank' => 1000]);

        $this->assertSame('final', $final->fresh()->status->value);
        $this->assertSame(1, $this->fields->resolveKey($lead, $this->key('has_assessment')));
    }

    public function test_the_new_triggers_are_known_to_v2_and_valid_for_lead_automations(): void
    {
        foreach ([
            DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_FINALISED,
            DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_VERIFIED,
            DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_STALE,
        ] as $trigger) {
            $automation = new DealAutomation(['subject_type' => 'lead', 'trigger' => $trigger]);
            $automation->setRelation('actions', collect());

            $this->setFeatureFlag('crm.automation-v2', false);
            $this->assertFalse(AutomationV2Feature::supportsAutomation($automation), $trigger);
            $this->setFeatureFlag('crm.automation-v2', true);
            $this->assertTrue(AutomationV2Feature::supportsAutomation($automation), $trigger);
        }
    }

    // ------------------------------------------------------------ stale scan

    private function staleAutomation(bool $active = true): void
    {
        DB::table('deal_automations')->insert([
            'company_id' => $this->companyId, 'name' => 'Refresh', 'subject_type' => 'lead',
            'trigger' => 'financial_assessment_stale', 'active' => $active,
        ]);
    }

    private function company(): Company
    {
        return Company::withoutGlobalScopes()->findOrFail($this->companyId);
    }

    private function scan(): int
    {
        return app(FinancialStaleScanner::class)->scanCompany($this->company(), now());
    }

    public function test_the_stale_scan_fires_once_per_assessment_when_it_passes_its_due_date(): void
    {
        $spy = $this->listenAndSpy();
        $fired = [];
        $spy->shouldReceive('processLead')->andReturnUsing(function (Lead $l, ?string $trigger) use (&$fired) {
            $fired[] = [$l->id, $trigger];
        });
        $this->staleAutomation();
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        $fired = []; // ignore the finalised trigger

        // Due 2027-02-10: not yet overdue on the day itself.
        Carbon::setTestNow('2027-02-10 09:00:00');
        $this->assertSame(0, $this->scan());

        Carbon::setTestNow('2027-02-11 09:00:00');
        $this->assertSame(1, $this->scan());
        $this->assertSame([[$lead->id, 'financial_assessment_stale']], $fired);
        $this->assertSame('2027-02-10', LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->stale_notified_for->toDateString());

        // The next days do not fire it again.
        Carbon::setTestNow('2027-02-12 09:00:00');
        $this->assertSame(0, $this->scan());
        $this->assertCount(1, array_filter($fired, fn ($f) => $f[1] === 'financial_assessment_stale'));
    }

    public function test_a_new_final_assessment_rearms_the_stale_trigger(): void
    {
        $spy = $this->listenAndSpy();
        $spy->shouldReceive('processLead');
        $this->staleAutomation();
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);

        Carbon::setTestNow('2027-02-11 09:00:00');
        $this->assertSame(1, $this->scan());

        // A refresh moves the due date out; it is not stale and not notified.
        $this->finalised($lead, ['bank' => 1200]);
        $this->assertSame(0, $this->scan());

        // ...and when that one goes stale, it fires again.
        Carbon::setTestNow('2027-05-20 09:00:00');
        $this->assertSame(1, $this->scan());
    }

    public function test_without_an_active_stale_automation_nothing_runs_and_nothing_is_marked(): void
    {
        $spy = $this->listenAndSpy();
        $spy->shouldReceive('processLead')->zeroOrMoreTimes();
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        $this->staleAutomation(active: false);

        Carbon::setTestNow('2027-02-11 09:00:00');
        $this->assertSame(0, $this->scan());
        $this->assertNull(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->stale_notified_for);

        // Switched on later, it still reaches the lead that is already overdue.
        DB::table('deal_automations')->update(['active' => true]);
        $this->assertSame(1, $this->scan());
    }

    public function test_a_failed_run_is_left_unmarked_so_the_next_scan_retries_it(): void
    {
        $spy = $this->listenAndSpy();
        $calls = 0;
        $spy->shouldReceive('processLead')->andReturnUsing(function (Lead $l, ?string $trigger) use (&$calls) {
            if ($trigger === 'financial_assessment_stale' && ++$calls === 1) {
                throw new \RuntimeException('transient');
            }
        });
        $this->staleAutomation();
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);

        Carbon::setTestNow('2027-02-11 09:00:00');
        $this->assertSame(0, $this->scan());
        $this->assertNull(LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->stale_notified_for);

        $this->assertSame(1, $this->scan());
    }

    public function test_other_companies_leads_are_not_scanned(): void
    {
        $spy = $this->listenAndSpy();
        $triggers = [];
        $spy->shouldReceive('processLead')->andReturnUsing(function (Lead $l, ?string $trigger) use (&$triggers) {
            $triggers[] = $trigger;
        });
        $this->staleAutomation();
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        DB::table('companies')->insert(['id' => 2, 'company_name' => 'Other', 'currency_id' => 1]);
        DB::table('deal_automations')->insert([
            'company_id' => 2, 'name' => 'Other', 'subject_type' => 'lead',
            'trigger' => 'financial_assessment_stale', 'active' => true,
        ]);

        Carbon::setTestNow('2027-02-11 09:00:00');
        // Company 2 has an automation but no assessed leads, so nothing may fire for company 1's lead.
        $this->assertSame(0, app(FinancialStaleScanner::class)->scanCompany(Company::withoutGlobalScopes()->findOrFail(2), now()));
        $this->assertNotContains('financial_assessment_stale', $triggers);
    }
}
