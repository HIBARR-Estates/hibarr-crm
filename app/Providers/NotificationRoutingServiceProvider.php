<?php

namespace App\Providers;

use App\Services\Notifications\MailDeliveryRecorder;
use App\Services\Notifications\UnsClient;
use App\Services\Notifications\UnsEmailPayloadMapper;
use App\Services\Notifications\UnsRoutingTransport;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class NotificationRoutingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Shared instance so the transport and the code that triggered a
        // synchronous send are looking at the same set of outcomes.
        $this->app->singleton(MailDeliveryRecorder::class);
    }

    public function boot(): void
    {
        $legacyMailer = (string) config('mail.default', 'smtp');

        if ($legacyMailer !== 'uns-routing') {
            Config::set('mail.mailers.uns-routing', [
                'transport' => 'uns-routing',
                'legacy_mailer' => $legacyMailer,
            ]);
        }

        Mail::extend('uns-routing', function (array $config) {
            $legacyMailer = (string) ($config['legacy_mailer'] ?? 'smtp');
            $fallbackTransport = app('mail.manager')->mailer($legacyMailer)->getSymfonyTransport();

            return new UnsRoutingTransport(
                app(UnsClient::class),
                app(UnsEmailPayloadMapper::class),
                $fallbackTransport,
                app(MailDeliveryRecorder::class),
            );
        });

        // Always active — per-notification routing is decided by X-Uns-Route header
        // set at dispatch time (HTTP context), so no flag service call needed at boot.
        Config::set('mail.default', 'uns-routing');
    }
}
