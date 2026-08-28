<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hasValue = $this->nativeColumnExists('deal_automation_actions', 'wait_duration_value');
        $hasUnit = $this->nativeColumnExists('deal_automation_actions', 'wait_duration_unit');

        if (! $hasValue || ! $hasUnit) {
            Schema::table('deal_automation_actions', function (Blueprint $table) use ($hasValue, $hasUnit) {
                if (! $hasValue) {
                    $table->unsignedInteger('wait_duration_value')->nullable()->after('meta_event_value');
                }
                if (! $hasUnit) {
                    $table->string('wait_duration_unit', 20)->nullable()->after(
                        $hasValue ? 'wait_duration_value' : 'meta_event_value'
                    );
                }
            });
        }

        if (! Schema::hasTable('deal_automation_pending_runs')) {
            return;
        }

        // Column and FK are separate statements. A prior run can leave the
        // column in place after a failed FK add (or a stale Schema::hasColumn
        // check), so each step is gated on SHOW COLUMNS / SHOW CREATE TABLE.
        if (! $this->nativeColumnExists('deal_automation_pending_runs', 'resume_action_id')) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->unsignedBigInteger('resume_action_id')->nullable()->after('trigger');
            });
        }

        if (
            $this->nativeColumnExists('deal_automation_pending_runs', 'resume_action_id')
            && ! $this->foreignKeyExists('deal_automation_pending_runs', 'resume_action_id')
        ) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->foreign('resume_action_id')
                    ->references('id')
                    ->on('deal_automation_actions')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if ($this->foreignKeyExists('deal_automation_pending_runs', 'resume_action_id')) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->dropForeign(['resume_action_id']);
            });
        }

        if ($this->nativeColumnExists('deal_automation_pending_runs', 'resume_action_id')) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->dropColumn('resume_action_id');
            });
        }

        $columns = array_values(array_filter(
            ['wait_duration_value', 'wait_duration_unit'],
            fn (string $column) => $this->nativeColumnExists('deal_automation_actions', $column)
        ));

        if ($columns === []) {
            return;
        }

        Schema::table('deal_automation_actions', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }

    private function nativeColumnExists(string $table, string $column): bool
    {
        $connection = Schema::getConnection();

        if ($connection->getDriverName() === 'sqlite') {
            return collect($connection->select("PRAGMA table_info(`{$table}`)"))
                ->contains(fn ($row) => strcasecmp((string) ($row->name ?? ''), $column) === 0);
        }

        return collect($connection->select(
            'SHOW COLUMNS FROM `'.$table.'` LIKE ?',
            [$column]
        ))->isNotEmpty();
    }

    private function foreignKeyExists(string $table, string $column): bool
    {
        $connection = Schema::getConnection();

        if ($connection->getDriverName() === 'sqlite') {
            return collect($connection->select("PRAGMA foreign_key_list(`{$table}`)"))
                ->contains(fn ($row) => ($row->from ?? '') === $column);
        }

        $create = $connection->select('SHOW CREATE TABLE `'.$table.'`');
        $row = (array) ($create[0] ?? []);
        $sql = (string) ($row['Create Table'] ?? $row['Create_Table'] ?? '');

        return str_contains($sql, 'FOREIGN KEY (`'.$column.'`)');
    }
};
