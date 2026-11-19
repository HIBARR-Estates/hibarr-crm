<?php

namespace Tests\Unit;

use App\Models\LeadSavedView;
use App\Services\LeadService;
use PHPUnit\Framework\TestCase;

/**
 * A saved view's filters are replayed straight back into the leads index query
 * string, so the sanitizer is a trust boundary: anything it lets through
 * becomes a request parameter.
 */
class LeadSavedViewFilterSanitizeTest extends TestCase
{
    public function test_keeps_recognised_filter_keys(): void
    {
        $result = LeadSavedView::sanitizeFilters([
            'temperature' => 'hot,warm',
            'lifecycle_status_id' => [1, 2],
            'utm_source' => 'facebook',
        ]);

        $this->assertSame(
            ['temperature' => 'hot,warm', 'lifecycle_status_id' => [1, 2], 'utm_source' => 'facebook'],
            $result
        );
    }

    public function test_drops_unknown_keys(): void
    {
        $result = LeadSavedView::sanitizeFilters([
            'temperature' => 'hot',
            'per_page' => 10000,
            'sort_by' => 'password',
            'page' => 5,
            '../../etc/passwd' => 'x',
        ]);

        $this->assertSame(['temperature' => 'hot'], $result);
    }

    public function test_drops_empty_values(): void
    {
        $result = LeadSavedView::sanitizeFilters([
            'temperature' => 'hot',
            'gender' => null,
            'country' => '',
            'age_range' => [],
        ]);

        $this->assertSame(['temperature' => 'hot'], $result);
    }

    public function test_keeps_exclusion_modes_and_the_values_they_go_with(): void
    {
        $filters = [
            'lead_source' => '1,3',
            'lead_source_mode' => 'not_in',
            'lead_owner_id_mode' => 'empty',
            'referred_by_agent_id_mode' => 'any',
            'contact_score_mode' => 'empty',
            'qualification_answer_values_mode' => 'not_in',
            'cf_12' => 'High',
            'cf_12_mode' => 'not_in',
            'has_attended_the_webinar' => 'unknown',
            'next_action' => 'not_overdue',
        ];

        $this->assertSame($filters, LeadSavedView::sanitizeFilters($filters));
    }

    public function test_drops_a_mode_that_is_not_one_of_the_known_words(): void
    {
        $result = LeadSavedView::sanitizeFilters([
            'lead_source' => '1',
            'lead_source_mode' => 'anything goes',
            'cf_12_mode' => ['not_in'],
            'gender_mode' => 'empty',
        ]);

        $this->assertSame(['lead_source' => '1', 'gender_mode' => 'empty'], $result);
    }

    public function test_drops_a_mode_the_filter_does_not_offer(): void
    {
        // Owner and referrer offer "has any"; nothing else does, and a few offer less.
        $result = LeadSavedView::sanitizeFilters([
            'lead_owner_id_mode' => 'any',
            'referred_by_agent_id_mode' => 'any',
            'gender_mode' => 'any',
            'lead_source_mode' => 'any',
            'cf_12_mode' => 'any',
            'added_by_id_mode' => 'empty',
            'contact_score_mode' => 'not_in',
            'qualification_answer_values_mode' => 'any',
        ]);

        $this->assertSame(['lead_owner_id_mode' => 'any', 'referred_by_agent_id_mode' => 'any'], $result);
    }

    public function test_drops_a_mode_for_a_filter_that_has_none(): void
    {
        // `search` and `lead_type` take no mode; a stray one is not a request param.
        $this->assertSame(
            ['search' => 'ali'],
            LeadSavedView::sanitizeFilters(['search' => 'ali', 'search_mode' => 'empty', 'lead_type_mode' => 'any'])
        );
    }

    /**
     * FeatureFlagService::forInertia() only exposes flags listed in
     * config/features.php. If this one is dropped the frontend silently sees
     * `false` forever and the v2 filter UI disappears with no error anywhere.
     */
    public function test_filter_v2_flag_is_registered_as_a_known_flag(): void
    {
        $config = file_get_contents(__DIR__ . '/../../config/features.php');

        $this->assertStringContainsString("'crm.leads-filter-v2'", $config);
    }

    public function test_every_allowed_key_is_a_key_apply_filters_understands(): void
    {
        // Guards against the whitelist drifting from the query builder.
        $applyFilters = file_get_contents(
            __DIR__ . '/../../app/Services/LeadService.php'
        );

        foreach (LeadService::FILTER_KEYS as $key) {
            $this->assertStringContainsString(
                "'{$key}'",
                $applyFilters,
                "FILTER_KEYS lists '{$key}' but LeadService never references it."
            );
        }
    }
}
