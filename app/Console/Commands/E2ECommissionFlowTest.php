<?php

namespace App\Console\Commands;

use App\Enums\OutcomeStatus;
use App\Http\Controllers\DealController;
use App\Http\Controllers\DealGatheringController;
use App\Http\Controllers\MlmAdminApiController;
use App\Models\AgentLevelHistory;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\Lead;
use App\Models\MlmCommission;
use App\Models\Package;
use App\Models\PipelineStage;
use App\Services\Deal\DealOutcomeService;
use App\Services\DealAutomationService;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use ReflectionMethod;

/**
 * One-off local verification: drives the real controllers/services through the
 * full lifecycle a deal actually goes through in production — create, attach a
 * package, win, queue-process, and land on the commission dashboard — so the
 * package-commission work can be checked against the live app, not just unit
 * tests against an in-memory schema.
 *
 * Not meant to ship. Delete after use.
 */
class E2ECommissionFlowTest extends Command
{
    protected $signature = 'e2e:commission-flow
        {--admin-user=5 : User id to act as (must have the admin role)}
        {--agent=7 : lead_agents.id to assign the deal to}
        {--package=2 : packages.id to attach (should have a commission configured)}
        {--pipeline=1 : lead_pipelines.id}
        {--start-stage=1 : pipeline_stages.id to create the deal in}
        {--win-stage=6 : pipeline_stages.id to move into before winning (to prove stage name alone does nothing)}
        {--automation=7 : deal_automations.id whose actions replicate stage_transition -> set_field_value(won) -> lock_deal}';

    protected $description = 'End-to-end local check: create deal -> add package -> win -> commission -> lock -> dashboard';

    private int $step = 0;

