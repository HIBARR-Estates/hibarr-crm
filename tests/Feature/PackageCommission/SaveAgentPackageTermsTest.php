<?php

namespace Tests\Feature\PackageCommission;

use App\Actions\Packages\SaveAgentPackageTerms;
use App\Models\LeadAgent;
use App\Models\Package;
use App\Support\CommissionTerms;
use Illuminate\Support\Facades\DB;
use Tests\PackageCommissionTestCase;

/**
 * One row per agent and package holds what they earn as the closer and as the
 * referrer. A role the request does not set must be left as it was.
 */
class SaveAgentPackageTermsTest extends PackageCommissionTestCase
{
    private int $companyId;

    private int $agentId;

    private int $packageId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyId = $this->seedCompany();
        $this->agentId = $this->seedAgent($this->companyId, $this->seedUser($this->companyId));
        $this->packageId = $this->seedPackage($this->companyId, 8000, 'percentage', 5);
    }

    private function terms(string $type, ?float $value = null): CommissionTerms
    {
        return CommissionTerms::make($type, $value);
    }

    private function save(
        bool $setCloser = false,
        ?CommissionTerms $closer = null,
        bool $setReferral = false,
        ?CommissionTerms $referral = null,
    ): string {
        return app(SaveAgentPackageTerms::class)->handle(
            Package::withoutGlobalScopes()->findOrFail($this->packageId),
            LeadAgent::withoutGlobalScopes()->findOrFail($this->agentId),
            $this->companyId,
            $setCloser,
            $closer,
            $setReferral,
            $referral,
        );
    }

    /** @return array{closer: array{0: string|null, 1: float|null}, referral: array{0: string|null, 1: float|null}}|null */
    private function row(): ?array
    {
        $row = DB::table('agent_package_commission_rates')
            ->where('agent_id', $this->agentId)
            ->where('package_id', $this->packageId)
            ->first();

        if ($row === null) {
            return null;
        }

        $number = fn ($value) => $value === null ? null : (float) $value;

        return [
            'closer' => [$row->commission_type, $number($row->commission_value)],
            'referral' => [$row->referral_commission_type, $number($row->referral_commission_value)],
        ];
    }

    public function test_a_closer_override_alone_leaves_the_referral_role_unset(): void
    {
        $result = $this->save(true, $this->terms('fixed', 100));

        $this->assertSame(SaveAgentPackageTerms::SAVED, $result);
        $this->assertSame(['closer' => ['fixed', 100.0], 'referral' => [null, null]], $this->row());
    }

    public function test_referral_terms_alone_leave_the_closer_on_the_package_default(): void
    {
        $result = $this->save(false, null, true, $this->terms('percentage', 1.5));

        $this->assertSame(SaveAgentPackageTerms::SAVED, $result);
        $this->assertSame(['closer' => [null, null], 'referral' => ['percentage', 1.5]], $this->row());
    }

    public function test_both_roles_are_kept_in_the_one_row(): void
    {
        $this->save(true, $this->terms('fixed', 100), true, $this->terms('percentage', 1));

        $this->assertSame(['closer' => ['fixed', 100.0], 'referral' => ['percentage', 1.0]], $this->row());
        $this->assertSame(1, DB::table('agent_package_commission_rates')->count());
    }

    public function test_changing_one_role_does_not_disturb_the_other(): void
    {
        $this->save(true, $this->terms('fixed', 100), true, $this->terms('percentage', 1));

        $this->save(false, null, true, $this->terms('fixed', 60));
        $this->assertSame(['closer' => ['fixed', 100.0], 'referral' => ['fixed', 60.0]], $this->row(), 'The closer role was not sent.');

        $this->save(true, $this->terms('percentage', 7));
        $this->assertSame(['closer' => ['percentage', 7.0], 'referral' => ['fixed', 60.0]], $this->row(), 'The referral role was not sent.');
    }

    public function test_clearing_a_role_leaves_the_other(): void
    {
        $this->save(true, $this->terms('fixed', 100), true, $this->terms('percentage', 1));

        $result = $this->save(false, null, true, null);

        $this->assertSame(SaveAgentPackageTerms::SAVED, $result);
        $this->assertSame(['closer' => ['fixed', 100.0], 'referral' => [null, null]], $this->row());
    }

    public function test_a_row_left_with_neither_role_is_removed(): void
    {
        $this->save(true, $this->terms('fixed', 100), true, $this->terms('percentage', 1));
        $this->save(true, null);

        $result = $this->save(false, null, true, null);

        $this->assertSame(SaveAgentPackageTerms::REMOVED, $result);
        $this->assertNull($this->row());
    }

    public function test_stating_no_terms_for_a_new_agent_stores_nothing(): void
    {
        $result = $this->save(true, null, true, null);

        $this->assertSame(SaveAgentPackageTerms::EMPTY, $result);
        $this->assertNull($this->row());
    }

    public function test_a_closer_override_of_none_is_kept_with_no_value(): void
    {
        $this->save(true, $this->terms('none', 50));

        $this->assertSame(['closer' => ['none', null], 'referral' => [null, null]], $this->row());
    }

    public function test_referral_none_is_stored_as_no_terms(): void
    {
        $this->save(true, $this->terms('fixed', 100), true, $this->terms('none'));

        $this->assertSame(['closer' => ['fixed', 100.0], 'referral' => [null, null]], $this->row());
    }
}
