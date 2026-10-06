<?php

namespace Tests\Concerns;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * The full migration set does not run on sqlite (legacy MySQL-only
 * statements), so Email tests build the two tables they lean on by hand and
 * then run the real Email migrations on top.
 */
trait BuildsEmailSchema
{
    /** @var list<string> Email migrations, in order. */
    private array $emailMigrations = [
        '2026_10_06_000001_create_email_connections_table.php',
        '2026_10_06_000002_create_email_pilot_allowlist_table.php',
        '2026_10_06_000003_create_email_messages_table.php',
        '2026_10_06_000004_create_email_mailbox_copies_table.php',
    ];

    protected function buildEmailSchema(): void
    {
        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable()->unique();
            $table->timestamps();
        });

        foreach ($this->emailMigrations as $migration) {
            (require database_path("migrations/{$migration}"))->up();
        }
    }

    protected function makeEmailCompany(): Company
    {
        $id = DB::table('companies')->insertGetId([
            'company_name' => 'Email Test Co '.Str::random(6),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return (new Company)->newFromBuilder(['id' => $id, 'company_name' => 'Email Test Co']);
    }

    /** A persisted user, built without the observers that need the full schema. */
    protected function makeEmailUser(?Company $company = null): User
    {
        $company ??= $this->makeEmailCompany();

        $attributes = [
            'company_id' => $company->id,
            'name' => 'Agent '.Str::random(6),
            'email' => Str::lower(Str::random(10)).'@agency.test',
        ];

        $id = DB::table('users')->insertGetId($attributes + ['created_at' => now(), 'updated_at' => now()]);

        $user = (new User)->newFromBuilder(['id' => $id] + $attributes);
        $user->setRelation('company', $company);

        return $user;
    }
}
