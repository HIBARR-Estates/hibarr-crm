<?php

namespace Tests\Feature\Partners;

use App\Services\Partner\PartnerLeadService;
use Illuminate\Support\Collection;
use Tests\TestCase;

/**
 * Search and filters on the partner's leads. Pure: rows in, rows out.
 */
class PartnerLeadFiltersTest extends TestCase
{
    /** @return Collection<int, array<string, mixed>> */
    private function rows(): Collection
    {
        $row = fn (int $id, string $full, ?int $status, int $open, int $won, int $lost) => [
            'id' => $id,
            'name' => 'X',
            'status' => $status === null ? null : ['id' => $status, 'label' => "S$status", 'color' => null],
            'deals' => ['open' => $open, 'won' => $won, 'lost' => $lost],
            '_search' => mb_strtolower($full),
        ];

        return collect([
            $row(1, 'Aylin Yilmaz', 10, 2, 1, 0),   // open and won
            $row(2, 'Maria Petrova', 10, 1, 0, 0),  // open only
            $row(3, 'Lukas Hartmann', 20, 0, 0, 2), // lost only
            $row(4, 'Ruben Demir', null, 0, 0, 0),  // no deals
            $row(5, 'Kamil Novak', 20, 0, 1, 0),    // won only
        ]);
    }

    /** @param  array<string, mixed>  $filters */
    private function ids(array $filters): array
    {
        return PartnerLeadService::filterRows($this->rows(), $filters)->pluck('id')->all();
    }

    public function test_no_filters_returns_everything_in_order(): void
    {
        $this->assertSame([1, 2, 3, 4, 5], $this->ids([]));
    }

    public function test_search_is_case_insensitive_and_matches_part_of_a_name(): void
    {
        $this->assertSame([1], $this->ids(['search' => 'YILM']));
        $this->assertSame([2], $this->ids(['search' => ' maria ']));
        $this->assertSame([], $this->ids(['search' => 'nobody']));
    }

    public function test_blank_search_is_ignored(): void
    {
        $this->assertSame([1, 2, 3, 4, 5], $this->ids(['search' => '   ']));
    }

    public function test_status_filter(): void
    {
        $this->assertSame([1, 2], $this->ids(['status' => [10]]));
        $this->assertSame([3, 5], $this->ids(['status' => [20]]));
        $this->assertSame([1, 2, 3, 5], $this->ids(['status' => [10, 20]]));
    }

    public function test_leads_with_no_status_never_match_a_status(): void
    {
        $this->assertNotContains(4, $this->ids(['status' => [10, 20]]));
    }

    public function test_deal_outcome_filters(): void
    {
        $this->assertSame([1, 2], $this->ids(['deals' => ['open']]));
        $this->assertSame([1, 5], $this->ids(['deals' => ['won']]));
        $this->assertSame([3], $this->ids(['deals' => ['lost']]));
        $this->assertSame([4], $this->ids(['deals' => ['none']]));
    }

    public function test_several_deal_outcomes_match_any_of_them(): void
    {
        $this->assertSame([1, 2, 5], $this->ids(['deals' => ['open', 'won']]));
        $this->assertSame([3, 4], $this->ids(['deals' => ['lost', 'none']]));
    }

    public function test_empty_selections_do_not_filter(): void
    {
        $this->assertSame([1, 2, 3, 4, 5], $this->ids(['status' => [], 'deals' => []]));
    }

    public function test_filters_combine(): void
    {
        $this->assertSame([1], $this->ids(['status' => [10], 'deals' => ['won'], 'search' => 'aylin']));
        $this->assertSame([], $this->ids(['status' => [20], 'deals' => ['open']]));
    }
}
