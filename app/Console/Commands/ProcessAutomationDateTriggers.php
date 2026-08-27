<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationLog;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Services\DealAutomationService;
use App\Services\FieldResolverService;
use App\Support\AutomationV2Feature;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class ProcessAutomationDateTriggers extends Command
{
    /**
     * Fires once per day per active date_based automation subject match —
     * yearly triggers match month/day; once requires the exact date. If the
     * daily scheduler was down on the matching day, a one-day grace window
     * (yesterday) is checked so a missed run is not lost entirely.
     */
    protected $signature = 'deal-automations:process-date-triggers';

    protected $description = 'Run date-based deal/lead automations whose configured date field matches today (birthdays, anniversaries, one-off dates)';

    public function handle(DealAutomationService $automationService, FieldResolverService $fieldResolver): int
    {
        if (! AutomationV2Feature::enabled()) {
            return Command::SUCCESS;
        }

        Company::active()->chunk(50, function ($companies) use ($automationService, $fieldResolver) {
            foreach ($companies as $company) {
                session(['company' => $company]);

                $automations = $this->automationsForCompany((int) $company->id);

                if ($automations->isEmpty()) {
                    continue;
                }

                $today = now($company->timezone ?: 'UTC')->startOfDay();

                foreach ($automations as $automation) {
                    $this->runForCompany($automation, (int) $company->id, $today, $automationService, $fieldResolver);
                }
            }
        });

        return Command::SUCCESS;
    }

    /**
     * @return Collection<int, DealAutomation>
     */
    protected function automationsForCompany(int $companyId): Collection
    {
        $pipelineIds = LeadPipeline::query()
            ->where('company_id', $companyId)
            ->pluck('id');

        return DealAutomation::query()
            ->where('active', true)
            ->where('trigger', DealAutomation::TRIGGER_DATE_BASED)
            ->with(['conditions', 'actions.emailTemplate'])
            ->where(function ($query) use ($pipelineIds) {
                $query->where('subject_type', DealAutomation::SUBJECT_LEAD)
                    ->orWhereIn('pipeline_id', $pipelineIds)
                    ->orWhere(function ($dealAnyPipeline) {
                        $dealAnyPipeline
                            ->where('subject_type', DealAutomation::SUBJECT_DEAL)
                            ->whereNull('pipeline_id');
                    });
            })
            ->get()
            ->filter(fn ($automation) => ! empty($automation->date_field));
    }

    protected function runForCompany(
        DealAutomation $automation,
        int $companyId,
        Carbon $today,
        DealAutomationService $automationService,
        FieldResolverService $fieldResolver
    ): void {
        $isYearly = ($automation->date_recurrence ?: DealAutomation::DATE_RECURRENCE_ONCE) === DealAutomation::DATE_RECURRENCE_YEARLY;
        $label = "automation '{$automation->name}' (ID: {$automation->id})";

        $subjects = $automation->subject_type === DealAutomation::SUBJECT_LEAD
            ? Lead::where('company_id', $companyId)
            : Deal::where('company_id', $companyId);

        $matched = 0;

        $subjects->chunkById(500, function ($records) use (&$matched, $automation, $label, $today, $isYearly, $automationService, $fieldResolver) {
            foreach ($records as $record) {
                try {
                    $rawValue = $fieldResolver->resolve($record, $automation->date_field);
                } catch (\Throwable $e) {
                    Log::warning("Could not resolve date field for {$label}", [
                        'subject_type' => $record::class,
                        'subject_id' => $record->id,
                        'date_field' => $automation->date_field,
                        'exception' => $e->getMessage(),
                    ]);

                    continue;
                }

                $anchorDate = $this->parseAnchorDate($rawValue);

                if (! $anchorDate || ! $this->matchesScheduledDay($anchorDate, $today, $isYearly, $automation, $record)) {
                    continue;
                }

                $matched++;

                try {
                    $automationService->runDateBased($record, $automation);
                } catch (\Throwable $e) {
                    Log::error("Action failed for {$label}", [
                        'subject_type' => $record::class,
                        'subject_id' => $record->id,
                        'exception' => $e->getMessage(),
                    ]);
                }
            }
        });

        if ($matched > 0) {
            Log::info("Date-based {$label} fired for {$matched} record(s) on {$today->toDateString()}");
        }
    }

    protected function parseAnchorDate(mixed $value): ?Carbon
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return Carbon::instance($value);
        }

        if (is_string($value) && trim($value) !== '') {
            try {
                return Carbon::parse($value);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    protected function matchesToday(Carbon $anchorDate, Carbon $today, bool $yearly): bool
    {
        return $yearly
            ? ($anchorDate->month === $today->month && $anchorDate->day === $today->day)
            : $anchorDate->isSameDay($today);
    }

    /**
     * Today, plus yesterday when the scheduler missed the matching calendar day
     * and no run was logged for this subject/automation in the last two days.
     */
    protected function matchesScheduledDay(
        Carbon $anchorDate,
        Carbon $today,
        bool $yearly,
        DealAutomation $automation,
        Deal|Lead $subject
    ): bool {
        if ($this->matchesToday($anchorDate, $today, $yearly)) {
            return true;
        }

        $yesterday = $today->copy()->subDay();
        if (! $this->matchesToday($anchorDate, $yesterday, $yearly)) {
            return false;
        }

        return ! $this->recentlyRanDateAutomation($automation, $subject, $today);
    }

    protected function recentlyRanDateAutomation(DealAutomation $automation, Deal|Lead $subject, Carbon $today): bool
    {
        $since = $today->copy()->subDays(2)->startOfDay();

        $query = DealAutomationLog::query()
            ->where('automation_id', $automation->id)
            ->where('executed_at', '>=', $since);

        if ($subject instanceof Deal) {
            $query->where('deal_id', $subject->id);
        } else {
            $query->where('lead_id', $subject->id);
        }

        return $query->exists();
    }
}
