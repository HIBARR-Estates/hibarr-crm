<?php

namespace App\Email\Transport;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Adapters\Mailtrap\MailtrapAdapter;
use App\Email\Adapters\Zoho\ZohoMailAdapter;
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

    /**
     * Sandbox and in-memory providers are refused here whatever config says.
     * "codecanyon" is the APP_ENV the production deployment runs under.
     */
    private const PRODUCTION_ENVIRONMENTS = ['production', 'codecanyon'];

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
        if (! $this->supports($provider)) {
            throw new MailTransportException('provider_unavailable', retryable: false);
        }

        return $this->app->make(match ($provider) {
            FakeMailAdapter::PROVIDER => FakeMailAdapter::class,
            MailtrapAdapter::PROVIDER => MailtrapAdapter::class,
            ZohoMailAdapter::PROVIDER => ZohoMailAdapter::class,
        });
    }

    public function supports(string $provider): bool
    {
        // Zoho is the production mailbox adapter. Sandbox and in-memory
        // providers stay refused in production whatever config says.
        if ($provider === ZohoMailAdapter::PROVIDER) {
            return $this->zohoClientConfigured()
                && $this->app->environment((array) config('email.zoho.environments', []));
        }

        if ($this->app->environment(self::PRODUCTION_ENVIRONMENTS)) {
            return false;
        }

        return match ($provider) {
            FakeMailAdapter::PROVIDER => $this->app->environment(self::FAKE_ENVIRONMENTS),
            MailtrapAdapter::PROVIDER => $this->app->environment((array) config('email.mailtrap.environments', [])),
            default => false,
        };
    }

    /** Mail OAuth client only. config/zoho.php is never consulted. */
    private function zohoClientConfigured(): bool
    {
        $id = config('email.zoho.client_id');
        $secret = config('email.zoho.client_secret');

        return is_string($id) && trim($id) !== '' && is_string($secret) && trim($secret) !== '';
    }
}
