<?php

namespace App\Email\Sync;

use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Exceptions\MailTransportException;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
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
        'unauthorized',
        'inbox_not_found',
    ];

    public function __construct(
        private readonly MailTransportFactory $transports,
        private readonly MessageIngestor $ingestor,
    ) {}

    public function sync(EmailConnection $connection): SyncOutcome
    {
        // Fail closed: flag, pilot allowlist and an active mailbox are all required.
        if (! EmailFeature::enabledFor($connection->user)) {
            return SyncOutcome::skipped('feature_disabled');
        }

        if (! $connection->isSyncable()) {
            return SyncOutcome::skipped('connection_inactive');
        }

        $ingested = 0;

        try {
            $context = $connection->toContext();
            $transport = $this->transports->forConnection($context);

            for ($page = 0; $page < self::MAX_PAGES_PER_RUN; $page++) {
                $fetched = $transport->fetchSince($context, $connection->syncCheckpoint(), []);

                foreach ($fetched->messages as $message) {
                    $this->ingestor->ingestNormalized($connection, $message);
                    $ingested++;
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

            return SyncOutcome::failed($ingested, $exception->errorCode);
        }

        return SyncOutcome::synced($ingested);
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
