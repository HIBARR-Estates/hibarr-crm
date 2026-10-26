<?php

namespace Tests\Feature\AuditLog;

use App\Http\Controllers\AuditLogController;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Filtering and company scoping of the audit log list. Calls the action
 * directly: the admin gate is the same one-line middleware as the settings hub.
 */
class AuditLogEntriesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('audit_logs');
        (require base_path('database/migrations/2026_10_23_000002_create_audit_logs_table.php'))->up();

        session(['company' => (object) ['id' => 1, 'timezone' => 'UTC']]);

        $this->row(['company_id' => 1, 'user_id' => 10, 'user_name' => 'Ada', 'event' => 'created', 'auditable_type' => 'App\\Models\\Deal', 'auditable_id' => '5', 'auditable_label' => 'Villa deal', 'created_at' => '2026-10-01 09:00:00']);
        $this->row(['company_id' => 1, 'user_id' => 11, 'user_name' => 'Bo', 'event' => 'updated', 'auditable_type' => 'App\\Models\\Lead', 'auditable_id' => '9', 'auditable_label' => 'Jane Doe', 'created_at' => '2026-10-05 09:00:00']);
        $this->row(['company_id' => 1, 'user_id' => null, 'event' => 'deleted', 'auditable_type' => 'App\\Models\\Lead', 'auditable_id' => '9', 'source' => 'queue', 'created_at' => '2026-10-10 09:00:00']);
        $this->row(['company_id' => null, 'user_id' => null, 'event' => 'login_failed', 'auditable_type' => 'App\\Models\\User', 'auditable_label' => 'typo@example.test', 'created_at' => '2026-10-07 09:00:00']);
        $this->row(['company_id' => 2, 'user_id' => 12, 'user_name' => 'Other co', 'event' => 'created', 'auditable_type' => 'App\\Models\\Deal', 'auditable_id' => '77', 'created_at' => '2026-10-06 09:00:00']);
    }

    /** Rows with no company can't be attributed to a tenant, so no company sees them. */
    public function test_only_the_current_company_is_listed_newest_first(): void
    {
        $data = $this->entries();

        $this->assertSame(['deleted', 'updated', 'created'], array_column($data['data'], 'event'));
        $this->assertSame(3, $data['meta']['total']);
        $this->assertSame('Lead', $data['data'][0]['auditable']['type_label']);
    }

    public function test_filters_by_user_including_system(): void
    {
        $this->assertSame(['created'], array_column($this->entries(['users' => [10]])['data'], 'event'));
        $this->assertSame(['deleted', 'created'], array_column($this->entries(['users' => [0, 10]])['data'], 'event'));
    }

    public function test_filters_by_event_type_record_source_search_and_date(): void
    {
        $this->assertCount(1, $this->entries(['events' => ['updated']])['data']);
        $this->assertCount(2, $this->entries(['types' => ['App\\Models\\Lead']])['data']);
        $this->assertCount(2, $this->entries(['record_id' => '9'])['data']);
        $this->assertCount(1, $this->entries(['sources' => ['queue']])['data']);
        $this->assertSame('Villa deal', $this->entries(['search' => 'villa'])['data'][0]['auditable']['label']);
        $this->assertSame(['updated'], array_column($this->entries(['date_from' => '2026-10-02', 'date_to' => '2026-10-07'])['data'], 'event'));
    }

    private function entries(array $query = []): array
    {
        $response = app(AuditLogController::class)->entries(Request::create('/', 'GET', $query));

        return $response->getData(true);
    }

    private function row(array $attributes): void
    {
        AuditLog::query()->insert($attributes + ['source' => 'web']);
    }
}
