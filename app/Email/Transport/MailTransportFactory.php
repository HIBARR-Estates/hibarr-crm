<?php

namespace App\Email\Transport;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Contracts\MailTransport;
use App\Email\Data\ConnectionContext;
use App\Email\Exceptions\MailTransportException;
use Illuminate\Contracts\Foundation\Application;

/**
 * Picks the adapter for a connection's provider. Callers depend on this and
 * the MailTransport port, never on an adapter class.
 */
class MailTransportFactory
{
    /** The in-memory provider only exists where no real mail may be at stake. */
    private const FAKE_ENVIRONMENTS = ['testing', 'local'];

    public function __construct(private readonly Application $app) {}

    public function forConnection(ConnectionContext $connection): MailTransport
    {
        return $this->make($connection->provider);
    }

    public function default(): MailTransport
    {
        return $this->make((string) config('email.default_provider', ''));
    }

    /**
     * @throws MailTransportException when the provider has no adapter here. Fails closed:
     *                                there is no fallback to another provider.
     */
    public function make(string $provider): MailTransport
    {
        if ($this->supports($provider)) {
            return $this->app->make(FakeMailAdapter::class);
        }

        throw new MailTransportException('provider_unavailable', retryable: false);
    }

    public function supports(string $provider): bool
    {
        return $provider === FakeMailAdapter::PROVIDER && $this->app->environment(self::FAKE_ENVIRONMENTS);
    }
}
