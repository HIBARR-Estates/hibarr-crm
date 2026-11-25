<?php

namespace Tests\Feature\PerAgentCommissionOverride;

use App\Actions\Agents\SyncAgentCategories;
use App\Models\LeadAgent;
use Illuminate\Support\Facades\DB;
use Tests\PerAgentCommissionOverrideTestCase;

/**
 * Saving an agent's categories must never reset what was configured on them.
 */
class SyncAgentCategoriesTest extends PerAgentCommissionOverrideTestCase
{
    private int $companyId;

    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyId = $this->seedCompany();
        $this->userId = $this->seedUser($this->companyId);
    }

    private function seedRow(?int $categoryId, array $extra = []): int
    {
        return $this->seedAgent($this->companyId, $this->userId, null, array_merge(['lead_category_id' => $categoryId], $extra));
    }

    private function partnerRow(?int $categoryId): int
    {
        return $this->seedRow($categoryId, [
            'is_partner' => true,
            'referral_commission_type' => 'percentage',
            'referral_commission_value' => 2,
        ]);
    }

    /** @param  array<int, int>  $categoryIds */
    private function sync(int $anyRowId, array $categoryIds): void
    {
        // The lead-agent observer cleans up metrics tables this fixture does not have;
        // what is under test is which rows are kept, created and removed.
        LeadAgent::withoutEvents(fn () => app(SyncAgentCategories::class)->handle(
            LeadAgent::findOrFail($anyRowId),
            $categoryIds,
            $this->companyId,
            $this->userId,
        ));
    }

    /** @return array<int, array{id: int, partner: bool, type: string|null, value: float|null}> keyed by category */
    private function rows(): array
    {
        return DB::table('lead_agents')
            ->where('user_id', $this->userId)
            ->get()
            ->mapWithKeys(fn ($row) => [(int) ($row->lead_category_id ?? 0) => [
                'id' => (int) $row->id,
                'partner' => (bool) $row->is_partner,
                'type' => $row->referral_commission_type,
                'value' => $row->referral_commission_value === null ? null : (float) $row->referral_commission_value,
            ]])
            ->all();
    }

    public function test_resaving_the_same_categories_keeps_the_row_and_its_partner_settings(): void
    {
        $rowId = $this->partnerRow(1);

        $this->sync($rowId, [1]);

        $this->assertSame([1 => ['id' => $rowId, 'partner' => true, 'type' => 'percentage', 'value' => 2.0]], $this->rows());
    }

    public function test_a_category_added_to_a_partner_is_still_the_partner(): void
    {
        $rowId = $this->partnerRow(1);

        $this->sync($rowId, [1, 2]);

        $rows = $this->rows();
        $this->assertSame($rowId, $rows[1]['id'], 'The existing row is untouched.');
        $this->assertSame(['partner' => true, 'type' => 'percentage', 'value' => 2.0], [
            'partner' => $rows[2]['partner'], 'type' => $rows[2]['type'], 'value' => $rows[2]['value'],
        ]);
    }

    public function test_deselecting_a_category_removes_only_that_row(): void
    {
        $first = $this->partnerRow(1);
        $second = $this->partnerRow(2);

        $this->sync($first, [2]);

        $this->assertSame([2 => ['id' => $second, 'partner' => true, 'type' => 'percentage', 'value' => 2.0]], $this->rows());
    }

    public function test_a_new_category_follows_the_partner_row_not_whichever_row_comes_first(): void
    {
        $this->seedRow(1);
        $partner = $this->partnerRow(2);

        $this->sync($partner, [2, 3]);

        $rows = $this->rows();
        $this->assertArrayNotHasKey(1, $rows, 'The deselected row is gone.');
        $this->assertSame($partner, $rows[2]['id']);
        $this->assertTrue($rows[3]['partner']);
        $this->assertSame('percentage', $rows[3]['type']);
    }

    public function test_selecting_nothing_leaves_one_row_without_a_category(): void
    {
        $rowId = $this->partnerRow(1);

        $this->sync($rowId, []);

        $rows = $this->rows();
        $this->assertSame([0], array_keys($rows), 'One row, no category.');
        $this->assertTrue($rows[0]['partner']);
    }

    /** @return array<int, array{type: string|null, ref_type: string|null, ref_value: float|null}> keyed by package */
    private function packageTermsOf(int $agentId): array
    {
        return DB::table('agent_package_commission_rates')
            ->where('agent_id', $agentId)
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->package_id => [
                'type' => $row->commission_type,
                'ref_type' => $row->referral_commission_type,
                'ref_value' => $row->referral_commission_value === null ? null : (float) $row->referral_commission_value,
            ]])
            ->all();
    }

    public function test_changing_a_partners_only_category_keeps_their_package_terms(): void
    {
        $old = $this->partnerRow(1);
        DB::table('agent_package_commission_rates')->insert([
            ['company_id' => $this->companyId, 'agent_id' => $old, 'package_id' => 7, 'commission_type' => 'fixed', 'commission_value' => 100, 'referral_commission_type' => 'percentage', 'referral_commission_value' => 3],
            ['company_id' => $this->companyId, 'agent_id' => $old, 'package_id' => 8, 'commission_type' => null, 'commission_value' => null, 'referral_commission_type' => 'fixed', 'referral_commission_value' => 150],
        ]);

        $this->sync($old, [2]);

        $rows = $this->rows();
        $this->assertArrayNotHasKey(1, $rows, 'The old category row is gone.');
        $this->assertSame([
            7 => ['type' => 'fixed', 'ref_type' => 'percentage', 'ref_value' => 3.0],
            8 => ['type' => null, 'ref_type' => 'fixed', 'ref_value' => 150.0],
        ], $this->packageTermsOf($rows[2]['id']), 'The partner keeps what they were set up on, closer and referrer roles together.');
    }

    public function test_a_category_added_to_a_partner_starts_with_their_package_terms(): void
    {
        $existing = $this->partnerRow(1);
        DB::table('agent_package_commission_rates')->insert(
            ['company_id' => $this->companyId, 'agent_id' => $existing, 'package_id' => 7, 'commission_type' => null, 'commission_value' => null, 'referral_commission_type' => 'percentage', 'referral_commission_value' => 3],
        );

        $this->sync($existing, [1, 2]);

        $rows = $this->rows();
        $expected = [7 => ['type' => null, 'ref_type' => 'percentage', 'ref_value' => 3.0]];
        $this->assertSame($expected, $this->packageTermsOf($rows[2]['id']));
        $this->assertSame($expected, $this->packageTermsOf($rows[1]['id']), 'The existing row is untouched.');
    }

    public function test_removing_the_row_the_terms_were_set_on_fills_gaps_on_the_row_that_stays(): void
    {
        $removed = $this->partnerRow(1);
        $kept = $this->partnerRow(2);
        DB::table('agent_package_commission_rates')->insert([
            ['company_id' => $this->companyId, 'agent_id' => $removed, 'package_id' => 7, 'commission_type' => null, 'commission_value' => null, 'referral_commission_type' => 'percentage', 'referral_commission_value' => 3],
            ['company_id' => $this->companyId, 'agent_id' => $removed, 'package_id' => 8, 'commission_type' => null, 'commission_value' => null, 'referral_commission_type' => 'fixed', 'referral_commission_value' => 150],
            // The row that stays already has its own terms on package 7.
            ['company_id' => $this->companyId, 'agent_id' => $kept, 'package_id' => 7, 'commission_type' => null, 'commission_value' => null, 'referral_commission_type' => 'fixed', 'referral_commission_value' => 99],
        ]);

        $this->sync($removed, [2]);

        $this->assertSame([
            7 => ['type' => null, 'ref_type' => 'fixed', 'ref_value' => 99.0],
            8 => ['type' => null, 'ref_type' => 'fixed', 'ref_value' => 150.0],
        ], $this->packageTermsOf($kept), 'Package 8 is taken over; package 7 keeps what was configured on this row.');
    }

    public function test_a_resave_that_removes_nothing_does_not_copy_terms_between_rows(): void
    {
        $first = $this->partnerRow(1);
        $second = $this->partnerRow(2);
        DB::table('agent_package_commission_rates')->insert(
            ['company_id' => $this->companyId, 'agent_id' => $first, 'package_id' => 7, 'commission_type' => null, 'commission_value' => null, 'referral_commission_type' => 'percentage', 'referral_commission_value' => 3],
        );

        $this->sync($first, [1, 2]);

        $this->assertSame([], $this->packageTermsOf($second), 'Rows keep their own terms unless the row they were set on goes away.');
    }

    public function test_package_terms_of_someone_who_is_not_a_partner_are_not_copied(): void
    {
        $existing = $this->seedRow(1);
        DB::table('agent_package_commission_rates')->insert(
            ['company_id' => $this->companyId, 'agent_id' => $existing, 'package_id' => 7, 'commission_type' => 'fixed', 'commission_value' => 100, 'referral_commission_type' => null, 'referral_commission_value' => null],
        );

        $this->sync($existing, [1, 2]);

        $this->assertSame([], $this->packageTermsOf($this->rows()[2]['id']));
    }
}
