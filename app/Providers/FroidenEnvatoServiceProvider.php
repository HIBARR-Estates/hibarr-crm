<?php

namespace App\Providers;

use Froiden\Envato\FroidenEnvatoServiceProvider as PackageServiceProvider;

/**
 * froiden/envato without its bundled route file.
 *
 * register() is inherited unchanged: it merges the package config and registers
 * the migrate:check command that check_migrate_status() relies on. The package
 * routes still used by the update and module settings pages are declared in
 * routes/web-settings.php, restricted to admins.
 */
class FroidenEnvatoServiceProvider extends PackageServiceProvider
{

    public function boot()
    {
        $this->publishFiles();
    }

}
