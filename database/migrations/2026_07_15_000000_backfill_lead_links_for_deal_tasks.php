<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Models\Deal;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Retroactively infers a task's lead link from the deal it's connected to:
     * for every deal that has both a linked lead (deals.lead_id) and one or more
     * linked tasks, attach that lead to any of those tasks that aren't already
     * linked to a lead.
     *
     * Uses the Eloquent relations (Deal::tasks(), Task::leads(), Lead::tasks())
     * rather than raw SQL against the `taskables` pivot so the correct
     * `taskable_type` morph value is always used, whatever format it's stored in.
     */
    public function up(): void
    {
        if (!Schema::hasTable('taskables') || !Schema::hasTable('deals') || !Schema::hasColumn('deals', 'lead_id')) {
            return;
        }

        Deal::withoutGlobalScopes()
            ->whereNotNull('lead_id')
            ->has('tasks')
            ->with(['tasks', 'contact'])
            ->chunkById(200, function ($deals) {
                foreach ($deals as $deal) {
                    $lead = $deal->contact;
                    if (!$lead) {
                        continue;
                    }

                    foreach ($deal->tasks as $task) {
                        if ($task->leads()->doesntExist()) {
                            $lead->tasks()->syncWithoutDetaching([$task->id]);
                        }
                    }
                }
            });
    }

    /**
     * Reverse the migrations.
     *
     * Best-effort only: we can't distinguish leads that were auto-inferred by
     * this migration from ones a user explicitly linked afterwards, so this
     * intentionally does not attempt to undo the backfill.
     */
    public function down(): void
    {
        // No-op: see note above.
    }
};
