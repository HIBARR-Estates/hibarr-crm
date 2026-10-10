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
        $row = fn (int $id, string $full, ?int $status, array $stages) => [
            'id' => $id,
            'name' => 'X',
            'status' => $status === null ? null : ['id' => $status, 'label' => "S$status", 'color' => null],
            'active_deals' => count($stages),
            'active_deal_statuses' => array_map(fn ($name) => ['name' => $name, 'color' => null], $stages),
            '_search' => mb_strtolower($full),
        ];

        return collect([
            $row(1, 'Aylin Yilmaz', 10, ['Negotiation', 'Offer sent']),
            $row(2, 'Maria Petrova', 10, ['Viewing']),
            $row(3, 'Lukas Hartmann', 20, []),
            $row(4, 'Ruben Demir', null, []),
        ]);
    }

    /** @param  array<string, mixed>  $filters */
    private function ids(array $filters): array
    {
        return PartnerLeadService::filterRows($this->rows(), $filters)->pluck('id')->all();
    }

    public function test_no_filters_returns_everything_in_order(): void
    {
        $this->assertSame([1, 2, 3, 4], $this->ids([]));
    }

    public function test_search_is_case_insensitive_and_matches_part_of_a_name(): void
    {
        $this->assertSame([1], $this->ids(['search' => 'YILM']));
        $this->assertSame([2], $this->ids(['search' => ' maria ']));
        $this->assertSame([], $this->ids(['search' => 'nobody']));
    }

    public function test_blank_search_is_ignored(): void
    {
        $this->assertSame([1, 2, 3, 4], $this->ids(['search' => '   ']));
    }

    public function test_status_filter(): void
    {
        $this->assertSame([1, 2], $this->ids(['status' => [10]]));
        $this->assertSame([3], $this->ids(['status' => [20]]));
    }

    public function test_leads_with_no_status_never_match_a_status(): void
    {
        $this->assertNotContains(4, $this->ids(['status' => [10]]));
        $this->assertNotContains(4, $this->ids(['status' => [20]]));
    }

    public function test_deal_stage_filter_matches_any_active_deal_stage(): void
    {
        $this->assertSame([1], $this->ids(['stage' => ['Offer sent']]));
        $this->assertSame([2], $this->ids(['stage' => ['Viewing']]));
        $this->assertSame([], $this->ids(['stage' => ['Closed']]));
    }

    public function test_active_deals_filter(): void
    {
        $this->assertSame([1, 2], $this->ids(['deals' => 'with']));
        $this->assertSame([3, 4], $this->ids(['deals' => 'without']));
    }

    public function test_a_lead_matches_any_of_several_statuses_or_stages(): void
    {
        $this->assertSame([1, 2, 3], $this->ids(['status' => [10, 20]]));
        $this->assertSame([1, 2], $this->ids(['stage' => ['Offer sent', 'Viewing']]));
    }

    public function test_empty_selections_do_not_filter(): void
    {
        $this->assertSame([1, 2, 3, 4], $this->ids(['status' => [], 'stage' => []]));
    }

    public function test_filters_combine(): void
    {
        $this->assertSame([1], $this->ids(['status' => [10], 'deals' => 'with', 'search' => 'aylin']));
        $this->assertSame([], $this->ids(['status' => [20], 'deals' => 'with']));
    }
}
