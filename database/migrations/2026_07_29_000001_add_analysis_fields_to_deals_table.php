<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (!Schema::hasColumn('deals', 'analysis_status')) {
                $table->string('analysis_status')->default('pending')->after('outcome_status');
            }
            if (!Schema::hasColumn('deals', 'analysis_completed_at')) {
                $table->timestamp('analysis_completed_at')->nullable()->after('analysis_status');
            }
            if (!Schema::hasColumn('deals', 'analysis_completed_by')) {
                $table->unsignedInteger('analysis_completed_by')->nullable()->after('analysis_completed_at');
            }
        });

        // Fix column type if it was created as bigint (from a failed first run)
        DB::statement("ALTER TABLE `deals` MODIFY `analysis_completed_by` INT UNSIGNED NULL");

        // Add FK if not already present
        $existingFKs = collect(DB::select("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY'"))->pluck('CONSTRAINT_NAME');

        if (!$existingFKs->contains('deals_analysis_completed_by_foreign')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->foreign('analysis_completed_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->dropForeign(['analysis_completed_by']);
            $table->dropColumn(['analysis_status', 'analysis_completed_at', 'analysis_completed_by']);
        });
    }
};
