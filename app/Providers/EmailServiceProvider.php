<?php

namespace App\Providers;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Contracts\AttachmentStore;
use App\Email\Contracts\MailTransport;
use App\Email\Support\UnavailableAttachmentStore;
use App\Email\Transport\MailTransportFactory;
use Illuminate\Support\ServiceProvider;

class EmailServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Shared instance so whatever seeds the fake mailbox and the code
        // under test are looking at the same in-memory mail.
        $this->app->singleton(FakeMailAdapter::class);

        $this->app->singleton(MailTransportFactory::class);

        // Until email files exist no attachment can be read, so drafts carrying one are refused.
        $this->app->bind(AttachmentStore::class, UnavailableAttachmentStore::class);

        // The default provider's adapter (config email.default_provider). Code
        // working on a specific connection asks the factory instead.
        $this->app->bind(MailTransport::class, fn ($app) => $app->make(MailTransportFactory::class)->default());
    }

    public function boot(): void
    {
        // Always registered; each route answers 404 while crm.email is off.
        $this->loadRoutesFrom(base_path('routes/email.php'));
    }
}
