<?php

namespace Tests\Unit;

use App\Models\Payment;
use App\Services\DealPaymentUiStateMapper;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Drift guard between DealPaymentUiStateMapper::map() (PHP branches, used by
 * DealPaymentService for a single already-loaded payment) and ::queryScopes()
 * (the SQL-shaped mirror used by PaymentRequestController to filter a list at
 * the database level). Walks the same fixture tuples map()'s own test
 * (DealPaymentRequestTest::test_ui_state_mapper_maps_expected_states) uses,
 * and asserts each one is matched by exactly one queryScopes() bucket.
 */
class DealPaymentUiStateMapperQueryScopesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.default', 'sqlite');
        config()->set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('payments');
        Schema::create('payments', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->double('amount', 30, 2)->nullable();
            $table->string('gateway')->nullable();
            $table->string('external_reference')->nullable();
            $table->string('checkout_url', 2048)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('ol_status', 64)->nullable();
            $table->string('ol_payment_type', 32)->nullable();
            $table->unsignedBigInteger('verified_by_user_id')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->timestamps();
        });

        Payment::flushEventListeners();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('payments');

        parent::tearDown();
    }

    /**
     * @return array<string, array{0: ?string, 1: ?string, 2: ?int, 3: ?string, 4: string}>
     */
    public static function fixtures(): array
    {
        $now = '2026-08-27 09:00:00';

        return [
            'pending' => ['pending', 'manual', null, null, 'pending_payment'],
            'confirming manual' => ['confirming', 'manual', null, null, 'bank_transfer_pending'],
            'confirming crypto' => ['confirming', 'crypto', null, null, 'processing_online'],
            'completed manual verified' => ['completed', 'manual', 1, $now, 'confirmed'],
            'completed crypto' => ['completed', 'crypto', null, null, 'paid_online'],
            'expired' => ['expired', 'manual', null, null, 'failed'],
        ];
    }

    /**
     * @dataProvider fixtures
     */
    public function test_query_scope_matches_the_same_bucket_map_returns(
        ?string $olStatus,
        ?string $olPaymentType,
        ?int $verifiedByUserId,
        ?string $verifiedAt,
        string $expectedUiState,
    ): void {
        $mapped = DealPaymentUiStateMapper::map($olStatus, $olPaymentType, $verifiedByUserId, $verifiedAt);
        $this->assertSame($expectedUiState, $mapped['ui_state']);

        $id = DB::table('payments')->insertGetId([
            'ol_status' => $olStatus,
            'ol_payment_type' => $olPaymentType,
            'verified_by_user_id' => $verifiedByUserId,
            'verified_at' => $verifiedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $scopes = DealPaymentUiStateMapper::queryScopes();

        foreach ($scopes as $uiState => $scope) {
            $query = Payment::query()->where('id', $id);
            $scope($query);
            $matches = $query->exists();

            if ($uiState === $expectedUiState) {
                $this->assertTrue($matches, "Expected queryScopes()['{$uiState}'] to match the {$expectedUiState} fixture.");
            } else {
                $this->assertFalse($matches, "queryScopes()['{$uiState}'] unexpectedly matched the {$expectedUiState} fixture.");
            }
        }
    }
}
