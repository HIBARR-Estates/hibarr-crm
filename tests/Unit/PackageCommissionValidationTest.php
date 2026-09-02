<?php

namespace Tests\Unit;

use App\Http\Controllers\PackageSettingsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use ReflectionMethod;
use Tests\TestCase;

/**
 * `PackageSettingsController::commissionValueRules()` decides whether a rate
 * is required, purely from the request's commission_type — no DB, no
 * company() context, so this is tested directly rather than through the full
 * HTTP/permission stack.
 *
 * The case this guards: combining Laravel's `sometimes` with `required_if` is
 * a real trap — `sometimes` skips ALL validation, `required_if` included,
 * whenever the field is absent from the request. The package `update()` rule
 * set briefly had this bug: `commission_type => percentage` with no
 * `commission_value` at all was silently accepted.
 */
class PackageCommissionValidationTest extends TestCase
{
    /**
     * @return array<int, string>
     */
    private function commissionValueRules(array $input): array
    {
        $request = Request::create('/x', 'PUT', $input);
        $controller = app(PackageSettingsController::class);

        $method = new ReflectionMethod(PackageSettingsController::class, 'commissionValueRules');
        $method->setAccessible(true);

        return $method->invoke($controller, $request);
    }

    public function test_percentage_without_a_value_fails(): void
    {
        $input = ['commission_type' => 'percentage'];
        $validator = Validator::make($input, [
            'commission_type' => 'nullable|string',
            'commission_value' => $this->commissionValueRules($input),
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('commission_value', $validator->errors()->toArray());
    }

    public function test_fixed_without_a_value_fails(): void
    {
        $input = ['commission_type' => 'fixed'];
        $validator = Validator::make($input, [
            'commission_type' => 'nullable|string',
            'commission_value' => $this->commissionValueRules($input),
        ]);

        $this->assertTrue($validator->fails());
    }

    public function test_none_without_a_value_passes(): void
    {
        $input = ['commission_type' => 'none'];
        $validator = Validator::make($input, [
            'commission_type' => 'nullable|string',
            'commission_value' => $this->commissionValueRules($input),
        ]);

        $this->assertFalse($validator->fails());
    }

    public function test_unset_type_without_a_value_passes(): void
    {
        $input = [];
        $validator = Validator::make($input, [
            'commission_type' => 'nullable|string',
            'commission_value' => $this->commissionValueRules($input),
        ]);

        $this->assertFalse($validator->fails());
    }

    public function test_percentage_above_100_fails(): void
    {
        $input = ['commission_type' => 'percentage', 'commission_value' => 150];
        $validator = Validator::make($input, [
            'commission_type' => 'nullable|string',
            'commission_value' => $this->commissionValueRules($input),
        ]);

        $this->assertTrue($validator->fails());
    }

    public function test_fixed_above_100_passes(): void
    {
        // Only percentage is bounded at 100 — a flat fee is money.
        $input = ['commission_type' => 'fixed', 'commission_value' => 250];
        $validator = Validator::make($input, [
            'commission_type' => 'nullable|string',
            'commission_value' => $this->commissionValueRules($input),
        ]);

        $this->assertFalse($validator->fails());
    }

    public function test_negative_value_fails_for_every_type(): void
    {
        foreach (['percentage', 'fixed'] as $type) {
            $input = ['commission_type' => $type, 'commission_value' => -1];
            $validator = Validator::make($input, [
                'commission_type' => 'nullable|string',
                'commission_value' => $this->commissionValueRules($input),
            ]);

            $this->assertTrue($validator->fails(), "Expected {$type} with a negative value to fail.");
        }
    }
}
