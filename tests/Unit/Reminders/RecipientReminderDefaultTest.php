<?php

namespace Tests\Unit\Reminders;

use App\Models\RecipientReminderDefault;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RecipientReminderDefaultTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('recipient_reminder_defaults');
        Schema::dropIfExists('companies');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('recipient_reminder_defaults', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->string('recipient_type', 32);
            $table->json('reminders');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['company_id', 'entity_type', 'recipient_type']);
        });

        DB::table('companies')->insert([
            'id' => 1,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Cache::flush();
    }

    public function test_missing_row_returns_null(): void
    {
        $this->assertNull(
            RecipientReminderDefault::forCompanyEntityAndRecipient(1, 'meeting', 'lead')
        );
    }

    public function test_inactive_row_returns_null(): void
    {
        RecipientReminderDefault::withoutGlobalScopes()->create([
            'company_id' => 1,
            'entity_type' => 'meeting',
            'recipient_type' => 'lead',
            'reminders' => [120, 60],
            'is_active' => false,
        ]);

        $this->assertNull(
            RecipientReminderDefault::forCompanyEntityAndRecipient(1, 'meeting', 'lead')
        );
    }

    public function test_empty_reminders_returns_null(): void
    {
        RecipientReminderDefault::withoutGlobalScopes()->create([
            'company_id' => 1,
            'entity_type' => 'meeting',
            'recipient_type' => 'lead',
            'reminders' => [],
            'is_active' => true,
        ]);

        $this->assertNull(
            RecipientReminderDefault::forCompanyEntityAndRecipient(1, 'meeting', 'lead')
        );
    }

    public function test_active_row_returns_minutes(): void
    {
        RecipientReminderDefault::withoutGlobalScopes()->create([
            'company_id' => 1,
            'entity_type' => 'meeting',
            'recipient_type' => 'lead',
            'reminders' => [120, 45, 0],
            'is_active' => true,
        ]);

        $this->assertSame(
            [120, 45, 0],
            RecipientReminderDefault::forCompanyEntityAndRecipient(1, 'meeting', 'lead')
        );
    }
}
