<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Safe to re-run. MySQL commits each DDL statement on its own, so a run that
 * fails after CREATE TABLE (e.g. on an index) leaves the table behind with the
 * migration unrecorded. The next run then finds the table and adds only the
 * indexes that are missing, instead of failing on "table already exists".
 */
return new class extends Migration
{
    private const TABLE = 'audit_logs';

    /**
     * Every index stays under 767 bytes in utf8mb4, the key limit of older
     * MySQL/MariaDB servers (the reason for Schema::defaultStringLength(191)).
     */
    private const INDEXES = [
        'audit_logs_company_created_index' => ['company_id', 'created_at'],
        'audit_logs_company_user_index' => ['company_id', 'user_id', 'created_at'],
        'audit_logs_company_record_id_index' => ['company_id', 'auditable_id'],
        'audit_logs_company_event_index' => ['company_id', 'event'],
    ];

    public function up(): void
    {
        if (! $this->tableExists()) {
            Schema::create(self::TABLE, function (Blueprint $table) {
                $table->id();
                // Plain ids, no foreign keys: an audit row must outlive the company,
                // user and record it describes, and must never block their deletion.
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('user_id')->nullable();
                // Snapshot of who acted, so the row still reads after the user is gone.
                $table->string('user_name')->nullable();
                // created | updated | deleted | restored | login | logout | login_failed | password_reset
                $table->string('event', 32);
                $table->string('auditable_type');
                $table->string('auditable_id', 64)->nullable();
                $table->string('auditable_label')->nullable();
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                // web | api | console | queue
                $table->string('source', 16)->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 512)->nullable();
                $table->string('http_method', 10)->nullable();
                // Request URL (no query string), artisan command or queued job that made the change.
                $table->string('origin', 2048)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        foreach (self::INDEXES as $name => $columns) {
            if (! Schema::hasIndex(self::TABLE, $name)) {
                Schema::table(self::TABLE, fn (Blueprint $table) => $table->index($columns, $name));
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(self::TABLE);
    }

    /**
     * hasTable() reads information_schema, which has been seen to miss a table
     * that is there; asking the table itself is the final word.
     */
    private function tableExists(): bool
    {
        if (Schema::hasTable(self::TABLE)) {
            return true;
        }

        try {
            DB::table(self::TABLE)->limit(1)->get();

            return true;
        } catch (QueryException) {
            return false;
        }
    }
};
