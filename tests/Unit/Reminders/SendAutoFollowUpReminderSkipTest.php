<?php

namespace Tests\Unit\Reminders;

use App\Console\Commands\SendAutoFollowUpReminder;
use App\Models\Company;
use App\Support\ReminderFeature;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SendAutoFollowUpReminderSkipTest extends TestCase
{
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('companies');
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->string('status')->default('active');
            $table->string('timezone')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert([
            'id' => 3,
            'company_name' => 'Skip Co',
            'status' => 'active',
            'timezone' => 'UTC',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_legacy_cron_skips_allowlisted_company_when_flag_on(): void
    {
        $this->setFeatureFlag('crm.entity-reminders', true);
        Config::set('reminders.entity_reminders_company_allowlist', '3');

        $company = Company::query()->find(3);
        $this->assertTrue(ReminderFeature::enabledForCompany($company));

        $command = new SendAutoFollowUpReminder();
        // Should return early without querying follow-ups / throwing.
        $command->sendFollowUpReminder($company);
        $this->assertTrue(true);
    }
}
