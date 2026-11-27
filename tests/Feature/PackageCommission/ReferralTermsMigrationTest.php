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
        DB::table('agent_commission_rate_audit_logs')->insert(['previous_referral_pool_rate' => 10, 'new_referral_pool_rate' => 20]);
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

        // History is not rewritten: the old pool-rate audit values stay where they were.
        $this->assertTrue(Schema::hasColumn('agent_commission_rate_audit_logs', 'new_referral_pool_rate'));
        $audit = DB::table('agent_commission_rate_audit_logs')->first();
        $this->assertSame([10.0, 20.0], [(float) $audit->previous_referral_pool_rate, (float) $audit->new_referral_pool_rate]);

        $deals = DB::table('deals')->orderBy('id')->get(['referral_commission_type', 'referral_commission_value'])
            ->map(fn ($d) => [$d->referral_commission_type, $d->referral_commission_value === null ? null : (float) $d->referral_commission_value])->all();
        $this->assertSame([['fixed', 40.0], ['none', null], ['none', null], [null, null], [null, null]], $deals);

        // A referral-only row is now possible: the closer columns are optional.
        DB::table('agent_package_commission_rates')->insert(['company_id' => 1, 'agent_id' => 2, 'package_id' => 1, 'referral_commission_type' => 'percentage', 'referral_commission_value' => 1]);
        $this->assertSame(2, DB::table('agent_package_commission_rates')->count());
        $this->assertSame('fixed', DB::table('agent_package_commission_rates')->where('agent_id', 1)->value('commission_type'), 'Existing closer overrides are untouched.');

        // Deals given referral terms of their own since: a flat fee and "not paid".
        DB::table('deals')->where('id', 5)->update(['referral_commission_type' => 'percentage', 'referral_commission_value' => 3]);

        $migration->down();

        // What had an equivalent comes back; a percentage of the deal has none.
        $restored = DB::table('deals')->orderBy('id')->get(['referral_pool_rate', 'referral_fixed_amount'])
            ->map(fn ($d) => [
                $d->referral_pool_rate === null ? null : (float) $d->referral_pool_rate,
                $d->referral_fixed_amount === null ? null : (float) $d->referral_fixed_amount,
            ])->all();
        $this->assertSame([[null, 40.0], [0.0, null], [0.0, null], [null, null], [null, null]], $restored);

        // The referral-only row cannot exist in the old schema; the closer row stays,
        // and the closer type is required again.
        $this->assertSame(1, DB::table('agent_package_commission_rates')->count());
        $this->assertSame('fixed', DB::table('agent_package_commission_rates')->value('commission_type'));
        try {
            DB::table('agent_package_commission_rates')->insert(['company_id' => 1, 'agent_id' => 3, 'package_id' => 1, 'commission_type' => null]);
            $this->fail('commission_type should be required again after the rollback.');
        } catch (\Illuminate\Database\QueryException) {
            $this->addToAssertionCount(1);
        }

        $this->assertTrue(Schema::hasColumn('deals', 'referral_pool_rate'));
        $this->assertFalse(Schema::hasColumn('deals', 'referral_commission_type'));
        $this->assertFalse(Schema::hasColumn('agent_package_commission_rates', 'referral_commission_type'));
    }
}
