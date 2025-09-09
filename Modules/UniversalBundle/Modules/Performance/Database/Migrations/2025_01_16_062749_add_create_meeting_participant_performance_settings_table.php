<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\KeyResultsMetrics;
use Modules\Performance\Entities\PerformanceSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('performance_settings', function (Blueprint $table) {
            $table->boolean('create_meeting_participant')->default(false)->after('create_meeting_manager');
        });

        $meetingSeetings = PerformanceSetting::all();

        foreach ($meetingSeetings as $meetingSeeting) {
            $meetingSeeting->create_meeting_participant = 1;
            $meetingSeeting->view_meeting_manager = 1;
            $meetingSeeting->view_meeting_participant = 1;
            $meetingSeeting->save();
        }

        $companies = Company::all();

        foreach ($companies as $company) {
            // Check if there are already entries for each metrics
            $existingMetrics = KeyResultsMetrics::where('company_id', $company->id)
                ->pluck('name')
                ->toArray();

            $data = [];

            // Define the types to check and insert if not present
            $metrics = ['Percentage', 'Revenue', 'Units'];

            foreach ($metrics as $metric) {
                if (!in_array($metric, $existingMetrics)) {
                    $data[] = [
                        'company_id' => $company->id,
                        'name' => $metric,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            // Insert data only if there are new entries to add
            if (!empty($data)) {
                KeyResultsMetrics::insert($data);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
