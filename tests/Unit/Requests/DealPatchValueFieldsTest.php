<?php

namespace Tests\Unit\Requests;

use App\Http\Requests\Deal\PatchRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * The deal value modal submits every value field together, including nulls for
 * the ones left unset. Validation has to accept that shape.
 *
 * A missing `nullable` on currency_id made the whole request 422 whenever the
 * deal used the company's own currency (currency_id null, which is most deals),
 * so a saved discount or deduction was silently discarded along with it — the
 * failure looked like "editing the discount does nothing", nowhere near the
 * rule that caused it.
 */
class DealPatchValueFieldsTest extends TestCase
{
    private function validate(array $payload): \Illuminate\Contracts\Validation\Validator
    {
        return Validator::make($payload, (new PatchRequest)->rules());
    }

    public function test_adjustments_save_on_a_deal_in_the_company_currency(): void
    {
        $validator = $this->validate([
            'value_source' => 'calculated',
            'manual_value' => 0,
            'currency_id' => null,
            'exchange_rate' => null,
            'discount_type' => 'percent',
            'discount_value' => 10,
            'deduction_amount' => 100,
            'deduction_note' => 'Referral rebate',
        ]);

        $this->assertFalse(
            $validator->fails(),
            'Payload rejected: '.json_encode($validator->errors()->toArray()),
        );
        $this->assertSame(10.0, (float) $validator->validated()['discount_value']);
        $this->assertSame(100.0, (float) $validator->validated()['deduction_amount']);
    }

    public function test_clearing_every_adjustment_is_accepted(): void
    {
        $validator = $this->validate([
            'discount_type' => null,
            'discount_value' => null,
            'deduction_amount' => null,
            'deduction_note' => null,
            'exchange_rate' => null,
            'currency_id' => null,
        ]);

        $this->assertFalse(
            $validator->fails(),
            'Payload rejected: '.json_encode($validator->errors()->toArray()),
        );
    }

    public function test_a_nonsense_discount_type_is_still_rejected(): void
    {
        $this->assertTrue($this->validate(['discount_type' => 'sometimes'])->fails());
    }

    public function test_a_zero_or_negative_exchange_rate_is_rejected(): void
    {
        $this->assertTrue($this->validate(['exchange_rate' => 0])->fails());
        $this->assertTrue($this->validate(['exchange_rate' => -1])->fails());
    }
}