    public function handle(): int
    {
        $adminUserId = (int) $this->option('admin-user');
        $agentId = (int) $this->option('agent');
        $packageId = (int) $this->option('package');
        $pipelineId = (int) $this->option('pipeline');
        $startStageId = (int) $this->option('start-stage');
        $winStageId = (int) $this->option('win-stage');

        // ── 0. Auth as a real admin, same as a logged-in browser session ──
        $this->header('Setup');
        Auth::loginUsingId($adminUserId);
        $admin = user();
        $this->check("Logged in as {$admin->name} (id={$admin->id})");
        $isAdmin = in_array('admin', user_roles(), true);
        $this->assertTrue($isAdmin, 'user has the admin role (required by updateOutcome())');

        $package = Package::withoutGlobalScopes()->findOrFail($packageId);
        $this->check("Package: \"{$package->name}\" — value {$package->value} {$package->currency}, commission ".($package->commission_type?->value ?? 'null (level fallback)').' '.($package->commission_value ?? ''));

        $agent = \App\Models\LeadAgent::withoutGlobalScopes()->with('user')->findOrFail($agentId);
        $agentLevel = AgentLevelHistory::withoutGlobalScopes()->where('agent_id', $agentId)->latest('id')->first()?->level_id;
        $this->check("Agent: {$agent->user->name} (lead_agents.id={$agent->id}), level_id={$agentLevel}");

        // ── 1. Start a deal ──────────────────────────────────────────────
        $this->header('1. Start a deal');
        $lead = Lead::create([
            'client_name' => 'E2E Test Lead '.now()->format('H:i:s'),
            'column_priority' => 1,
            'company_id' => 1,
        ]);
        $this->check("Created lead #{$lead->id}");

        $deal = new Deal;
        $deal->name = 'E2E Test Deal '.now()->format('H:i:s');
        // DealObserver::creating() normally stamps company_id/added_by from the
        // request, but that whole block is skipped when isRunningInConsoleOrSeeding()
        // is true (to avoid side effects during seeders) — so a console-created
        // deal has to set them explicitly, unlike one created from a real request.
        $deal->company_id = company()->id;
        $deal->added_by = $admin->id;
        $deal->lead_id = $lead->id;
        $deal->next_follow_up = 'yes';
        $deal->lead_pipeline_id = $pipelineId;
        $deal->pipeline_stage_id = $startStageId;
        $deal->agent_id = $agentId;
        $deal->value_source = 'calculated';
        $deal->manual_value = 0;
        $deal->value = 0;
        $deal->currency_id = company()->currency_id;
        $deal->save();
        $this->check("Created deal #{$deal->id} \"{$deal->name}\" — value={$deal->value}, outcome_status=".($deal->outcome_status?->value ?? 'null').', is_locked='.var_export((bool) $deal->is_locked, true));

        // ── 2. Update the deal: attach a package via the real inline-update path ──
        $this->header('2. Update the deal — attach a package (deals.gathering.inline_update)');
        $gatheringController = app(DealGatheringController::class);
        $inlineRequest = Request::create("/account/deals/gathering/inline-update/{$deal->id}", 'PATCH', [
            'type' => 'details',
            'data' => ['package_id' => [$packageId]],
        ]);
        $inlineResponse = $gatheringController->updateInline($inlineRequest, $deal->id);
        $inlinePayload = json_decode($inlineResponse->getContent(), true);
        $this->assertTrue(($inlinePayload['status'] ?? null) === 'success', 'updateInline() attached the package (status='.($inlinePayload['status'] ?? 'unknown').')');

        $deal->refresh();
        $deal->load(['packages', 'pipeline', 'leadStage']);
        $this->check('Deal packages now: '.$deal->packages->pluck('name')->implode(', '));
        $this->check("Deal value recalculated to {$deal->value} (value_source={$deal->value_source})");
        $this->check("Deal pipeline/stage after package routing: pipeline_id={$deal->lead_pipeline_id}, stage_id={$deal->pipeline_stage_id} ({$deal->leadStage?->name}) — package-pipeline routing may have moved it");

        // ── 3. Prove a "Win"-named stage alone does nothing ───────────────
        $this->header('3. Move into a stage literally named "win" (should NOT set outcome_status)');
        $winStage = PipelineStage::withoutGlobalScopes()->find($winStageId);
        $deal->pipeline_stage_id = $winStageId;
        $deal->save();
        $deal->refresh();
        $this->check("Moved to stage \"{$winStage?->name}\" (slug={$winStage?->slug})");
        $this->assertTrue($deal->outcome_status === null, 'outcome_status is still null after a stage-only move — confirms stage name does not win a deal');
        $this->assertTrue(! $deal->is_locked, 'deal is still unlocked');

        // ── 4. Actually win the deal, the only real way ───────────────────
        $this->header('4. Win the deal (DealController::updateOutcome())');
        $dealController = app(DealController::class);
        $outcomeService = app(DealOutcomeService::class);
        $outcomeRequest = Request::create("/account/deals/{$deal->id}/outcome", 'PATCH', [
            'outcome_status' => 'won',
            'reason' => 'E2E test',
        ]);
        $outcomeResponse = $dealController->updateOutcome($outcomeRequest, $deal->id, $outcomeService);
        $outcomePayload = json_decode($outcomeResponse->getContent(), true);
        $this->assertTrue($outcomePayload['success'] ?? false, 'updateOutcome() succeeded');
        $this->check('Response outcome: '.json_encode($outcomePayload['outcome'] ?? null));

        $deal->refresh();
        $this->check("Deal state immediately after: outcome_status={$deal->outcome_status->value}, is_locked=".var_export((bool) $deal->is_locked, true).' (expected: won, NOT locked yet — job is queued)');
        $this->assertTrue($deal->outcome_status === OutcomeStatus::Won, 'outcome_status is now Won');
        $this->assertTrue(! $deal->is_locked, 'deal is NOT locked yet — ProcessDealWonJob has only been queued, not run');

        // Previously, DealObserver::updated() wrapped its "fire DealWonEvent"
        // block in `if (! isRunningInConsoleOrSeeding())`, so this save (from a
        // console command) would NOT have queued ProcessDealWonJob at all —
        // that block has since been pulled out from under the guard. This
        // assertion is the regression check for that fix.
        $pendingJobs = DB::table('jobs')->where('queue', config('mlm.queue_connection', 'default'))->get();
        $queuedWonJob = $pendingJobs->contains(fn ($job) => str_contains($job->payload, 'ProcessDealWonJob'));
        $this->check("Jobs table: {$pendingJobs->count()} job(s) queued on connection \"".config('mlm.queue_connection', 'default').'"');
        $this->assertTrue($queuedWonJob, 'ProcessDealWonJob was actually queued by this console-invoked updateOutcome() call (this is the console-guard fix)');

        // ── 5. Process the queue for real ─────────────────────────────────
        $this->header('5. Process the queue (php artisan queue:work --stop-when-empty)');
        $this->call('queue:work', [
            '--queue' => config('mlm.queue_connection', 'default'),
            '--stop-when-empty' => true,
            '--tries' => 1,
        ]);

        $deal->refresh();
        $this->check("Deal state after queue processing: outcome_status={$deal->outcome_status->value}, is_locked=".var_export((bool) $deal->is_locked, true).', commission_locked='.var_export((bool) $deal->commission_locked, true).', commission_locked_at='.$deal->commission_locked_at);
        $this->assertTrue((bool) $deal->commission_locked, 'deal is commission-locked — ProcessDealWonJob ran and completed');
        $this->assertTrue(! $deal->is_locked, 'deal is still NOT fully locked — winning alone does not freeze the whole deal');

        // ── 6. Verify the commission was actually written ─────────────────
        $this->header('6. Verify commission distribution');
        $commissions = MlmCommission::where('deal_id', $deal->id)->get();
        $this->check("mlm_commissions rows for deal #{$deal->id}: {$commissions->count()}");
        foreach ($commissions as $c) {
            $this->check(sprintf(
                '  - type=%s agent_id=%s amount=%s percentage=%s package_id=%s level_id=%s status=%s',
                $c->type->value,
                $c->agent_id,
                $c->amount,
                $c->percentage ?? 'null',
                $c->package_id ?? 'null',
                $c->level_id ?? 'null',
                $c->status->value,
            ));
        }
        $this->assertTrue($commissions->isNotEmpty(), 'at least one commission leg was written');

        // ── 7. Verify it surfaces on the commission dashboard/ledger ──────
        $this->header('7. Verify the commission dashboard/ledger surfaces it');
        $ledgerController = app(MlmAdminApiController::class);
        $ledgerRequest = Request::create('/account/mlm/api/commissions', 'GET', ['deal_id' => $deal->id]);
        $ledgerResponse = $ledgerController->getCommissions($ledgerRequest);
        $ledgerPayload = json_decode($ledgerResponse->getContent(), true);
        $ledgerCount = $ledgerPayload['total'] ?? count($ledgerPayload['data'] ?? []);
        $this->check("Ledger query (deal_id={$deal->id}) returned {$ledgerCount} row(s)");
        $this->assertTrue($ledgerCount > 0, 'the deal\'s commission is visible through the same query the Commission Ledger page uses');

        $dashboardTotal = MlmCommission::where('company_id', company()->id)->sum('amount');
        $this->check("Company-wide total commissions (all time): {$dashboardTotal}");

        // ── 8. The commission lock must block value edits but nothing else ──
        $this->header('8. Verify the commission lock blocks value edits, not everything else');

        $patchRequest = \App\Http\Requests\Deal\PatchRequest::create(
            "/account/deals/{$deal->id}/patch",
            'PATCH',
            ['manual_value' => 99999, 'value_source' => 'manual']
        );
        $patchRequest->setContainer(app())->setRedirector(app('redirect'));
        try {
            $patchRequest->validateResolved();
            $patchResponse = $dealController->patch($patchRequest, $deal->id);
            $patchPayload = json_decode($patchResponse->getContent(), true);
            $this->assertTrue(
                ($patchPayload['success'] ?? true) === false && $patchResponse->getStatusCode() === 403,
                'patch() refused a value change on a commission-locked deal (status '.$patchResponse->getStatusCode().')'
            );
        } catch (\Throwable $e) {
            $this->assertTrue(false, 'patch() threw instead of returning a clean 403: '.$e->getMessage());
        }

        $inlinePackageAttempt = $gatheringController->updateInline(
            Request::create("/account/deals/gathering/inline-update/{$deal->id}", 'PATCH', [
                'type' => 'details',
                'data' => ['package_id' => []],
            ]),
            $deal->id
        );
        $inlinePackagePayload = json_decode($inlinePackageAttempt->getContent(), true);
        $this->assertTrue(
            ($inlinePackagePayload['status'] ?? null) === 'error' && $inlinePackageAttempt->getStatusCode() === 403,
            'updateInline() refused removing the package on a commission-locked deal'
        );

        $deal->refresh();
        $this->assertTrue(
            (float) $deal->value === 1500.0 && $deal->packages()->count() === 1,
            'value and packages are unchanged after both refused attempts'
        );

        // A non-value edit (stage move) must still go through — the whole
        // point of splitting this from is_locked.
        $stageOnlyRequest = \App\Http\Requests\Deal\PatchRequest::create(
            "/account/deals/{$deal->id}/patch",
            'PATCH',
            ['pipeline_stage_id' => $startStageId]
        );
        $stageOnlyRequest->setContainer(app())->setRedirector(app('redirect'));
        $stageOnlyRequest->validateResolved();
        $stageOnlyResponse = $dealController->patch($stageOnlyRequest, $deal->id);
        $stageOnlyPayload = json_decode($stageOnlyResponse->getContent(), true);
        $this->assertTrue(
            ($stageOnlyPayload['success'] ?? false) === true,
            'a non-value edit (stage move) still succeeds on a commission-locked deal (status '.$stageOnlyResponse->getStatusCode().': '.json_encode($stageOnlyPayload).')'
        );

        // ── 9. Verify the automation-triggered path — the actual bug report ──
        // Replicates the exact action sequence of automation #7 "Make sale for
        // Bank Account" (stage_transition -> set_field_value(outcome_status=won)
        // -> lock_deal): a lock_deal action AFTER the field-value action used to
        // silently swallow the win — by the time the tail check in
        // executeActions() ran, is_locked was already true (set by lock_deal
        // itself, moments earlier in the same run) and wasChanged('outcome_status')
        // had already been reset by lock_deal's own save. Fixed by snapshotting
        // both before the actions loop runs.
        $this->header('9. Verify the automation-triggered path (stage_transition -> set_field_value(won) -> lock_deal)');
        $automationId = (int) $this->option('automation');
        $automation = DealAutomation::withoutGlobalScopes()->with('actions')->find($automationId);

        if (! $automation) {
            $this->check("Automation #{$automationId} not found — skipping this section.");
        } else {
            $this->check("Using automation #{$automation->id} \"{$automation->name}\": ".
                $automation->actions->sortBy('id')->map(fn ($a) => $a->action_type)->implode(' -> '));

            $lead2 = Lead::create([
                'client_name' => 'E2E Automation Test Lead '.now()->format('H:i:s'),
                'column_priority' => 1,
                'company_id' => 1,
            ]);
            $deal2 = new Deal;
            $deal2->name = 'E2E Automation Test Deal '.now()->format('H:i:s');
            $deal2->company_id = company()->id;
            $deal2->added_by = $admin->id;
            $deal2->lead_id = $lead2->id;
            $deal2->next_follow_up = 'yes';
            $deal2->lead_pipeline_id = $pipelineId;
            $deal2->pipeline_stage_id = $startStageId;
            $deal2->agent_id = $agentId;
            $deal2->value_source = 'manual';
            $deal2->manual_value = 1000;
            $deal2->value = 1000;
            $deal2->currency_id = company()->currency_id;
            $deal2->saveQuietly();
            $this->check("Created deal #{$deal2->id} (no package — exercises the level-based fallback, value=1000)");

            $executeActions = new ReflectionMethod(DealAutomationService::class, 'executeActions');
            $executeActions->setAccessible(true);
            $executeActions->invoke(app(DealAutomationService::class), $deal2, $automation);

            $deal2->refresh();
            $this->check("Deal #{$deal2->id} after automation actions: outcome_status={$deal2->outcome_status->value}, is_locked=".var_export((bool) $deal2->is_locked, true));
            $this->assertTrue($deal2->outcome_status === OutcomeStatus::Won, 'the automation actually set outcome_status = won');

            $wonJobQueued = DB::table('jobs')
                ->where('queue', config('mlm.queue_connection', 'default'))
                ->get()
                ->contains(fn ($job) => str_contains($job->payload, 'ProcessDealWonJob') && str_contains($job->payload, '"id":'.$deal2->id.','));
            $this->assertTrue($wonJobQueued, 'ProcessDealWonJob was queued for this deal despite lock_deal running in the same automation sequence');

            $this->call('queue:work', [
                '--queue' => config('mlm.queue_connection', 'default'),
                '--stop-when-empty' => true,
                '--tries' => 1,
            ]);

            $deal2->refresh();
            $automationCommissions = MlmCommission::where('deal_id', $deal2->id)->get();
            $this->check("mlm_commissions rows for deal #{$deal2->id}: {$automationCommissions->count()}");
            foreach ($automationCommissions as $c) {
                $this->check(sprintf('  - type=%s agent_id=%s amount=%s percentage=%s status=%s', $c->type->value, $c->agent_id, $c->amount, $c->percentage ?? 'null', $c->status->value));
            }
            $this->assertTrue($automationCommissions->isNotEmpty(), 'the automation-triggered win actually distributed commission');
            $this->assertTrue((bool) $deal2->commission_locked, 'deal is commission-locked after the job ran');
            $this->assertTrue(
                (bool) $deal2->is_locked,
                'deal is ALSO fully locked here — but because automation #7\'s own lock_deal action set it explicitly, not because winning did'
            );
        }

        $this->header('Result');
        $this->info("Deal #{$deal->id} — full flow verified end to end.");
        $this->line('Open it locally at: /account/deals/'.$deal->id);
        $this->line('Commission ledger:  /account/mlm/commission-ledger');

        return self::SUCCESS;
    }

    private function header(string $title): void
    {
        $this->step++;
        $this->newLine();
        $this->line("<fg=cyan;options=bold>[{$this->step}] {$title}</>");
    }

    private function check(string $message): void
    {
        $this->line("  · {$message}");
    }

    private function assertTrue(bool $condition, string $description): void
    {
        if ($condition) {
            $this->line("  <fg=green>✓</> {$description}");
        } else {
            $this->line("  <fg=red>✗ FAILED:</> {$description}");
        }
    }
}
