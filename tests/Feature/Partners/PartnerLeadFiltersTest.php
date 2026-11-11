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
        $row = function (int $id, string $full, ?int $status, int $open, int $won, int $lost, ?string $source = null, ?string $leadSource = null, ?string $added = null) {
            return [
                'id' => $id,
                'name' => 'X',
                'source' => $source,
                'lead_source' => $leadSource,
                'created_at' => $added,
                'status' => $status === null ? null : ['id' => $status, 'label' => "S$status", 'color' => null],
                'deals' => ['open' => $open, 'won' => $won, 'lost' => $lost],
                '_search' => mb_strtolower($full),
            ];
        };

        return collect([
            $row(1, 'Aylin Yilmaz', 10, 2, 1, 0, 'google', 'Website', '2026-03-10T09:00:00+00:00'),
            $row(2, 'Maria Petrova', 10, 1, 0, 0, 'facebook', null, '2026-03-01'),
            $row(3, 'Lukas Hartmann', 20, 0, 0, 2, 'Website', null, '2026-01-15'),
            $row(4, 'Ruben Demir', null, 0, 0, 0),
            $row(5, 'Kamil Novak', 20, 0, 1, 0, 'google', null, '2026-03-10T18:00:00+00:00'),
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

    public function test_source_filter_matches_the_preferred_source_or_a_differing_lead_source(): void
    {
        $this->assertSame([1, 5], $this->ids(['source' => ['google']]));
        $this->assertSame([1, 3], $this->ids(['source' => ['Website']]));
        $this->assertSame([2], $this->ids(['source' => ['facebook']]));
        $this->assertSame([1, 2, 5], $this->ids(['source' => ['google', 'facebook']]));
    }

    public function test_a_lead_with_no_source_never_matches_a_source(): void
    {
        $this->assertNotContains(4, $this->ids(['source' => ['google', 'Website', 'facebook']]));
    }

    public function test_an_empty_source_selection_does_not_filter(): void
    {
        $this->assertSame([1, 2, 3, 4, 5], $this->ids(['source' => []]));
    }

    public function test_added_date_filter_is_inclusive_and_skips_leads_with_no_date(): void
    {
        $this->assertSame([1, 2, 5], $this->ids(['added_from' => '2026-03-01', 'added_to' => '2026-03-10']));
        $this->assertSame([1, 5], $this->ids(['added_from' => '2026-03-10']));
        $this->assertSame([3], $this->ids(['added_to' => '2026-01-15']));
        $this->assertNotContains(4, $this->ids(['added_from' => '2020-01-01']));
    }

    public function test_added_sort_is_newest_first_by_default_and_oldest_first_when_asked(): void
    {
        $desc = PartnerLeadService::sortRows($this->rows(), 'added_desc')->pluck('id')->all();
        $asc = PartnerLeadService::sortRows($this->rows(), 'added_asc')->pluck('id')->all();

        $this->assertSame([5, 1, 2, 3, 4], $desc);
        $this->assertSame([4, 3, 2, 1, 5], $asc);
    }
}
