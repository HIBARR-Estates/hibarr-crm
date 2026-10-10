<?php

namespace App\Email\Sync;

use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Exceptions\MailTransportException;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Observability\EmailLog;
use App\Email\Transport\MailTransportFactory;

/**
 * Pulls new mail for one connection: fetch a page from the provider, ingest
 * it, then — and only then — move the checkpoint. Ingestion is idempotent, so
 * a run that dies between the two simply repeats that page next time.
 */
class MailboxSynchronizer
{
    /** Pages per run; a mailbox with more than this catches up over several runs. */
    private const MAX_PAGES_PER_RUN = 10;

    /** Provider problems only the mailbox owner can fix by reconnecting. */
    private const RECONNECT_CODES = [
        'missing_api_token',
        'missing_account_id',
        'missing_inbox_id',
        'missing_oauth_client',
        'missing_refresh_token',
        'unauthorized',
        'inbox_not_found',
        'mailbox_not_found',
    ];

    public function __construct(
        private readonly MailTransportFactory $transports,
        private readonly MessageIngestor $ingestor,
    ) {}

    public function sync(EmailConnection $connection): SyncOutcome
    {
        $started = microtime(true);

        // Fail closed: flag, pilot allowlist and an active mailbox are all required.
        if (! EmailFeature::enabledFor($connection->user)) {
            return $this->finishSync($connection, SyncOutcome::skipped('feature_disabled'), $started);
        }

        if (! $connection->isSyncable()) {
            return $this->finishSync($connection, SyncOutcome::skipped('connection_inactive'), $started);
        }

        $ingested = 0;
        $maxLagMs = null;

        try {
            $context = $connection->toContext();
            $transport = $this->transports->forConnection($context);

            for ($page = 0; $page < self::MAX_PAGES_PER_RUN; $page++) {
                $fetched = $transport->fetchSince($context, $connection->syncCheckpoint(), []);

                foreach ($fetched->messages as $message) {
                    $this->ingestor->ingestNormalized($connection, $message);
                    $ingested++;

                    if (config('email.observability.log_ingest_lag', true) && $message->sentAt !== null) {
                        $lag = (int) max(0, (now()->getTimestamp() - $message->sentAt->getTimestamp()) * 1000);
                        $maxLagMs = $maxLagMs === null ? $lag : max($maxLagMs, $lag);
                    }
                }

                $connection->forceFill([
                    'checkpoint' => $fetched->checkpoint->toArray(),
                    'last_sync_at' => now(),
                    'last_error_code' => null,
                ])->save();

                if (! $fetched->hasMore) {
                    break;
                }
            }
        } catch (MailTransportException $exception) {
            $this->recordFailure($connection, $exception);

            return $this->finishSync(
                $connection,
                SyncOutcome::failed($ingested, $exception->errorCode),
                $started,
                $maxLagMs,
            );
        }

        return $this->finishSync($connection, SyncOutcome::synced($ingested), $started, $maxLagMs);
    }

    private function finishSync(
        EmailConnection $connection,
        SyncOutcome $outcome,
        float $startedAt,
        ?int $maxIngestLagMs = null,
    ): SyncOutcome {
        $context = [
            'connection_id' => $connection->uuid,
            'company_id' => $connection->company_id,
            'user_id' => $connection->user_id,
            'ran' => $outcome->ran,
            'ingested' => $outcome->ingested,
            'reason' => $outcome->reason,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            // Measured only — not an SLO (see docs/email/architecture.md).
            'ingest_lag_ms_max' => $maxIngestLagMs,
        ];

        EmailLog::metric('email.job.sync', $context);

        return $outcome;
    }

    /**
     * A failing mailbox is recorded and left for the next run; it never takes
     * the worker down. The checkpoint stays where the last good page left it.
     */
    private function recordFailure(EmailConnection $connection, MailTransportException $exception): void
    {
        $connection->last_error_code = $exception->errorCode;

        if (in_array($exception->errorCode, self::RECONNECT_CODES, true)) {
            $connection->status = ConnectionStatus::NeedsReconnect;
        } elseif (! $exception->retryable) {
            $connection->status = ConnectionStatus::Error;
        }

        $connection->save();
    }
}
