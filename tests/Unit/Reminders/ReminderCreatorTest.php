<?php

namespace Tests\Unit\Reminders;

use App\Jobs\Reminders\SendReminderJob;
use App\Models\EntityReminderDefault;
use App\Models\Reminder;
use App\Models\User;
use App\Services\Reminders\ReminderCreator;
use App\Support\ReminderFeature;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ReminderCreatorTest extends TestCase
{
    use SetsFeatureFlags;

    private ReminderCreator $creator;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('reminders');
        Schema::dropIfExists('entity_reminder_defaults');
        Schema::dropIfExists('user_reminder_preferences');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('email')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('entity_reminder_defaults', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->json('reminders');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('user_reminder_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('entity_type')->default('meeting');
            $table->json('reminders')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->unsignedInteger('entity_id');
            $table->dateTime('remind_at');
            $table->string('status', 32)->default('pending');
            $table->dateTime('sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->string('channel', 32)->default('email');
            $table->string('recipient_type', 32);
            $table->unsignedInteger('recipient_id')->nullable();
            $table->string('recipient_email')->nullable();
            $table->text('message')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert([
            'id' => 10,
            'company_name' => 'Acme',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => 5,
            'email' => 'agent@example.com',
            'name' => 'Agent',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        EntityReminderDefault::seedDefaultsForCompany(10);
        Cache::flush();

        Config::set('reminders.entity_reminders_company_allowlist', '10');
        $this->setFeatureFlag('crm.entity-reminders', true);

        $this->creator = app(ReminderCreator::class);
    }

    public function test_flag_off_creates_no_rows(): void
    {
        $this->setFeatureFlag('crm.entity-reminders', false);

        $created = $this->creator->createForEntity(
            10,
            'meeting',
            99,
            now()->addHour(),
            [['type' => 'user', 'id' => 5, 'email' => 'agent@example.com']],
            [60, 30]
        );

        $this->assertSame([], $created);
        $this->assertSame(0, Reminder::query()->count());
    }

    public function test_create_expands_cadence_into_rows(): void
    {
        Bus::fake([SendReminderJob::class]);

        $eventAt = now()->addDay()->startOfMinute();
        $created = $this->creator->createForEntity(
            10,
            'meeting',
            99,
            $eventAt,
            [['type' => 'user', 'id' => 5, 'email' => 'agent@example.com']],
            [60, 30]
        );

        $this->assertCount(2, $created);
        $this->assertSame(2, Reminder::query()->where('entity_id', 99)->count());
        $this->assertTrue(
            Reminder::query()->where('status', Reminder::STATUS_PENDING)->exists()
        );
        Bus::assertNotDispatched(SendReminderJob::class);
    }

    public function test_rebuild_cancels_open_and_recreates(): void
    {
        Bus::fake([SendReminderJob::class]);

        $eventAt = now()->addDay();
        $this->creator->createForEntity(
            10,
            'meeting',
            50,
            $eventAt,
            [['type' => 'user', 'id' => 5, 'email' => 'agent@example.com']],
            [60]
        );

        $this->creator->rebuildForEntity(
            10,
            'meeting',
            50,
            $eventAt,
            [['type' => 'user', 'id' => 5, 'email' => 'agent@example.com']],
            [30]
        );

        $this->assertSame(1, Reminder::query()->where('status', Reminder::STATUS_CANCELLED)->count());
        $this->assertSame(1, Reminder::query()->where('status', Reminder::STATUS_PENDING)->count());
    }

    public function test_due_now_dispatches_send_job(): void
    {
        Bus::fake([SendReminderJob::class]);

        $frozen = \Illuminate\Support\Carbon::parse('2026-08-04 12:00:00');
        \Illuminate\Support\Carbon::setTestNow($frozen);

        $this->creator->createForEntity(
            10,
            'meeting',
            77,
            $frozen,
            [['type' => 'email', 'email' => 'guest@example.com']],
            [0]
        );

        Bus::assertDispatched(SendReminderJob::class);
        \Illuminate\Support\Carbon::setTestNow();
    }

    public function test_skips_offsets_already_in_the_past(): void
    {
        Bus::fake([SendReminderJob::class]);

        $frozen = \Illuminate\Support\Carbon::parse('2026-08-04 12:00:00');
        \Illuminate\Support\Carbon::setTestNow($frozen);
        $eventAt = $frozen->copy()->addMinutes(16);

        $created = $this->creator->createForEntity(
            10,
            'meeting',
            88,
            $eventAt,
            [['type' => 'user', 'id' => 5, 'email' => 'agent@example.com']],
            [60, 30, 15, 5]
        );

        $this->assertCount(2, $created);
        $minutesBefore = collect($created)
            ->map(fn (Reminder $reminder) => (int) $reminder->remind_at->diffInMinutes($eventAt))
            ->sort()
            ->values()
            ->all();

        $this->assertSame([5, 15], $minutesBefore);
        Bus::assertNotDispatched(SendReminderJob::class);
        \Illuminate\Support\Carbon::setTestNow();
    }

    public function test_claim_is_idempotent(): void
    {
        $reminder = Reminder::query()->create([
            'company_id' => 10,
            'entity_type' => 'meeting',
            'entity_id' => 1,
            'remind_at' => now()->subMinute(),
            'status' => Reminder::STATUS_PENDING,
            'channel' => 'email',
            'recipient_type' => 'email',
            'recipient_email' => 'a@b.com',
        ]);

        $this->assertTrue($reminder->claimForSending());
        $fresh = Reminder::query()->find($reminder->id);
        $this->assertFalse($fresh->claimForSending());
        $this->assertSame(Reminder::STATUS_SENDING, $fresh->fresh()->status);
    }

    public function test_allowlist_helper(): void
    {
        Config::set('reminders.entity_reminders_company_allowlist', '10,20');
        $this->assertTrue(ReminderFeature::companyInAllowlist(10));
        $this->assertFalse(ReminderFeature::companyInAllowlist(99));

        Config::set('reminders.entity_reminders_company_allowlist', '*');
        $this->assertTrue(ReminderFeature::companyInAllowlist(99));
    }
}
