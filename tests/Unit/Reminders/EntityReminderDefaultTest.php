<?php

namespace Tests\Unit\Reminders;

use App\Models\EntityReminderDefault;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EntityReminderDefaultTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('entity_reminder_defaults');
        Schema::dropIfExists('companies');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('entity_reminder_defaults', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->json('reminders');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['company_id', 'entity_type']);
        });

        DB::table('companies')->insert([
            'id' => 1,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Cache::flush();
    }

    public function test_for_company_and_type_returns_specific_then_all(): void
    {
        EntityReminderDefault::withoutGlobalScopes()->create([
            'company_id' => 1,
            'entity_type' => 'all',
            'reminders' => [60, 30],
            'is_active' => true,
        ]);

        $this->assertSame([60, 30], EntityReminderDefault::forCompanyAndType(1, 'meeting'));

        Cache::flush();

        EntityReminderDefault::withoutGlobalScopes()->create([
            'company_id' => 1,
            'entity_type' => 'meeting',
            'reminders' => [15, 5],
            'is_active' => true,
        ]);

        $this->assertSame([15, 5], EntityReminderDefault::forCompanyAndType(1, 'meeting'));
    }

    public function test_seed_defaults_creates_meeting_and_all(): void
    {
        Config::set('reminders.default', [
            ['time' => 1, 'type' => 'hour'],
            ['time' => 30, 'type' => 'minute'],
        ]);

        EntityReminderDefault::seedDefaultsForCompany(1);

        $this->assertDatabaseHas('entity_reminder_defaults', [
            'company_id' => 1,
            'entity_type' => 'meeting',
        ]);
        $this->assertDatabaseHas('entity_reminder_defaults', [
            'company_id' => 1,
            'entity_type' => 'all',
        ]);

        $this->assertSame([60, 30], EntityReminderDefault::forCompanyAndType(1, 'meeting'));
    }

    public function test_offset_to_minutes(): void
    {
        $this->assertSame(60, EntityReminderDefault::offsetToMinutes(['time' => 1, 'type' => 'hour']));
        $this->assertSame(1440, EntityReminderDefault::offsetToMinutes(['time' => 1, 'type' => 'day']));
        $this->assertSame(15, EntityReminderDefault::offsetToMinutes(15));
    }

    public function test_minutes_to_offset(): void
    {
        $this->assertSame(['time' => 1, 'type' => 'hour'], EntityReminderDefault::minutesToOffset(60));
        $this->assertSame(['time' => 1, 'type' => 'day'], EntityReminderDefault::minutesToOffset(1440));
        $this->assertSame(['time' => 15, 'type' => 'minute'], EntityReminderDefault::minutesToOffset(15));
        $this->assertSame(['time' => 90, 'type' => 'minute'], EntityReminderDefault::minutesToOffset(90));
    }

    public function test_allowed_entity_types_include_core_and_extras(): void
    {
        Config::set('reminders.entity_types', ['all', 'meeting', 'task', 'deal', 'lead']);

        $types = EntityReminderDefault::allowedEntityTypes();

        $this->assertContains('all', $types);
        $this->assertContains('meeting', $types);
        $this->assertContains('task', $types);
        $this->assertTrue(EntityReminderDefault::isAllowedEntityType('deal'));
        $this->assertFalse(EntityReminderDefault::isAllowedEntityType('unknown'));
    }
}
