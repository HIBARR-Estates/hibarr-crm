<?php

namespace Tests\Feature\Deals;

use App\Http\Controllers\DealController;
use App\Models\Deal;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

/**
 * DealController::syncDealProducts() must report the *committed* before/after
 * product sets, not a diff computed earlier in the request.
 *
 * DealController::update() reads the deal's products once up front, for the
 * commission lock's pre-flight check, and only syncs them much later — after
 * the scalar save, the package sync and the watcher/participant syncs. Another
 * request can change the deal's products in that window. The activity events
 * and the property link/unlink notifications are driven by what actually
 * changed, so they have to be based on a read taken inside the same locked
 * transaction as the write, not on the stale pre-flight diff.
 *
 * The row lock itself is not asserted here: the suite runs on in-memory SQLite,
 * where lockForUpdate() compiles to a no-op and a second connection cannot see
 * the same database. What is asserted is the behaviour the lock exists to make
 * correct — that the reported diff comes from the committed state — simulated
 * deterministically by mutating the pivot between the pre-flight read and the
 * sync.
 */
class DealProductSyncConcurrencyTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        Deal::unsetEventDispatcher();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_it_reports_the_committed_diff_not_the_preflight_one(): void
    {
        $deal = $this->makeDeal();
        $this->makeProducts([1, 2, 3]);

        // What update() would have read up front, for the commission guard.
        $deal->products()->sync([1]);
        $preflightOldIds = $deal->products()->pluck('products.id')->toArray();
        $this->assertSame([1], $preflightOldIds);

        // A concurrent request links product 3 in the window between that read
        // and our sync.
        $deal->products()->attach(3);

        [$linked, $unlinked] = $this->syncDealProducts($deal, [1, 2]);

        // Against the committed state ([1, 3]) product 2 was linked and product
        // 3 was unlinked. The stale pre-flight state ([1]) would have claimed
        // only that 2 was linked, silently losing the unlink of 3 — so no
        // notifyPropertyUnlinked would ever fire for it.
        $this->assertSame([2], $linked);
        $this->assertSame([3], $unlinked);

        $this->assertSame([1, 2], $deal->products()->pluck('products.id')->sort()->values()->all());
    }

    public function test_a_concurrent_write_that_matches_the_request_reports_no_change(): void
    {
        $deal = $this->makeDeal();
        $this->makeProducts([1, 2]);

        $deal->products()->sync([1]);

        // The other writer already applied exactly what this request asks for.
        $deal->products()->sync([1, 2]);

        [$linked, $unlinked] = $this->syncDealProducts($deal, [1, 2]);

        // Nothing left to announce — the pre-flight diff would have re-reported
        // product 2 as newly linked and fired a duplicate notification.
        $this->assertSame([], $linked);
        $this->assertSame([], $unlinked);

        $this->assertSame([1, 2], $deal->products()->pluck('products.id')->sort()->values()->all());
    }

    public function test_it_clears_every_product_when_given_an_empty_list(): void
    {
        $deal = $this->makeDeal();
        $this->makeProducts([1, 2]);

        $deal->products()->sync([1, 2]);

        [$linked, $unlinked] = $this->syncDealProducts($deal, []);

        $this->assertSame([], $linked);
        $this->assertSame([1, 2], $unlinked);
        $this->assertSame([], $deal->products()->pluck('products.id')->all());
    }

    public function test_it_matches_string_ids_against_stored_integer_ids(): void
    {
        $deal = $this->makeDeal();
        $this->makeProducts([1, 2]);

        $deal->products()->sync([1]);

        // A single-select posts "2"; product 1 is unchanged and must not be
        // reported as unlinked-then-relinked.
        [$linked, $unlinked] = $this->syncDealProducts($deal, ['1', '2']);

        $this->assertSame(['2'], $linked);
        $this->assertSame([], $unlinked);
        $this->assertSame([1, 2], $deal->products()->pluck('products.id')->sort()->values()->all());
    }

    /**
     * @return array{0: array, 1: array}
     */
    private function syncDealProducts(Deal $deal, array $requestedProductIds): array
    {
        $method = new ReflectionMethod(DealController::class, 'syncDealProducts');
        $method->setAccessible(true);

        // newWithoutConstructor: DealController's constructor pulls in the whole
        // AccountBaseController boot chain (settings, permissions, view data),
        // none of which this method touches.
        $controller = (new \ReflectionClass(DealController::class))->newInstanceWithoutConstructor();

        return $method->invoke($controller, $deal, $requestedProductIds);
    }

    private function makeDeal(): Deal
    {
        $id = DB::table('deals')->insertGetId([
            'company_id' => $this->companyId,
            'name' => 'Concurrency Deal',
        ]);

        return Deal::findOrFail($id);
    }

    private function makeProducts(array $ids): void
    {
        foreach ($ids as $id) {
            DB::table('products')->insert([
                'id' => $id,
                'company_id' => $this->companyId,
                'name' => 'Product '.$id,
            ]);
        }
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_products');
        Schema::dropIfExists('products');
        Schema::dropIfExists('deals');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_products', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('product_id');
            $table->timestamps();
        });
    }
}
