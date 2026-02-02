<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Models\TaskboardColumn;
use App\Models\Task;
use App\Models\Company;

return new class extends Migration
{
    /**
     * Status mapping from old to new slugs
     */
    private array $slugMapping = [
        'incomplete' => 'to_do',      // Merge into to_do
        'to_do' => 'to_do',           // Keep as to_do
        'doing' => 'in_progress',     // Rename to in_progress
        'waiting_approval' => 'in_review', // Rename to in_review
        'completed' => 'done',        // Rename to done
    ];

    private array $newStatuses = [
        ['slug' => 'to_do', 'column_name' => 'To Do', 'label_color' => '#f5c308', 'priority' => 1],
        ['slug' => 'in_progress', 'column_name' => 'In Progress', 'label_color' => '#00b5ff', 'priority' => 2],
        ['slug' => 'in_review', 'column_name' => 'In Review', 'label_color' => '#9b59b6', 'priority' => 3],
        ['slug' => 'on_hold', 'column_name' => 'On Hold', 'label_color' => '#f39c12', 'priority' => 4],
        ['slug' => 'done', 'column_name' => 'Done', 'label_color' => '#679c0d', 'priority' => 5],
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Process each company
        $companies = Company::all();

        foreach ($companies as $company) {
            $this->migrateCompanyStatuses($company);
        }

        // Update tasks.status ENUM field - expand to include new values
        // First add new values while keeping old ones for compatibility
        DB::statement("ALTER TABLE tasks MODIFY COLUMN status ENUM('incomplete', 'completed', 'to_do', 'in_progress', 'in_review', 'on_hold', 'done') DEFAULT 'to_do'");

        // Update existing task status values
        DB::table('tasks')->where('status', 'incomplete')->update(['status' => 'to_do']);
        DB::table('tasks')->where('status', 'completed')->update(['status' => 'done']);

        // Now remove old values from ENUM
        DB::statement("ALTER TABLE tasks MODIFY COLUMN status ENUM('to_do', 'in_progress', 'in_review', 'on_hold', 'done') DEFAULT 'to_do'");
    }

    /**
     * Migrate statuses for a single company
     */
    private function migrateCompanyStatuses(Company $company): void
    {
        // Get all current columns for this company indexed by slug
        $currentColumns = TaskboardColumn::where('company_id', $company->id)
            ->get()
            ->keyBy('slug');

        // Track the default status column ID to update later if needed
        $oldDefaultStatusId = $company->default_task_status;
        $newDefaultStatusId = null;

        // Step 1: Handle the "incomplete" to "to_do" merge
        $incompleteColumn = $currentColumns->get('incomplete');
        $toDoColumn = $currentColumns->get('to_do');

        if ($incompleteColumn && $toDoColumn) {
            // Move all tasks from incomplete to to_do
            Task::where('board_column_id', $incompleteColumn->id)
                ->update(['board_column_id' => $toDoColumn->id]);

            // If default was incomplete, update company FIRST before deleting column
            if ($oldDefaultStatusId == $incompleteColumn->id) {
                $newDefaultStatusId = $toDoColumn->id;
                // Update company default status BEFORE deleting to avoid FK constraint
                $company->default_task_status = $newDefaultStatusId;
                $company->saveQuietly();
            }

            // Now safe to delete the incomplete column
            $incompleteColumn->delete();

            // Update to_do column properties
            $toDoColumn->update([
                'column_name' => 'To Do',
                'priority' => 1,
            ]);
        } elseif ($incompleteColumn && !$toDoColumn) {
            // Only incomplete exists, rename it to to_do
            $incompleteColumn->update([
                'column_name' => 'To Do',
                'slug' => 'to_do',
                'priority' => 1,
            ]);

            if ($oldDefaultStatusId == $incompleteColumn->id) {
                $newDefaultStatusId = $incompleteColumn->id; // Same ID, just renamed
            }
        } elseif ($toDoColumn) {
            // Only to_do exists, just ensure correct properties
            $toDoColumn->update([
                'column_name' => 'To Do',
                'priority' => 1,
            ]);
        }

        // Step 2: Rename "doing" to "in_progress"
        $doingColumn = $currentColumns->get('doing');
        if ($doingColumn) {
            $doingColumn->update([
                'column_name' => 'In Progress',
                'slug' => 'in_progress',
                'priority' => 2,
            ]);
        }

        // Step 3: Rename "waiting_approval" to "in_review"
        $waitingApprovalColumn = $currentColumns->get('waiting_approval');
        if ($waitingApprovalColumn) {
            $waitingApprovalColumn->update([
                'column_name' => 'In Review',
                'slug' => 'in_review',
                'label_color' => '#9b59b6', // Update color to purple
                'priority' => 3,
            ]);
        }

        // Step 4: Create "on_hold" column (new status)
        $onHoldExists = TaskboardColumn::where('company_id', $company->id)
            ->where('slug', 'on_hold')
            ->exists();

        if (!$onHoldExists) {
            TaskboardColumn::create([
                'company_id' => $company->id,
                'column_name' => 'On Hold',
                'slug' => 'on_hold',
                'label_color' => '#f39c12',
                'priority' => 4,
            ]);
        }

        // Step 5: Rename "completed" to "done"
        $completedColumn = $currentColumns->get('completed');
        if ($completedColumn) {
            $completedColumn->update([
                'column_name' => 'Done',
                'slug' => 'done',
                'priority' => 5,
            ]);
        }

        // Update company's default task status if it was changed
        if ($newDefaultStatusId !== null) {
            $company->default_task_status = $newDefaultStatusId;
            $company->saveQuietly();
        }

        // Ensure default points to to_do if current default no longer exists
        $defaultColumn = TaskboardColumn::find($company->default_task_status);
        if (!$defaultColumn) {
            $toDoColumn = TaskboardColumn::where('company_id', $company->id)
                ->where('slug', 'to_do')
                ->first();
            if ($toDoColumn) {
                $company->default_task_status = $toDoColumn->id;
                $company->saveQuietly();
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Process each company
        $companies = Company::all();

        foreach ($companies as $company) {
            $this->rollbackCompanyStatuses($company);
        }

        // Revert task status values
        DB::statement("ALTER TABLE tasks MODIFY COLUMN status ENUM('to_do', 'in_progress', 'in_review', 'on_hold', 'done', 'incomplete', 'completed') DEFAULT 'incomplete'");

        DB::table('tasks')->where('status', 'to_do')->update(['status' => 'incomplete']);
        DB::table('tasks')->where('status', 'done')->update(['status' => 'completed']);

        // Revert ENUM to original values
        DB::statement("ALTER TABLE tasks MODIFY COLUMN status ENUM('incomplete', 'completed') DEFAULT 'incomplete'");
    }

    /**
     * Rollback statuses for a single company
     */
    private function rollbackCompanyStatuses(Company $company): void
    {
        // Rename in_progress back to doing
        TaskboardColumn::where('company_id', $company->id)
            ->where('slug', 'in_progress')
            ->update([
                'column_name' => 'Doing',
                'slug' => 'doing',
                'priority' => 3,
            ]);

        // Rename in_review back to waiting_approval
        TaskboardColumn::where('company_id', $company->id)
            ->where('slug', 'in_review')
            ->update([
                'column_name' => 'Waiting Approval',
                'slug' => 'waiting_approval',
                'label_color' => '#000',
                'priority' => 5,
            ]);

        // Rename done back to completed
        TaskboardColumn::where('company_id', $company->id)
            ->where('slug', 'done')
            ->update([
                'column_name' => 'Completed',
                'slug' => 'completed',
                'priority' => 4,
            ]);

        // Delete on_hold column
        TaskboardColumn::where('company_id', $company->id)
            ->where('slug', 'on_hold')
            ->delete();

        // Recreate incomplete column
        $incompleteExists = TaskboardColumn::where('company_id', $company->id)
            ->where('slug', 'incomplete')
            ->exists();

        if (!$incompleteExists) {
            $incompleteColumn = TaskboardColumn::create([
                'company_id' => $company->id,
                'column_name' => 'Incomplete',
                'slug' => 'incomplete',
                'label_color' => '#d21010',
                'priority' => 1,
            ]);

            // Move to_do tasks to incomplete and rename to_do column
            $toDoColumn = TaskboardColumn::where('company_id', $company->id)
                ->where('slug', 'to_do')
                ->first();

            if ($toDoColumn) {
                $toDoColumn->update(['priority' => 2]);
            }

            // Update default status to incomplete
            $company->default_task_status = $incompleteColumn->id;
            $company->saveQuietly();
        }
    }
};
