<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Contracts\MailTransport;
use App\Email\Data\ConnectionContext;
use App\Email\Data\EmailAddress;
use App\Email\Exceptions\MailTransportException;
use App\Email\Transport\MailTransportFactory;
use Tests\TestCase;

class MailTransportBindingTest extends TestCase
{
    public function test_port_resolves_to_the_shared_fake_in_testing(): void
    {
        $transport = app(MailTransport::class);

        $this->assertInstanceOf(FakeMailAdapter::class, $transport);
        $this->assertSame($transport, app(MailTransport::class));
        $this->assertSame($transport, app(FakeMailAdapter::class));
    }

    public function test_factory_resolves_by_connection_provider(): void
    {
        $identity = new EmailAddress('agent@example.test');
        $connection = new ConnectionContext('conn-1', 'fake', $identity, $identity);
        $factory = app(MailTransportFactory::class);

        $this->assertSame(app(FakeMailAdapter::class), $factory->forConnection($connection));
        $this->assertTrue($factory->supports('fake'));
    }

    public function test_fake_is_the_default_in_local(): void
    {
        $this->app['env'] = 'local';

        $this->assertInstanceOf(FakeMailAdapter::class, app(MailTransport::class));
    }

    public function test_fake_is_never_resolvable_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->assertFalse(app(MailTransportFactory::class)->supports('fake'));

        $this->expectException(MailTransportException::class);

        app(MailTransport::class);
    }

    public function test_unknown_provider_fails_closed(): void
    {
        $factory = app(MailTransportFactory::class);

        $this->assertFalse($factory->supports('postmark'));

        try {
            $factory->make('postmark');
            $this->fail('Expected an unavailable provider to throw.');
        } catch (MailTransportException $exception) {
            $this->assertSame('provider_unavailable', $exception->errorCode);
            $this->assertFalse($exception->retryable);
        }

        config(['email.default_provider' => 'does-not-exist']);

        $this->expectException(MailTransportException::class);

        app(MailTransport::class);
    }
}
