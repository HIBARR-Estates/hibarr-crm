<?php

namespace Tests\Unit\Support;

use App\Models\User;
use App\Services\FeatureFlagService;
use App\Support\Access;
use App\Support\FeatureFlags;
use App\Support\PermissionGates;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class AccessTest extends TestCase
{
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        app(FeatureFlagService::class)->setTestingOverrides([]);
    }

    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    public function test_permission_all_matches_permission_gates_allows(): void
    {
        $granted = $this->userWithPermission('manage_properties', 'all');
        $denied = $this->userWithPermission('manage_properties', 'none');
        $owned = $this->userWithPermission('manage_properties', 'owned');

        $this->assertTrue(Access::permission($granted, 'manage_properties', 'all'));
        $this->assertTrue(PermissionGates::allows($granted, 'manage_properties'));
        $this->assertSame(
            PermissionGates::allows($granted, 'manage_properties'),
            Access::permission($granted, 'manage_properties', 'all')
        );

        $this->assertFalse(Access::permission($denied, 'manage_properties', 'all'));
        $this->assertSame(
            PermissionGates::allows($denied, 'manage_properties'),
            Access::permission($denied, 'manage_properties', 'all')
        );

        $this->assertFalse(Access::permission($owned, 'manage_properties', 'all'));
        $this->assertSame(
            PermissionGates::allows($owned, 'manage_properties'),
            Access::permission($owned, 'manage_properties', 'all')
        );
    }

    public function test_flag_matches_feature_flags_enabled(): void
    {
        $this->setFeatureFlag('crm.lead-merge', true);
        $this->setFeatureFlag('crm.deal-view-redesign', false);

        $this->assertTrue(Access::flag('crm.lead-merge'));
        $this->assertSame(
            FeatureFlags::enabled('crm.lead-merge'),
            Access::flag('crm.lead-merge')
        );

        $this->assertFalse(Access::flag('crm.deal-view-redesign'));
        $this->assertSame(
            FeatureFlags::enabled('crm.deal-view-redesign'),
            Access::flag('crm.deal-view-redesign')
        );
    }

    public function test_unknown_permission_and_flag_deny_without_throwing(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('permission')->with('not_a_real_permission')->andReturn(false);

        $this->assertFalse(Access::permission($user, 'not_a_real_permission'));
        $this->assertFalse(Access::permission($user, ''));
        $this->assertFalse(Access::flag('not.a.real.flag'));
        $this->assertFalse(Access::flag(''));
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('scopeMatrixProvider')]
    public function test_scope_matrix(mixed $held, string|int|null $required, bool $expected): void
    {
        $user = $this->userWithPermission('edit_deals', $held);

        $this->assertSame($expected, Access::permission($user, 'edit_deals', $required));
    }

    /**
     * @return array<string, array{0: mixed, 1: string|int|null, 2: bool}>
     */
    public static function scopeMatrixProvider(): array
    {
        return [
            'all grants without scope' => ['all', null, true],
            'all grants added' => ['all', 'added', true],
            'all grants owned' => ['all', 'owned', true],
            'all grants both' => ['all', 'both', true],
            'all grants all' => ['all', 'all', true],
            'numeric 4 grants owned' => [4, 'owned', true],

            'both grants without scope' => ['both', null, true],
            'both grants added' => ['both', 'added', true],
            'both grants owned' => ['both', 'owned', true],
            'both grants both' => ['both', 'both', true],
            'both denies all' => ['both', 'all', false],

            'owned grants without scope' => ['owned', null, true],
            'owned grants owned' => ['owned', 'owned', true],
            'owned denies added' => ['owned', 'added', false],
            'owned denies all' => ['owned', 'all', false],

            'added grants without scope' => ['added', null, true],
            'added grants added' => ['added', 'added', true],
            'added denies owned' => ['added', 'owned', false],
            'added denies all' => ['added', 'all', false],

            'none denies without scope' => ['none', null, false],
            'none denies owned' => ['none', 'owned', false],
            'none denies all' => ['none', 'all', false],
            'numeric 5 denies owned' => [5, 'owned', false],

            'missing denies without scope' => [false, null, false],
            'missing denies owned' => [false, 'owned', false],
        ];
    }

    public function test_none_and_missing_never_grant(): void
    {
        $none = $this->userWithPermission('edit_deals', 'none');
        $missing = $this->userWithPermission('edit_deals', false);

        foreach (['owned', 'added', 'both', 'all', null] as $scope) {
            $this->assertFalse(Access::permission($none, 'edit_deals', $scope));
            $this->assertFalse(Access::permission($missing, 'edit_deals', $scope));
        }
    }

    /**
     * @return User&\Mockery\MockInterface
     */
    private function userWithPermission(string $key, mixed $value): User
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('permission')->with($key)->andReturn($value);

        return $user;
    }
}
