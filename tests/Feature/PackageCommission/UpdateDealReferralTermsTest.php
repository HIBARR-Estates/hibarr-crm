<?php

namespace Tests\Feature\PackageCommission;

use App\Actions\Deals\UpdateDealReferralTerms;
use App\Enums\PackageCommissionType;
use App\Models\Deal;
use App\Support\CommissionTerms;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\PackageCommissionTestCase;

/**
 * The write behind PATCH deals/{deal}/referral-commission: what may be saved on
 * a deal's own referral terms, and when. Permission and input validation sit in
 * the controller.
 *
 * The fixture: a 1000 deal under a 10% ceiling, so it can carry 100.
 */
class UpdateDealReferralTermsTest extends PackageCommissionTestCase
{
    private function seedDealToEdit(array $dealColumns = []): int
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId));
        $dealId = $this->seedDeal($companyId, $agentId, 1000);

        if ($dealColumns !== []) {
            DB::table('deals')->where('id', $dealId)->update($dealColumns);
        }

        return $dealId;
    }

    /** @return array{outcome: string, max: float|null} */
    private function update(int $dealId, ?CommissionTerms $terms): array
    {
        // The deal observer reacts to saves in the running app; this is the action alone.
        return Deal::withoutEvents(fn () => app(UpdateDealReferralTerms::class)->handle($dealId, $terms));
    }

    private function terms(string $type, ?float $value = null): CommissionTerms
    {
        return CommissionTerms::make($type, $value);
    }

    private function stored(int $dealId): array
    {
        $row = DB::table('deals')->where('id', $dealId)->first();

        return [$row->referral_commission_type, $row->referral_commission_value === null ? null : (float) $row->referral_commission_value];
    }

    public function test_it_saves_a_percentage_of_the_deal_value(): void
    {
        $dealId = $this->seedDealToEdit();

        $result = $this->update($dealId, $this->terms('percentage', 5));

        $this->assertSame(UpdateDealReferralTerms::UPDATED, $result['outcome']);
        $this->assertSame(['percentage', 5.0], $this->stored($dealId));
    }

    public function test_it_saves_an_agreed_amount(): void
    {
        $dealId = $this->seedDealToEdit();

        $this->update($dealId, $this->terms('fixed', 40));

        $this->assertSame(['fixed', 40.0], $this->stored($dealId));
    }

    public function test_an_amount_equal_to_what_the_deal_can_carry_is_accepted(): void
    {
        $dealId = $this->seedDealToEdit();

        $result = $this->update($dealId, $this->terms('fixed', 100));

        $this->assertSame(UpdateDealReferralTerms::UPDATED, $result['outcome']);
    }

    public function test_an_amount_above_what_the_deal_can_carry_is_refused_and_nothing_is_saved(): void
    {
        $dealId = $this->seedDealToEdit();

        $result = $this->update($dealId, $this->terms('fixed', 100.01));

        $this->assertSame(UpdateDealReferralTerms::EXCEEDS, $result['outcome']);
        $this->assertSame(100.0, $result['max']);
        $this->assertSame([null, null], $this->stored($dealId));
    }

    public function test_a_percentage_is_held_to_the_same_limit_by_what_it_would_pay(): void
    {
        $dealId = $this->seedDealToEdit();

        $result = $this->update($dealId, $this->terms('percentage', 11));

        $this->assertSame(UpdateDealReferralTerms::EXCEEDS, $result['outcome'], '11% of 1000 is 110.');
        $this->assertSame([null, null], $this->stored($dealId));
    }

    public function test_not_paid_is_saved_without_a_value(): void
    {
        $dealId = $this->seedDealToEdit();

        $this->update($dealId, $this->terms(PackageCommissionType::None->value, 25));

        $this->assertSame(['none', null], $this->stored($dealId));
    }

    public function test_no_terms_clears_the_override(): void
    {
        $dealId = $this->seedDealToEdit([
            'referral_commission_type' => 'fixed',
            'referral_commission_value' => 40,
        ]);

        $result = $this->update($dealId, null);

        $this->assertSame(UpdateDealReferralTerms::UPDATED, $result['outcome']);
        $this->assertSame([null, null], $this->stored($dealId));
    }

    public function test_a_locked_deal_is_left_alone(): void
    {
        $dealId = $this->seedDealToEdit([
            'is_locked' => true,
            'referral_commission_type' => 'fixed',
            'referral_commission_value' => 40,
        ]);

        $result = $this->update($dealId, $this->terms('fixed', 10));

        $this->assertSame(UpdateDealReferralTerms::DEAL_LOCKED, $result['outcome']);
        $this->assertSame(['fixed', 40.0], $this->stored($dealId));
    }

    public function test_a_deal_whose_commission_is_calculated_is_left_alone(): void
    {
        $dealId = $this->seedDealToEdit([
            'commission_locked' => true,
            'referral_commission_type' => 'fixed',
            'referral_commission_value' => 40,
        ]);

        $result = $this->update($dealId, $this->terms('fixed', 10));

        $this->assertSame(UpdateDealReferralTerms::COMMISSION_LOCKED, $result['outcome']);
        $this->assertSame(['fixed', 40.0], $this->stored($dealId));
    }

    public function test_a_locked_deal_is_reported_as_locked_before_its_commission_is_considered(): void
    {
        $dealId = $this->seedDealToEdit(['is_locked' => true, 'commission_locked' => true]);

        $this->assertSame(UpdateDealReferralTerms::DEAL_LOCKED, $this->update($dealId, null)['outcome']);
    }
}
