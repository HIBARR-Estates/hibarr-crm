<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Next step" as a flag on the task the agent nominated, not a field on the
 * lead or deal.
 *
 * The obvious-looking alternatives are both dead ends: leads.next_follow_up and
 * deals.next_follow_up are enum('yes','no') — a boolean forced to 'yes' for
 * every row by a 2024 backfill — and next_follow_up_date does not exist on
 * either table at all (it is a correlated-subquery alias that filters
 * lead_follow_up.status='pending', a value not in that enum, so it is
 * permanently NULL).
 *
 * A flag on tasks keeps overdue work as one source of truth: a next step that
 * slips is already in the agent's queue rather than in a second list that has
 * to be reconciled with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('tasks', 'is_next_step')) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('is_next_step')->default(false)->after('priority');

            // Serves "records with no next step": the lookup is always
            // is_next_step AND still-open, never is_next_step alone.
            $table->index(['is_next_step', 'board_column_id'], 'tasks_next_step_index');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('tasks', 'is_next_step')) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex('tasks_next_step_index');
            $table->dropColumn('is_next_step');
        });
    }
};
