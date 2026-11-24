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
}
