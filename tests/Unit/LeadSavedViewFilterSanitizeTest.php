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
