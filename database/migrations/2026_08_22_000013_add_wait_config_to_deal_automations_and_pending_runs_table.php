<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Wait-before-running config — null for automations that run
        // immediately (the pre-existing default behavior).
        $hasValue = Schema::hasColumn('deal_automations', 'wait_duration_value');
        $hasUnit = Schema::hasColumn('deal_automations', 'wait_duration_unit');

        if (! $hasValue || ! $hasUnit) {
            Schema::table('deal_automations', function (Blueprint $table) use ($hasValue, $hasUnit) {
                if (! $hasValue) {
                    $table->unsignedInteger('wait_duration_value')->nullable()->after('date_recurrence');
                }
                if (! $hasUnit) {
                    $table->string('wait_duration_unit', 20)->nullable()->after(
                        $hasValue ? 'wait_duration_value' : 'date_recurrence'
                    );
                }
            });
        }

        // Rows here are created when a triggered automation has a wait
        // configured and its conditions passed — actions execute later from
        // deal-automations:process-pending-runs once run_at is due. One row
        // per automation+subject at a time (unique index) so repeated saves
        // on the same record can't stack duplicate delayed runs.
        if (! Schema::hasTable('deal_automation_pending_runs')) {
            Schema::create('deal_automation_pending_runs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('deal_automation_id');
                $table->unsignedBigInteger('company_id')->nullable();
                $table->string('subject_type', 10);
                $table->unsignedBigInteger('subject_id');
                $table->string('trigger')->nullable();
                $table->dateTime('run_at');
                $table->timestamps();

                $table->foreign('deal_automation_id')->references('id')->on('deal_automations')->onDelete('cascade');
                $table->unique(
                    ['deal_automation_id', 'subject_type', 'subject_id'],
                    'deal_automation_pending_runs_subject_unique'
                );
                $table->index('run_at', 'deal_automation_pending_runs_run_at_index');
            });

            return;
        }

        $this->ensurePendingRunIndexes();
    }

    public function down(): void
    {
        Schema::dropIfExists('deal_automation_pending_runs');

        $columns = array_values(array_filter(
            ['wait_duration_value', 'wait_duration_unit'],
            fn (string $column) => Schema::hasColumn('deal_automations', $column)
        ));

        if ($columns === []) {
            return;
        }

        Schema::table('deal_automations', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }

    private function ensurePendingRunIndexes(): void
    {
        $unique = 'deal_automation_pending_runs_subject_unique';
        $legacyUnique = 'deal_automation_pending_runs_deal_automation_id_subject_type_subject_id_unique';
        $runAt = 'deal_automation_pending_runs_run_at_index';

        Schema::table('deal_automation_pending_runs', function (Blueprint $table) use ($unique, $legacyUnique, $runAt) {
            if (
                ! $this->hasIndex('deal_automation_pending_runs', $unique)
                && ! $this->hasIndex('deal_automation_pending_runs', $legacyUnique)
            ) {
                $table->unique(
                    ['deal_automation_id', 'subject_type', 'subject_id'],
                    $unique
                );
            }

            if (! $this->hasIndex('deal_automation_pending_runs', $runAt)) {
                $table->index('run_at', $runAt);
            }
        });
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();

        if ($connection->getDriverName() === 'sqlite') {
            return collect($connection->select("PRAGMA index_list(`{$table}`)"))
                ->contains(fn ($row) => ($row->name ?? null) === $indexName);
        }

        return collect($connection->select(
            'SHOW INDEX FROM `'.$table.'` WHERE Key_name = ?',
            [$indexName]
        ))->isNotEmpty();
    }
};
