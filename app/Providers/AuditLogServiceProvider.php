<?php

namespace App\Providers;

use App\Support\AuditLog\AuditRecorder;
use Illuminate\Support\ServiceProvider;

/**
 * Application-wide audit log: records every model write and sign-in event
 * into `audit_logs` (see AuditRecorder). Viewed on Settings → Audit log.
 */
class AuditLogServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AuditRecorder::class);
    }

    public function boot(): void
    {
        $this->app->make(AuditRecorder::class)->register();
    }
}
