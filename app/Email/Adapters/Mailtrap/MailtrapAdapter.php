<?php

namespace App\Email\Adapters\Mailtrap;

use App\Email\Contracts\MailTransport;
use App\Email\Data\AttachmentContent;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\FetchPage;
use App\Email\Data\NormalizedMessage;
use App\Email\Data\SendResult;
use App\Email\Exceptions\MailTransportException;
use Throwable;

/**
 * Mailtrap Email Sandbox, for dev and staging. Captured mail never reaches a
 * real recipient. One sandbox inbox stands in for one agent's mailbox.
 *
 * Scaffolding: credentials and health are wired; fetching and sending are not
 * implemented yet and say so rather than pretending.
 */
class MailtrapAdapter implements MailTransport
{
    public const PROVIDER = 'mailtrap';

    public function health(ConnectionContext $connection): ConnectionHealth
    {
        try {
            $response = $this->client($connection)->get();
        } catch (MailTransportException $exception) {
            return $exception->retryable
                ? ConnectionHealth::unreachable($exception->errorCode)
                : ConnectionHealth::needsReconnect($exception->errorCode);
        } catch (Throwable) {
            return ConnectionHealth::unreachable('provider_error');
        }

        return match (true) {
            $response->successful() => ConnectionHealth::ok(),
            in_array($response->status(), [401, 403], true) => ConnectionHealth::needsReconnect('unauthorized'),
            $response->status() === 404 => ConnectionHealth::needsReconnect('inbox_not_found'),
            $response->status() === 429 => ConnectionHealth::quotaBackoff(
                is_numeric($response->header('Retry-After')) ? (int) $response->header('Retry-After') : null,
                'rate_limited',
            ),
            default => ConnectionHealth::unreachable('provider_error'),
        };
    }

    public function send(ConnectionContext $connection, Draft $draft): SendResult
    {
        return SendResult::rejected('not_implemented');
    }

    public function fetchSince(ConnectionContext $connection, Checkpoint $checkpoint, array $folders): FetchPage
    {
        throw new MailTransportException('not_implemented', retryable: false);
    }

    public function getMessage(ConnectionContext $connection, string $providerMessageId): ?NormalizedMessage
    {
        throw new MailTransportException('not_implemented', retryable: false);
    }

    public function getAttachment(ConnectionContext $connection, string $providerMessageId, string $partId): ?AttachmentContent
    {
        throw new MailTransportException('not_implemented', retryable: false);
    }

    /**
     * @throws MailTransportException when the account or connection is missing a credential.
     */
    private function client(ConnectionContext $connection): MailtrapClient
    {
        return MailtrapClient::forConnection($connection, (array) config('email.mailtrap', []));
    }
}
