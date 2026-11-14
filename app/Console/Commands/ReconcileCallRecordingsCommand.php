<?php

namespace App\Console\Commands;

use App\Models\CallRecording;
use App\Services\CallBridge\LeadPhoneMatcher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Links call recordings that were captured without a lead to a lead that has
 * since been created (or whose mobile number has since been filled in).
 *
 * At call time the CRM matches the incoming number against `leads.mobile`. That
 * frequently misses:
 *   - the caller was genuinely unknown and an agent created the lead afterwards,
 *   - the lead existed but its mobile was added/edited later,
 *   - the number was stored in a different format than the one that rang.
 *
 * Recordings keep the raw `phone_number`, so the match can be retried whenever
 * the lead data changes. Safe to re-run: only rows with no entity are touched.
 */
class ReconcileCallRecordingsCommand extends Command
{
    protected $signature = 'call-recordings:reconcile-leads
        {--company= : Limit to a single company id}
        {--days=30 : Only consider recordings from the last N days}
        {--dry-run : Report what would change without writing}';

    protected $description = 'Attach orphan call recordings to leads matched by phone number';

    public function __construct(
        private readonly LeadPhoneMatcher $matcher,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $matcher = $this->matcher;
        $dryRun = (bool) $this->option('dry-run');

        $query = CallRecording::query()
            ->whereNull('entity_id')
            ->whereNotNull('phone_number')
            ->where('phone_number', '!=', '');

        if ($company = $this->option('company')) {
            $query->where('company_id', (int) $company);
        }

        if ($days = (int) $this->option('days')) {
            $query->where('created_at', '>=', now()->subDays($days));
        }

        $total = 0;
        $linked = 0;

        $query->orderBy('id')->chunkById(200, function ($recordings) use ($matcher, $dryRun, &$total, &$linked): void {
            foreach ($recordings as $recording) {
                $total++;

                $companyId = (int) ($recording->company_id ?? 0);
                if ($companyId <= 0) {
                    continue;
                }

                $lead = $matcher->findLead($companyId, (string) $recording->phone_number);
                if ($lead === null) {
                    continue;
                }

                $linked++;
                $this->line(sprintf(
                    '  recording #%d (%s) -> lead #%d %s',
                    $recording->id,
                    (string) $recording->phone_number,
                    $lead->id,
                    $lead->client_name ?? ''
                ));

                if ($dryRun) {
                    continue;
                }

                $recording->forceFill([
                    'entity_type' => 'lead',
                    'entity_id' => $lead->id,
                    'lead_name' => $recording->lead_name ?: $lead->client_name,
                ])->save();
            }
        });

        $this->info(sprintf(
            '%s %d of %d recording(s).',
            $dryRun ? 'Would link' : 'Linked',
            $linked,
            $total
        ));

        if (! $dryRun && $linked > 0) {
            Log::info('call-recordings:reconcile-leads', [
                'linked' => $linked,
                'scanned' => $total,
            ]);
        }

        return self::SUCCESS;
    }
}
