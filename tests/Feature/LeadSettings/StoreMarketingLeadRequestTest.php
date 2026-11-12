<?php

namespace Tests\Feature\LeadSettings;

use App\Http\Requests\Lead\StoreMarketingLeadRequest;
use App\Services\OlUtmConfigService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Validation of the marketing lead flow's save payload: website
 * normalisation, the lead owner check, and the first-touch UTM fields,
 * which must be options OL lists.
 */
class StoreMarketingLeadRequestTest extends TestCase
{
    private int $companyId = 1;

    private const TABLES = ['language_settings', 'lead_agents', 'leads', 'users', 'companies'];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('users')->insert([
            ['id' => 5, 'company_id' => $this->companyId, 'name' => 'Agent', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 6, 'company_id' => $this->companyId, 'name' => 'Disabled agent', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 7, 'company_id' => $this->companyId, 'name' => 'Not an agent', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('lead_agents')->insert([
            ['company_id' => $this->companyId, 'user_id' => 5, 'status' => 'enabled', 'created_at' => now(), 'updated_at' => now()],
            ['company_id' => $this->companyId, 'user_id' => 6, 'status' => 'disabled', 'created_at' => now(), 'updated_at' => now()],
        ]);

        session(['company' => (object) ['id' => $this->companyId]]);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_a_bare_domain_is_saved_with_https(): void
    {
        [$request, $errors] = $this->validate(['website' => 'example.com']);

        $this->assertSame('https://example.com', $request->input('website'));
        $this->assertFalse($errors->has('website'));
    }

    public function test_an_existing_scheme_and_a_port_are_kept(): void
    {
        [$request, $errors] = $this->validate(['website' => 'http://example.com:8080/path']);

        $this->assertSame('http://example.com:8080/path', $request->input('website'));
        $this->assertFalse($errors->has('website'));
    }

    public function test_a_punycode_domain_is_accepted(): void
    {
        [$request, $errors] = $this->validate(['website' => 'example.xn--p1ai']);

        $this->assertSame('https://example.xn--p1ai', $request->input('website'));
        $this->assertFalse($errors->has('website'));
    }

    public function test_a_non_string_website_is_a_validation_error(): void
    {
        [, $errors] = $this->validate(['website' => ['example.com']]);

        $this->assertTrue($errors->has('website'));
    }

    public function test_an_empty_website_becomes_null(): void
    {
        [$request, $errors] = $this->validate(['website' => '   ']);

        $this->assertNull($request->input('website'));
        $this->assertFalse($errors->has('website'));
    }

    public function test_an_invalid_website_is_rejected(): void
    {
        foreach (['not a website', 'example', 'ftp://example.com', 'https://exa mple.com'] as $website) {
            [, $errors] = $this->validate(['website' => $website]);

            $this->assertTrue($errors->has('website'), "Expected \"{$website}\" to be rejected.");
        }
    }

    public function test_the_owner_must_be_an_enabled_lead_agent(): void
    {
        [, $errors] = $this->validate(['lead_owner' => 5]);
        $this->assertFalse($errors->has('lead_owner'));

        [, $errors] = $this->validate(['lead_owner' => null]);
        $this->assertFalse($errors->has('lead_owner'));

        foreach ([6, 7, 999] as $userId) {
            [, $errors] = $this->validate(['lead_owner' => $userId]);
            $this->assertTrue($errors->has('lead_owner'), "Expected user {$userId} to be rejected as owner.");
        }
    }

    public function test_an_inactive_user_cannot_own_the_lead(): void
    {
        DB::table('users')->where('id', 5)->update(['status' => 'deactive']);

        [, $errors] = $this->validate(['lead_owner' => 5]);

        $this->assertTrue($errors->has('lead_owner'));
    }

    public function test_utm_values_must_be_options_listed_on_ol(): void
    {
        $this->fakeOl([
            'source' => [[['value' => 'google'], ['value' => 'newsletter']], [['value' => 'facebook']]],
            'medium' => [[['value' => 'paid']]],
        ]);

        // "facebook" is on the second page, so the check walks the pages.
        [, $errors] = $this->validate(['utm' => ['utm_source' => 'facebook', 'utm_medium' => 'paid']]);
        $this->assertSame([], $errors->toArray());

        [, $errors] = $this->validate(['utm' => ['utm_source' => 'tiktok', 'utm_medium' => '']]);
        $this->assertTrue($errors->has('utm.utm_source'));
        $this->assertFalse($errors->has('utm.utm_medium'));

        [, $errors] = $this->validate(['utm' => ['utm_campaign' => str_repeat('c', 256)]]);
        $this->assertTrue($errors->has('utm.utm_campaign'));

        [, $errors] = $this->validate(['utm' => 'facebook']);
        $this->assertTrue($errors->has('utm'));
    }

    public function test_a_utm_value_cannot_be_saved_while_ol_is_unreachable(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Http::fake(['ol.test/*' => Http::response(['message' => 'down'], 503)]);

        [, $errors] = $this->validate(['utm' => ['utm_source' => 'google']]);
        $this->assertTrue($errors->has('utm.utm_source'));

        // Leads without UTM values don't depend on OL.
        [, $errors] = $this->validate([]);
        $this->assertSame([], $errors->toArray());
    }

    public function test_the_picker_pages_through_ol_with_the_api_key(): void
    {
        $this->fakeOl(['source' => [
            [['value' => 'google', 'label' => 'Google', 'leadSourceId' => 3]],
            [['value' => 'newsletter', 'label' => null, 'leadSourceId' => null]],
        ]]);

        $first = app(OlUtmConfigService::class)->page('source', 1, 50, ' goo ');
        $this->assertSame([['value' => 'google', 'label' => 'Google', 'leadSourceId' => 3]], $first['items']);
        $this->assertSame(2, $first['nextPage']);

        $second = app(OlUtmConfigService::class)->page('source', 2);
        $this->assertSame([['value' => 'newsletter', 'label' => 'newsletter', 'leadSourceId' => null]], $second['items']);
        $this->assertNull($second['nextPage']);

        Http::assertSent(fn ($request) => $request->hasHeader('x-api-key', 'secret')
            && str_starts_with($request->url(), 'https://ol.test/v1/internal/utm-configs?')
            && $request['type'] === 'source'
            && (int) $request['page'] === 1
            && $request['search'] === 'goo');
    }

    /**
     * Fakes OL's utm-configs endpoint: type => list of pages, each a list of rows.
     *
     * @param  array<string, array<int, array<int, array<string, mixed>>>>  $pagesByType
     */
    private function fakeOl(array $pagesByType): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'secret');

        Http::fake(function ($request) use ($pagesByType) {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
            $pages = $pagesByType[$query['type'] ?? ''] ?? [[]];
            $page = max(1, (int) ($query['page'] ?? 1));

            return Http::response([
                'success' => true,
                'data' => [
                    'result' => $pages[$page - 1] ?? [],
                    'totalCount' => array_sum(array_map('count', $pages)),
                    'currentPage' => $page,
                    'totalPages' => count($pages),
                    'previousPage' => $page > 1 ? $page - 1 : null,
                    'nextPage' => $page < count($pages) ? $page + 1 : null,
                ],
            ]);
        });
    }

    /**
     * Runs the request's own preparation and rules, the way Laravel does
     * before the controller sees it.
     *
     * @return array{0: StoreMarketingLeadRequest, 1: \Illuminate\Support\MessageBag}
     */
    private function validate(array $overrides): array
    {
        $request = StoreMarketingLeadRequest::create('/account/marketing-leads', 'POST', array_merge([
            'client_name' => 'Jane Doe',
        ], $overrides));
        $request->setContainer($this->app);
        // The parent rules read the global request (create_deal, custom fields).
        $this->app->instance('request', $request);

        $prepare = new ReflectionMethod($request, 'prepareForValidation');
        $prepare->setAccessible(true);
        $prepare->invoke($request);

        $validator = Validator::make($request->all(), $request->rules(), $request->messages(), $request->attributes());
        $request->withValidator($validator);
        $validator->passes();

        return [$request, $validator->errors()];
    }

    private function resetSchema(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_email')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('language_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('language_code')->nullable();
            $table->string('language_name')->nullable();
            $table->string('status')->default('enabled');
            $table->timestamps();
        });
    }
}
