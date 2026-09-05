<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Models\DealAutomationLog;
use App\Models\Lead;
use App\Services\MetaConversionsService;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Job to send a Meta Conversion API event for the deal-stage trigger path
 * (DealObserver::triggerMetaConversionEvent() — a deal moving to a stage
 * with a Meta conversion trigger configured, no automation involved). A
 * deal/lead automation's own "Meta Conversion" action calls
 * MetaConversionsService directly instead (see
 * DealAutomationService::performMetaConversion()), since it needs the real
 * result in hand to log the automation's outcome accurately.
 *
 * Deliberately NOT a queued job (no ShouldQueue) — it runs synchronously on
 * ::dispatch() so the outcome is known immediately, instead of depending on
 * a queue worker actually being run (which this deployment cannot
 * guarantee). Callers defer the dispatch via DB::afterCommit() so it never
 * fires while the triggering save could still roll back.
 *
 * Whatever Meta answers is written to deal_automation_logs (channel "meta")
 * so the Run History screen can show the actual rejection reason — status
 * code, Meta's error message/code and its fbtrace_id — instead of only
 * recording that the event was sent.
 */
class SendMetaConversionEventJob
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The deal or lead that triggered this event — a lead-subject automation
     * has no deal at all, so this accepts either.
     */
    protected Deal|Lead $subject;

    /**
     * The event name to send to Meta
     */
    protected string $eventName;

    /**
     * The conversion value to send to Meta
     */
    protected float $value;

    /**
     * What asked for this event: 'source' ('automation' or 'stage_trigger'),
     * plus 'automation_id'/'automation_name'/'trigger_id' where they apply.
     * Carried through so the outcome log row can be attributed correctly.
     *
     * @var array<string, mixed>
     */
    protected array $origin;

    /**
     * Create a new job instance.
     *
     * @param  array<string, mixed>  $origin
     */
    public function __construct(Deal|Lead $subject, string $eventName, float $value = 0, array $origin = [])
    {
        $this->subject = $subject;
        $this->eventName = $eventName;
        $this->value = $value;
        $this->origin = $origin;
    }

    /**
     * Execute the job.
     */
    public function handle(MetaConversionsService $metaService): void
    {
        $logContext = $this->subject instanceof Lead
            ? ['lead_id' => $this->subject->id]
            : ['deal_id' => $this->subject->id];

        try {
            Log::info('Processing Meta Conversion Event Job', $logContext + [
                'event_name' => $this->eventName,
                'value' => $this->value,
                'attempt' => $this->attempts(),
            ]);

            $result = $metaService->send($this->eventName, $this->value, $this->subject);

            if ($result['success']) {
                Log::info('Meta Conversion Event Job completed successfully', $logContext + [
                    'event_name' => $this->eventName,
                    'value' => $this->value,
                ]);
            } else {
                Log::warning('Meta Conversion Event Job completed but event was not sent successfully', $logContext + [
                    'event_name' => $this->eventName,
                    'value' => $this->value,
                    'attempt' => $this->attempts(),
                    'error' => $result['error'],
                ]);

                // Don't throw exception - we don't want to keep retrying if Meta API is consistently failing
                // The detailed error is already logged in MetaConversionsService
            }

            $this->recordOutcome($result);

        } catch (\Exception $e) {
            Log::error('Meta Conversion Event Job failed with exception', $logContext + [
                'event_name' => $this->eventName,
                'value' => $this->value,
                'attempt' => $this->attempts(),
                'exception_message' => $e->getMessage(),
                'exception_trace' => $e->getTraceAsString(),
            ]);

            $this->recordOutcome([
                'success' => false,
                'error' => $e->getMessage(),
            ]);

            // Don't rethrow the exception - fail gracefully
            // We don't want to block the queue or cause cascading failures
        }
    }

    /**
     * Write the send outcome to the automation run history. `automation_id` is
     * null for the pipeline-stage trigger path (DealObserver), which has no
     * automation behind it — the column is nullable for exactly that reason.
     *
     * Never throws: a logging failure must not turn into a retried Meta send.
     *
     * @param  array<string, mixed>  $result
     */
    protected function recordOutcome(array $result): void
    {
        $success = (bool) ($result['success'] ?? false);
        $source = $this->origin['source'] ?? 'automation';

        $description = $success
            ? "Meta Conversion event \"{$this->eventName}\" accepted by Meta"
                .(isset($result['status_code']) ? " (HTTP {$result['status_code']})" : '')
            : "Meta Conversion event \"{$this->eventName}\" failed: ".($result['error'] ?? 'unknown error');

        try {
            DealAutomationLog::create([
                'company_id' => $this->subject->company_id,
                'deal_id' => $this->subject instanceof Deal ? $this->subject->id : null,
                'lead_id' => $this->subject instanceof Lead ? $this->subject->id : null,
                'automation_id' => $this->origin['automation_id'] ?? null,
                // Joins the automation run that queued it. A stage-trigger event
                // has no run to join, so it gets its own single-step id.
                'run_id' => $this->origin['run_id'] ?? 'meta-'.Str::uuid(),
                'action' => $description,
                'status' => $success ? DealAutomationLog::STATUS_SUCCESS : DealAutomationLog::STATUS_FAILED,
                'channel' => 'meta',
                'details' => [
                    'stage' => 'delivery',
                    'source' => $source,
                    'automation_name' => $this->origin['automation_name'] ?? null,
                    'trigger_id' => $this->origin['trigger_id'] ?? null,
                    'attempt' => $this->attempts(),
                    'meta' => $result,
                ],
                'executed_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Failed to record Meta Conversion outcome log', [
                'event_name' => $this->eventName,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
