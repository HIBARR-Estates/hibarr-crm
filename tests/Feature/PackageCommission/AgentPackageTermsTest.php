<?php

namespace Tests\Feature\PackageCommission;

use App\Actions\Packages\SaveAgentPackageTerms;
use App\Models\LeadAgent;
use App\Services\Partner\AgentPackageTerms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Tests\PackageCommissionTestCase;

/**
 * The partner-side view of package terms: what the rules accept, and what the
 * screen reads back. Both the settings screen and the partner view share the rules.
 */
class AgentPackageTermsTest extends PackageCommissionTestCase
{
    /** @return array<int, string> the fields that failed validation */
    private function errors(array $input, bool $referralEnabled = true): array
    {
        $request = Request::create('/', 'PUT', $input);

        return array_keys(Validator::make($input, SaveAgentPackageTerms::rules($request, $referralEnabled))->errors()->messages());
    }

    public function test_a_row_may_state_the_referral_terms_alone_when_the_feature_is_on(): void
    {
        $this->assertSame([], $this->errors(['referral_commission_type' => 'percentage', 'referral_commission_value' => 1.5]));
    }

    public function test_the_closer_terms_are_required_while_the_feature_is_off(): void
    {
        $this->assertSame(['commission_type'], $this->errors([], false));
    }

    public function test_a_percentage_or_fixed_referral_needs_a_value(): void
    {
        $this->assertSame(['referral_commission_value'], $this->errors(['referral_commission_type' => 'percentage']));
        $this->assertSame(['referral_commission_value'], $this->errors(['referral_commission_type' => 'fixed']));
    }

    public function test_a_referral_percentage_is_capped_at_100_but_a_fixed_amount_is_not(): void
    {
        $this->assertSame(['referral_commission_value'], $this->errors(['referral_commission_type' => 'percentage', 'referral_commission_value' => 101]));
        $this->assertSame([], $this->errors(['referral_commission_type' => 'fixed', 'referral_commission_value' => 250]));
    }

    public function test_a_value_the_column_cannot_store_is_refused(): void
    {
        // 0.004 would pass any amount check as written and then be stored as 0.00.
        $this->assertSame(['referral_commission_value'], $this->errors(['referral_commission_type' => 'percentage', 'referral_commission_value' => 0.004]));
        $this->assertSame(['referral_commission_value'], $this->errors(['referral_commission_type' => 'fixed', 'referral_commission_value' => 10.005]));
        $this->assertSame([], $this->errors(['referral_commission_type' => 'percentage', 'referral_commission_value' => 0.25]));
        $this->assertSame([], $this->errors(['referral_commission_type' => 'fixed', 'referral_commission_value' => 150.5]));
    }

    public function test_the_two_roles_are_checked_independently(): void
    {
        $errors = $this->errors([
            'commission_type' => 'fixed', 'commission_value' => 100,
            'referral_commission_type' => 'percentage', 'referral_commission_value' => 150,
        ]);

        $this->assertSame(['referral_commission_value'], $errors);
    }

    public function test_an_unknown_type_is_refused(): void
    {
        $this->assertSame(['referral_commission_type'], $this->errors(['referral_commission_type' => 'bonus']));
    }

    public function test_the_partner_view_lists_each_package_with_both_roles_and_the_default(): void
    {
        $company = $this->seedCompany();
        $agent = $this->seedAgent($company, $this->seedUser($company));
        $other = $this->seedAgent($company, $this->seedUser($company, 'Someone else'));
        $zebra = $this->seedPackage($company, 5000, 'percentage', 4, 'EUR', 'Zebra');
        $alpha = $this->seedPackage($company, 8000, 'fixed', 250, 'EUR', 'Alpha');
        $unused = $this->seedPackage($company, 1000, null, null, 'EUR', 'Unused');
        $this->seedAgentPackageRate($company, $agent, $zebra, null, null, 'fixed', 60);
        $this->seedAgentPackageRate($company, $agent, $alpha, 'percentage', 7, 'percentage', 1.5);
        $this->seedAgentPackageRate($company, $other, $unused, 'fixed', 10);

        $view = app(AgentPackageTerms::class)->forAgent(LeadAgent::withoutGlobalScopes()->findOrFail($agent));

        $this->assertSame(['Alpha', 'Zebra'], array_column($view['rows'], 'package_name'), 'Sorted by package name, only this agent\'s rows.');
        $this->assertSame(
            [
                'package_id' => $alpha,
                'package_name' => 'Alpha',
                'package_value' => 8000.0,
                'package_currency' => 'EUR',
                'package_default' => ['type' => 'fixed', 'value' => 250.0],
                'commission_type' => 'percentage',
                'commission_value' => 7.0,
                'referral_commission_type' => 'percentage',
                'referral_commission_value' => 1.5,
            ],
            $view['rows'][0]
        );
        $this->assertNull($view['rows'][1]['commission_type'], 'A referral-only row has no closer override.');
        $this->assertSame('fixed', $view['rows'][1]['referral_commission_type']);
        $this->assertSame(['Alpha', 'Unused', 'Zebra'], array_column($view['packages'], 'name'), 'Every package is offered to add.');
    }

    public function test_an_agent_with_no_rows_has_an_empty_list(): void
    {
        $company = $this->seedCompany();
        $agent = $this->seedAgent($company, $this->seedUser($company));

        $view = app(AgentPackageTerms::class)->forAgent(LeadAgent::withoutGlobalScopes()->findOrFail($agent));

        $this->assertSame([], $view['rows']);
    }
}
