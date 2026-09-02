<?php

namespace Tests\Feature\Deals;

use App\Models\Deal;
use App\Models\User;
use App\Services\DealGatheringService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class DealNameInlineUpdateTest extends TestCase
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
        $this->seedCompany();
        Deal::unsetEventDispatcher();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_inline_update_renames_deal(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $dealId = $this->insertDeal(['name' => 'Original Deal']);

        $service = Mockery::mock(DealGatheringService::class);
        $service->shouldReceive('updateDealInline')
            ->once()
            ->andReturnUsing(function (Deal $deal, $type, array $data) {
                $deal->update(['name' => $data['name']]);

                return $deal;
            });
        $this->app->instance(DealGatheringService::class, $service);

        $response = $this->patchJson(
            '/account/deals/gathering/inline-update/'.$dealId,
            [
                'type' => 'details',
                'data' => ['name' => 'Renamed Deal'],
            ],
            ['X-Analysis-Lean' => '1']
        );

        $response->assertOk()->assertJsonPath('status', 'success');
        $this->assertSame('Renamed Deal', Deal::findOrFail($dealId)->name);
    }

    public function test_inline_update_rejects_empty_deal_name(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $dealId = $this->insertDeal(['name' => 'Original Deal']);

        $service = Mockery::mock(DealGatheringService::class);
        $service->shouldReceive('updateDealInline')->never();
        $this->app->instance(DealGatheringService::class, $service);

        $this->patchJson('/account/deals/gathering/inline-update/'.$dealId, [
            'type' => 'details',
            'data' => ['name' => ''],
        ])->assertStatus(422);

        $this->assertSame('Original Deal', Deal::findOrFail($dealId)->name);
    }

    public function test_inline_update_rejects_whitespace_only_deal_name(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $dealId = $this->insertDeal(['name' => 'Original Deal']);

        $service = Mockery::mock(DealGatheringService::class);
        $service->shouldReceive('updateDealInline')->never();
        $this->app->instance(DealGatheringService::class, $service);

        $this->patchJson('/account/deals/gathering/inline-update/'.$dealId, [
            'type' => 'details',
            'data' => ['name' => '   '],
        ])->assertStatus(422);

        $this->assertSame('Original Deal', Deal::findOrFail($dealId)->name);
    }

    private function actingAsEditor(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;
        $user->shouldReceive('permission')->andReturn('all');
        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => $this->companyId]]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('deals');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function seedCompany(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertDeal(array $attributes): int
    {
        return (int) DB::table('deals')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'name' => 'Test Deal',
            'is_locked' => false,
            'added_by' => 99,
            'last_updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
