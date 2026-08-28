<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hasValue = Schema::hasColumn('deal_automation_actions', 'wait_duration_value');
        $hasUnit = Schema::hasColumn('deal_automation_actions', 'wait_duration_unit');

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

        if (
            Schema::hasTable('deal_automation_pending_runs')
            && ! Schema::hasColumn('deal_automation_pending_runs', 'resume_action_id')
        ) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->foreignId('resume_action_id')->nullable()->after('trigger')
                    ->constrained('deal_automation_actions')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deal_automation_pending_runs', 'resume_action_id')) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('resume_action_id');
            });
        }

        $columns = array_values(array_filter(
            ['wait_duration_value', 'wait_duration_unit'],
            fn (string $column) => Schema::hasColumn('deal_automation_actions', $column)
        ));

        if ($columns === []) {
            return;
        }

        Schema::table('deal_automation_actions', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }
};
