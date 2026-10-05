<?php

namespace App\Support;

use Illuminate\Support\Facades\App;
use Illuminate\Support\Str;

/**
 * Rules for the demo data seeders: whether they may run at all, and what
 * password the demo accounts get. The seeders used to hardcode a well-known
 * password and ran in every environment except codecanyon, production
 * included.
 */
class DemoSeeding
{

    /**
     * Generated once per process so every demo account in a run shares it.
     */
    private static ?string $generatedPassword = null;

    /**
     * Whether the per-company demo seeders may run.
     *
     * Production is excluded unless it opts in explicitly with SEED_DEMO_DATA,
     * which exists for restoring a demo/staging instance that runs with
     * APP_ENV=production.
     */
    public static function enabled(): bool
    {
        if (App::environment('codecanyon')) {
            return false;
        }

        if (!App::environment('production')) {
            return true;
        }

        return (bool)config('app.seed_demo_data');
    }

    /**
     * The password given to the demo accounts: SEED_USER_PASSWORD when set,
     * otherwise a random one the seeder prints so a local install can sign in.
     */
    public static function password(): string
    {
        $configured = config('app.seed_user_password');

        if (is_string($configured) && $configured !== '') {
            return $configured;
        }

        if (is_null(self::$generatedPassword)) {
            self::$generatedPassword = Str::password(20);
        }

        return self::$generatedPassword;
    }

    /**
     * True when password() had to generate one, so it is worth printing.
     */
    public static function passwordWasGenerated(): bool
    {
        $configured = config('app.seed_user_password');

        return !is_string($configured) || $configured === '';
    }

    /**
     * Drops the generated password, for tests.
     */
    public static function forget(): void
    {
        self::$generatedPassword = null;
    }

}
