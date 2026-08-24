<?php

namespace Tests\Unit;

use App\Models\TaskSavedView;
use PHPUnit\Framework\TestCase;

/**
 * A saved view's filters are replayed straight back into the tasks index query
 * string, so the sanitizer is a trust boundary: anything it lets through
 * becomes a request parameter.
 */
class TaskSavedViewFilterSanitizeTest extends TestCase
{
    public function test_keeps_recognised_filter_keys(): void
    {
        $result = TaskSavedView::sanitizeFilters([
            'status' => 'complete',
            'priority' => 'high',
            'labels' => [1, 2],
            'view' => 'board',
        ]);

        $this->assertSame(
            ['status' => 'complete', 'priority' => 'high', 'labels' => [1, 2], 'view' => 'board'],
            $result
        );
    }

    public function test_drops_unknown_keys(): void
    {
        $result = TaskSavedView::sanitizeFilters([
            'status' => 'complete',
            'per_page' => 10000,
            'sort_by' => 'password',
            'page' => 5,
            '../../etc/passwd' => 'x',
        ]);

        $this->assertSame(['status' => 'complete'], $result);
    }

    public function test_drops_empty_values(): void
    {
        $result = TaskSavedView::sanitizeFilters([
            'status' => 'complete',
            'priority' => null,
            'search' => '',
            'labels' => [],
        ]);

        $this->assertSame(['status' => 'complete'], $result);
    }

    /**
     * FeatureFlagService::forInertia() only exposes flags listed in
     * config/features.php. If this one is dropped the frontend silently sees
     * `false` forever and the redesigned workspace disappears with no error anywhere.
     */
    public function test_redesign_flag_is_registered_as_a_known_flag(): void
    {
        $config = file_get_contents(__DIR__.'/../../config/features.php');

        $this->assertStringContainsString("'crm.tasks-workspace-redesign'", $config);
    }

    /**
     * Guards against the whitelist drifting from what TaskController::index()
     * actually reads off the request.
     */
    public function test_every_allowed_key_is_read_by_task_controller_index(): void
    {
        $controller = file_get_contents(__DIR__.'/../../app/Http/Controllers/TaskController.php');

        $controllerReadKeys = ['status', 'priority', 'assigned_to', 'project_id', 'category_id', 'labels', 'due_date_range', 'created_date_range', 'search'];

        foreach ($controllerReadKeys as $key) {
            $this->assertStringContainsString(
                "'{$key}'",
                $controller,
                "TaskController::index() no longer references '{$key}' — update the allowed-filter-key lists together."
            );
        }
    }
}
