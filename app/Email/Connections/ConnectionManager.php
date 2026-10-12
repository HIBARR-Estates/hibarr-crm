<?php

namespace App\Email\Connections;

use App\Email\Data\ConnectionHealth;
use App\Email\Data\HealthState;
use App\Email\Enums\ConnectionStatus;
use App\Email\Exceptions\MailTransportException;
use App\Email\Models\EmailConnection;
use App\Email\Observability\EmailLog;
use App\Email\Transport\MailTransportFactory;
use App\Models\User;
use SensitiveParameter;
use Throwable;

/**
 * The lifecycle of a mailbox connection: connect, stop, resume, reconnect,
 * disconnect. Sync and send read the connection's status, so stopping here
 * is what halts them. Nothing in this class touches mail at the provider.
 */
class ConnectionManager
{
    public function __construct(private readonly MailTransportFactory $transports) {}

    /**
     * @param  array{provider: string, identity_email: string, from_email?: string|null, reply_to_email?: string|null}  $attributes
     * @param  array<string, mixed>  $credentials
     */
    public function connect(User $owner, array $attributes, #[SensitiveParameter] array $credentials): EmailConnection
    {
        $connection = new EmailConnection([
            'company_id' => $owner->company_id,
            'user_id' => $owner->id,
            'provider' => $attributes['provider'],
            'identity_email' => $attributes['identity_email'],
            'from_email' => $attributes['from_email'] ?? $attributes['identity_email'],
            'reply_to_email' => $attributes['reply_to_email'] ?? null,
            'credentials' => $credentials,
        ]);

        // Named before it is saved: the health check addresses the mailbox by its CRM uuid.
        $connection->uuid = $connection->newUniqueId();

        $activated = $this->activate($connection);
        EmailLog::info('email.connection.connect', $this->logContext($activated, [
            'user_id' => $owner->id,
        ]));

        return $activated;
    }

    /** No new sync and no new send until resumed. Mail already in the CRM stays readable. */
    public function stop(EmailConnection $connection): EmailConnection
    {
        if ($connection->status !== ConnectionStatus::Stopped) {
            $connection->status = ConnectionStatus::Stopped;
            $connection->sync_stopped_at = now();
            $connection->save();
        }

        EmailLog::info('email.connection.stop', $this->logContext($connection));

        return $connection;
    }

    /** Re-checks the mailbox and turns it back on if the provider still accepts it. */
    public function resume(EmailConnection $connection): EmailConnection
    {
        if ($connection->status === ConnectionStatus::Active) {
            return $connection;
        }

        $activated = $this->activate($connection);
        EmailLog::info('email.connection.resume', $this->logContext($activated));

        return $activated;
    }

    /**
     * Swaps in new secrets for the same mailbox and re-checks it. The sync
     * checkpoint is kept, so nothing already ingested is fetched as new.
     *
     * @param  array<string, mixed>  $credentials
     */
    public function reconnect(EmailConnection $connection, #[SensitiveParameter] array $credentials): EmailConnection
    {
        $connection->credentials = $credentials;

        $activated = $this->activate($connection);
        EmailLog::info('email.connection.reconnect', $this->logContext($activated));

        return $activated;
    }

    /** Removes the connection from the CRM only; the provider mailbox is left as it is. */
    public function disconnect(EmailConnection $connection): void
    {
        $context = $this->logContext($connection);
        $connection->delete();
        EmailLog::info('email.connection.disconnect', $context);
    }

    private function activate(EmailConnection $connection): EmailConnection
    {
        $health = $this->health($connection);

        // Only a problem the owner must fix parks the mailbox. A provider that
        // is briefly unreachable or throttling is left to the next sync run.
        $connection->status = $health->state === HealthState::NeedsReconnect
            ? ConnectionStatus::NeedsReconnect
            : ConnectionStatus::Active;
        $connection->last_error_code = $health->isOk() ? null : ($health->errorCode ?? $health->state->value);
        $connection->sync_stopped_at = null;
        $connection->save();

        return $connection;
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function logContext(EmailConnection $connection, array $extra = []): array
    {
        return $extra + [
            'connection_id' => $connection->uuid,
            'company_id' => $connection->company_id,
            'user_id' => $connection->user_id,
            'provider' => $connection->provider,
            'status' => $connection->status->value,
            'error_code' => $connection->last_error_code,
        ];
    }

    private function health(EmailConnection $connection): ConnectionHealth
    {
        try {
            $context = $connection->toContext();

            return $this->transports->forConnection($context)->health($context);
        } catch (MailTransportException $exception) {
            return $exception->retryable
                ? ConnectionHealth::unreachable($exception->errorCode)
                : ConnectionHealth::needsReconnect($exception->errorCode);
        } catch (Throwable) {
            return ConnectionHealth::unreachable('provider_error');
        }
    }
}
