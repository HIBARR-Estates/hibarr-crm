<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Services\FormDataService;
use App\Support\ExpiringCacheRegistry;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The UTM option lists behind the lead filter: they cover later touches as
 * well as the first one, and Settings → Cache refresh can rebuild them early.
 */
class LeadUtmFilterOptionsTest extends TestCase
{
    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (['lead_utm_touches', 'lead_marketing', 'leads'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->softDeletes();
        });

        foreach (['lead_marketing', 'lead_utm_touches'] as $name) {
            Schema::create($name, function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('lead_id');
                $table->string('utm_source')->nullable();
            });
        }

        $company = new Company();
        $company->id = self::COMPANY_ID;
        session(['company' => $company]);
    }

    public function test_options_count_each_lead_once_across_first_and_later_touches(): void
    {
        // Lead 1: google first, facebook later. Lead 2: google only, with a
        // matching history row. Lead 3 belongs to another company.
        DB::table('leads')->insert([
            ['id' => 1, 'company_id' => self::COMPANY_ID],
            ['id' => 2, 'company_id' => self::COMPANY_ID],
            ['id' => 3, 'company_id' => 99],
        ]);
        DB::table('lead_marketing')->insert([
            ['lead_id' => 1, 'utm_source' => 'google'],
            ['lead_id' => 2, 'utm_source' => 'google'],
            ['lead_id' => 3, 'utm_source' => 'other-company'],
        ]);
        DB::table('lead_utm_touches')->insert([
            ['lead_id' => 1, 'utm_source' => 'google'],
            ['lead_id' => 1, 'utm_source' => 'facebook'],
            ['lead_id' => 2, 'utm_source' => 'google'],
            ['lead_id' => 2, 'utm_source' => null],
        ]);

        $this->assertSame(
            [
                ['value' => 'google', 'label' => 'google', 'count' => 2],
                ['value' => 'facebook', 'label' => 'facebook', 'count' => 1],
            ],
            $this->utmSources(),
        );
    }

    public function test_cache_refresh_rebuilds_the_option_list(): void
    {
        DB::table('leads')->insert(['id' => 1, 'company_id' => self::COMPANY_ID]);
        DB::table('lead_marketing')->insert(['lead_id' => 1, 'utm_source' => 'google']);

        $this->assertSame(['google'], array_column($this->utmSources(), 'value'));

        DB::table('lead_utm_touches')->insert(['lead_id' => 1, 'utm_source' => 'facebook']);

        // Still the cached list until it is refreshed.
        $this->assertSame(['google'], array_column($this->utmSources(), 'value'));

        $cleared = ExpiringCacheRegistry::clear(self::COMPANY_ID, [ExpiringCacheRegistry::LEAD_UTM_VALUES]);

        $this->assertSame([ExpiringCacheRegistry::LEAD_UTM_VALUES], $cleared);
        $values = array_column($this->utmSources(), 'value');
        sort($values);
        $this->assertSame(['facebook', 'google'], $values);
    }

    public function test_clearing_one_group_leaves_other_cache_entries_alone(): void
    {
        Cache::put('translations_en', ['a' => 'b'], 60);
        Cache::put('deal_creation_lock_1', true, 60);

        ExpiringCacheRegistry::clear(self::COMPANY_ID, [ExpiringCacheRegistry::LEAD_UTM_VALUES]);
        $this->assertTrue(Cache::has('translations_en'));

        ExpiringCacheRegistry::clear(self::COMPANY_ID);
        $this->assertFalse(Cache::has('translations_en'));
        $this->assertTrue(Cache::has('deal_creation_lock_1'));
    }

    private function utmSources(): array
    {
        return app(FormDataService::class)->getData('lead-utm-sources', new Request())->all();
    }
}
