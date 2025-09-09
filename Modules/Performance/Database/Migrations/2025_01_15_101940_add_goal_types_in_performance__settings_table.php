<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Modules\Performance\Entities\GoalType;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            // Check if there are already entries for each type
            $existingTypes = GoalType::where('company_id', $company->id)
                ->pluck('type')
                ->toArray();

            $data = [];

            // Define the types to check and insert if not present
            $typesToInsert = ['individual', 'department', 'company'];

            foreach ($typesToInsert as $type) {
                if (!in_array($type, $existingTypes)) {
                    $data[] = [
                        'company_id' => $company->id,
                        'type' => $type,
                        'view_by_owner' => 1,
                        'manage_by_owner' => 1,
                        'view_by_manager' => 0,
                        'manage_by_manager' => 0,
                        'view_by_roles' => json_encode([]),
                        'manage_by_roles' => json_encode([]),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            // Insert data only if there are new entries to add
            if (!empty($data)) {
                GoalType::insert($data);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No action needed for rollback in this case
    }

};
