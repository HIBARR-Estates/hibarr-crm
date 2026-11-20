<?php

namespace Tests\Feature;

use App\Support\CallRefOwnership;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Cross-tenant call-ref ownership, and the 90-day expiry migration's policy
 * selection and re-run safety.
 */
class CallRecordingOlSyncTest extends TestCase
{
    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (['crm_events', 'crm_event_types', 'call_recordings'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('call_recordings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('filename')->default('call.mp3');
            $table->string('call_ref')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('ol_synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id')->default(1);
            $table->string('name');
            $table->string('slug');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('event_type_id');
            $table->text('metadata')->nullable();
            $table->timestamps();
        });
    }

    // ─── Call-ref ownership ─────────────────────────────────────────────

    public function test_a_ref_nobody_uses_is_free(): void
    {
        $this->assertFalse(CallRefOwnership::belongsToAnotherCompany('ref-new', self::COMPANY_ID));
    }

    public function test_a_ref_only_this_company_uses_is_free(): void
    {
        $this->recording(self::COMPANY_ID, 'ref-mine');

        $this->assertFalse(CallRefOwnership::belongsToAnotherCompany('ref-mine', self::COMPANY_ID));
    }

    public function test_a_ref_another_companys_recording_uses_is_refused(): void
    {
        $this->recording(self::OTHER_COMPANY_ID, 'ref-theirs');

        $this->assertTrue(CallRefOwnership::belongsToAnotherCompany('ref-theirs', self::COMPANY_ID));
    }

    public function test_a_ref_shared_with_another_company_is_refused_even_if_this_one_uses_it(): void
    {
        $this->recording(self::COMPANY_ID, 'ref-shared');
        $this->recording(self::OTHER_COMPANY_ID, 'ref-shared');

        $this->assertTrue(CallRefOwnership::belongsToAnotherCompany('ref-shared', self::COMPANY_ID));
    }

    public function test_a_ref_on_another_companys_call_timeline_is_refused(): void
    {
        $typeId = DB::table('crm_event_types')->insertGetId([
            'name' => 'Call ended', 'slug' => 'call_ended',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('crm_events')->insert([
            'company_id' => self::OTHER_COMPANY_ID,
            'event_type_id' => $typeId,
            'metadata' => json_encode(['call_ref' => 'ref-timeline']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertTrue(CallRefOwnership::belongsToAnotherCompany('ref-timeline', self::COMPANY_ID));
    }

    // ─── 90-day expiry migration ────────────────────────────────────────

    public function test_migration_moves_only_30_day_rows_and_is_safe_to_rerun(): void
    {
        $uploaded = now()->subDays(10)->startOfSecond();
        $old = $this->recording(self::COMPANY_ID, null, $uploaded, $uploaded->copy()->addDays(30));
        // Uploaded under the new code before the migration ran.
        $new = $this->recording(self::COMPANY_ID, null, $uploaded, $uploaded->copy()->addDays(90));

        $migration = require database_path('migrations/2026_11_17_000001_extend_call_recording_expiry_to_90_days.php');

        $migration->up();
        $migration->up();

        $this->assertExpiry($old, $uploaded->copy()->addDays(90));
        $this->assertExpiry($new, $uploaded->copy()->addDays(90));

        $migration->down();
        $migration->down();

        $this->assertExpiry($old, $uploaded->copy()->addDays(30));
        $this->assertExpiry($new, $uploaded->copy()->addDays(30));
    }

    private function recording(int $companyId, ?string $callRef, $createdAt = null, $expiresAt = null): int
    {
        return (int) DB::table('call_recordings')->insertGetId([
            'company_id' => $companyId,
            'call_ref' => $callRef,
            'created_at' => $createdAt ?? now(),
            'updated_at' => $createdAt ?? now(),
            'expires_at' => $expiresAt ?? now()->addDays(90),
        ]);
    }

    private function assertExpiry(int $id, $expected): void
    {
        $actual = \Carbon\Carbon::parse(DB::table('call_recordings')->where('id', $id)->value('expires_at'));
        $this->assertSame($expected->toDateTimeString(), $actual->toDateTimeString());
    }
}
