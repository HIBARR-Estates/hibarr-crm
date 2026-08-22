<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\Lead;
use App\Services\DealAutomationService;
use App\Services\FieldResolverService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class ProcessAutomationDateTriggers extends Command
{
    /**
     * Fires once per day per active date_based automation subject match —
     * there is deliberately no extra "already ran" tracking: a yearly trigger
     * only ever matches one calendar day per year, and 'once' matches exactly
     * one day ever. If the scheduler is down on the matching day, that firing
     * is skipped for the year.
     */
    protected $signature = 'deal-automations:process-date-triggers';

    protected $description = 'Run date-based deal/lead automations whose configured date field matches today (birthdays, anniversaries, one-off dates)';

    public function handle(DealAutomationService $automationService, FieldResolverService $fieldResolver): int
    {
        $automations = DealAutomation::query()
            ->where('active', true)
            ->where('trigger', DealAutomation::TRIGGER_DATE_BASED)
            ->with(['conditions', 'actions.emailTemplate'])
            ->get()
            ->filter(fn ($automation) => ! empty($automation->date_field));

        if ($automations->isEmpty()) {
            return Command::SUCCESS;
        }

        Company::active()->chunk(50, function ($companies) use ($automations, $automationService, $fieldResolver) {
            foreach ($companies as $company) {
                // The automation service and TaskService read date formats and
                // ids through the company() helper, which is session-backed and
                // empty under the scheduler — bind it for this company's pass.
                session(['company' => $company]);

                // "Today" in the company's own timezone — a client's birthday
                // is their local calendar day, not the server's.
                $today = now($company->timezone ?: 'UTC')->startOfDay();

                foreach ($automations as $automation) {
                    $this->runForCompany($automation, (int) $company->id, $today, $automationService, $fieldResolver);
                }
            }
        });

        return Command::SUCCESS;
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

                if (! $anchorDate || ! $this->matchesToday($anchorDate, $today, $isYearly)) {
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

    /**
     * FieldResolverService returns raw column strings (via getRawOriginal),
     * custom-field DB strings, or cast Carbon instances depending on the field
     * — normalize all three to a Carbon or null.
     */
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

    /**
     * Yearly matches month/day regardless of year (Feb 29 birthdays only fire
     * in leap years); once requires the exact date to land on today.
     */
    protected function matchesToday(Carbon $anchorDate, Carbon $today, bool $yearly): bool
    {
        return $yearly
            ? ($anchorDate->month === $today->month && $anchorDate->day === $today->day)
            : $anchorDate->isSameDay($today);
    }
}
