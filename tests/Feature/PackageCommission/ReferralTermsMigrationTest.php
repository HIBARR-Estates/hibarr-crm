<?php

namespace Tests\Feature\PackageCommission;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The migration that turns the pool-percentage referral columns into per-package,
 * per-partner and per-deal terms: what carries over, what is dropped, and that it
 * reverses. Runs against the schema as it was before the migration.
 */
class ReferralTermsMigrationTest extends TestCase
{
    public function test_it_carries_over_what_has_an_equivalent_and_reverses(): void
    {
        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::create('agent_package_commission_rates', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('company_id');
            $t->unsignedBigInteger('agent_id');
            $t->unsignedBigInteger('package_id');
            $t->string('commission_type', 12);
            $t->decimal('commission_value', 15, 2)->nullable();
            $t->timestamps();
        });
        Schema::create('lead_agents', function (Blueprint $t) {
            $t->id();
            $t->decimal('custom_override_rate', 5, 2)->nullable();
            $t->decimal('referral_pool_rate', 5, 2)->nullable();
        });
        Schema::create('deals', function (Blueprint $t) {
            $t->id();
            $t->decimal('referral_pool_rate', 5, 2)->nullable();
            $t->decimal('referral_fixed_amount', 15, 2)->nullable();
        });
        Schema::create('agent_commission_rate_audit_logs', function (Blueprint $t) {
            $t->id();
            $t->decimal('new_override_rate', 5, 2)->nullable();
            $t->decimal('previous_referral_pool_rate', 5, 2)->nullable();
            $t->decimal('new_referral_pool_rate', 5, 2)->nullable();
        });

        DB::table('agent_package_commission_rates')->insert(['company_id' => 1, 'agent_id' => 1, 'package_id' => 1, 'commission_type' => 'fixed', 'commission_value' => 50]);
        DB::table('deals')->insert([
            ['referral_pool_rate' => null, 'referral_fixed_amount' => 40],   // agreed amount
            ['referral_pool_rate' => 0, 'referral_fixed_amount' => null],    // not paid
            ['referral_pool_rate' => 0, 'referral_fixed_amount' => 0],       // agreed zero
            ['referral_pool_rate' => 25, 'referral_fixed_amount' => null],   // pool percentage: no equivalent
            ['referral_pool_rate' => null, 'referral_fixed_amount' => null],
        ]);

        $migration = require base_path('database/migrations/2026_11_24_000001_referral_terms_per_package_and_partner.php');
        $migration->up();

        $this->assertFalse(Schema::hasColumn('deals', 'referral_pool_rate'));
        $this->assertFalse(Schema::hasColumn('deals', 'referral_fixed_amount'));
        $this->assertFalse(Schema::hasColumn('lead_agents', 'referral_pool_rate'));
        $this->assertTrue(Schema::hasColumn('lead_agents', 'referral_commission_type'));
        $this->assertTrue(Schema::hasColumn('agent_package_commission_rates', 'referral_commission_value'));
        $this->assertTrue(Schema::hasColumn('agent_commission_rate_audit_logs', 'new_referral_commission_type'));

        $deals = DB::table('deals')->orderBy('id')->get(['referral_commission_type', 'referral_commission_value'])
            ->map(fn ($d) => [$d->referral_commission_type, $d->referral_commission_value === null ? null : (float) $d->referral_commission_value])->all();
        $this->assertSame([['fixed', 40.0], ['none', null], ['none', null], [null, null], [null, null]], $deals);

        // A referral-only row is now possible: the closer columns are optional.
        DB::table('agent_package_commission_rates')->insert(['company_id' => 1, 'agent_id' => 2, 'package_id' => 1, 'referral_commission_type' => 'percentage', 'referral_commission_value' => 1]);
        $this->assertSame(2, DB::table('agent_package_commission_rates')->count());
        $this->assertSame('fixed', DB::table('agent_package_commission_rates')->where('agent_id', 1)->value('commission_type'), 'Existing closer overrides are untouched.');

        $migration->down();

        $this->assertTrue(Schema::hasColumn('deals', 'referral_pool_rate'));
        $this->assertFalse(Schema::hasColumn('deals', 'referral_commission_type'));
        $this->assertFalse(Schema::hasColumn('agent_package_commission_rates', 'referral_commission_type'));
    }
}
