<?php

namespace Tests\Feature\AuditLog;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditLogMigrationTest extends TestCase
{
    private const INDEXES = [
        'audit_logs_company_created_index',
        'audit_logs_company_user_index',
        'audit_logs_company_record_id_index',
        'audit_logs_company_event_index',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('audit_logs');
    }

    public function test_it_creates_the_table_with_its_indexes_and_can_run_again(): void
    {
        $this->migrate();
        $this->migrate();

        $this->assertTrue(Schema::hasTable('audit_logs'));
        $this->assertIndexes();
    }

    /** A run that died after CREATE TABLE leaves the table without indexes and the migration unrecorded. */
    public function test_it_finishes_a_table_left_behind_by_a_failed_run(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('event', 32);
            $table->string('auditable_type');
            $table->string('auditable_id', 64)->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $this->migrate();

        $this->assertIndexes();
    }

    private function migrate(): void
    {
        (require base_path('database/migrations/2026_10_23_000002_create_audit_logs_table.php'))->up();
    }

    private function assertIndexes(): void
    {
        foreach (self::INDEXES as $index) {
            $this->assertTrue(Schema::hasIndex('audit_logs', $index), "missing {$index}");
        }
    }
}
