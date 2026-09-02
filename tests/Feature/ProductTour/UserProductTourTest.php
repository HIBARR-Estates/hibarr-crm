<?php

namespace Tests\Feature\ProductTour;

use App\Models\User;
use App\Models\UserProductTour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Covers UserProductTour model logic directly. The `product-tours.seen`
 * endpoint sits behind AccountBaseController, which has no existing HTTP-test
 * harness in this suite (no factory bootstraps the company/theme/locale state
 * its common() hook touches) — that's a pre-existing gap, not something new
 * here, so this test targets the model logic through the same public API the
 * controller calls, plus a route-registration/middleware check.
 */
class UserProductTourTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_seen_creates_a_row_for_user_and_tour(): void
    {
        $user = User::factory()->create();

        UserProductTour::markSeen($user->id, 'deal-redesign-v1');

        $this->assertDatabaseHas('user_product_tours', [
            'user_id' => $user->id,
            'tour_id' => 'deal-redesign-v1',
        ]);
    }

    public function test_has_seen_returns_false_before_mark_seen(): void
    {
        $user = User::factory()->create();

        $this->assertFalse(UserProductTour::hasSeen($user->id, 'deal-redesign-v1'));
    }

    public function test_has_seen_returns_true_after_mark_seen(): void
    {
        $user = User::factory()->create();

        UserProductTour::markSeen($user->id, 'deal-redesign-v1');

        $this->assertTrue(UserProductTour::hasSeen($user->id, 'deal-redesign-v1'));
    }

    public function test_mark_seen_is_idempotent_when_called_twice_for_same_user_and_tour(): void
    {
        $user = User::factory()->create();

        UserProductTour::markSeen($user->id, 'deal-redesign-v1');
        UserProductTour::markSeen($user->id, 'deal-redesign-v1');

        $this->assertSame(
            1,
            UserProductTour::where('user_id', $user->id)
                ->where('tour_id', 'deal-redesign-v1')
                ->count()
        );
    }

    public function test_cache_is_invalidated_after_mark_seen_so_subsequent_reads_reflect_the_write(): void
    {
        $user = User::factory()->create();

        // Warm the cache with "not seen" before the write.
        $this->assertFalse(UserProductTour::hasSeen($user->id, 'deal-redesign-v1'));

        UserProductTour::markSeen($user->id, 'deal-redesign-v1');

        $this->assertTrue(UserProductTour::hasSeen($user->id, 'deal-redesign-v1'));
    }

    public function test_marking_seen_never_affects_another_users_seen_tour_ids(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        UserProductTour::markSeen($userA->id, 'deal-redesign-v1');

        $this->assertTrue(UserProductTour::hasSeen($userA->id, 'deal-redesign-v1'));
        $this->assertFalse(UserProductTour::hasSeen($userB->id, 'deal-redesign-v1'));
    }

    public function test_marking_one_tour_seen_does_not_mark_a_different_tour(): void
    {
        $user = User::factory()->create();

        UserProductTour::markSeen($user->id, 'leads-list-v1');
        UserProductTour::markSeen($user->id, 'deals-list-v1');
        UserProductTour::markSeen($user->id, 'preferences-v1');

        $this->assertTrue(UserProductTour::hasSeen($user->id, 'leads-list-v1'));
        $this->assertTrue(UserProductTour::hasSeen($user->id, 'deals-list-v1'));
        $this->assertTrue(UserProductTour::hasSeen($user->id, 'preferences-v1'));
        $this->assertFalse(UserProductTour::hasSeen($user->id, 'lead-redesign-v1'));
        $this->assertFalse(UserProductTour::hasSeen($user->id, 'deal-redesign-v1'));
        $this->assertFalse(UserProductTour::hasSeen($user->id, 'reminder-preferences-v1'));
        $this->assertFalse(UserProductTour::hasSeen($user->id, 'tasks-list-v1'));
    }

    public function test_product_tours_seen_route_is_registered_and_requires_auth(): void
    {
        $this->assertTrue(Route::has('product-tours.seen'));

        $response = $this->postJson('/account/product-tours/deal-redesign-v1/seen');

        $response->assertStatus(401);
    }
}
