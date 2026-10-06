<?php

namespace Tests\Concerns;

use App\Models\Company;
use App\Models\Deal;
use App\Models\Lead;
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
        '2026_10_06_000005_create_email_conversations_table.php',
        '2026_10_06_000006_create_email_record_links_table.php',
        '2026_10_06_000007_create_email_link_audits_table.php',
        '2026_10_06_000008_create_email_send_attempts_table.php',
        '2026_10_06_000009_create_email_send_recipients_table.php',
        '2026_10_06_000010_create_email_message_references_table.php',
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

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->string('client_email')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('lead_contact_methods', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type', 16);
            $table->string('identifier');
            $table->string('normalized');
            $table->boolean('is_main')->default(false);
            $table->string('source_field', 32)->nullable();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name')->nullable();
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

    /** A persisted lead, built without the observers that need the full schema. */
    protected function makeEmailLead(Company $company, ?string $email = null, array $extra = []): Lead
    {
        $attributes = $extra + [
            'company_id' => $company->id,
            'client_name' => 'Lead '.Str::random(6),
            'client_email' => $email ?? Str::lower(Str::random(10)).'@example.test',
        ];

        $id = DB::table('leads')->insertGetId($attributes + ['created_at' => now(), 'updated_at' => now()]);

        return (new Lead)->newFromBuilder(['id' => $id] + $attributes);
    }

    /** A persisted deal, built without the observers that need the full schema. */
    protected function makeEmailDeal(Company $company, ?Lead $lead = null): Deal
    {
        $attributes = [
            'company_id' => $company->id,
            'lead_id' => $lead?->id,
            'name' => 'Deal '.Str::random(6),
        ];

        $id = DB::table('deals')->insertGetId($attributes + ['created_at' => now(), 'updated_at' => now()]);

        return (new Deal)->newFromBuilder(['id' => $id] + $attributes);
    }
}
