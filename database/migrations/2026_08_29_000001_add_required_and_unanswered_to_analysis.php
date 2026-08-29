<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pipeline_analysis_script_items', function (Blueprint $table) {
            // Steps an agent must resolve before the analysis can be completed.
            $table->boolean('is_required')->default(false)->after('guide_text');
        });

        Schema::table('deals', function (Blueprint $table) {
            // Required steps the customer wouldn't answer, keyed by script item
            // ("script_<id>") -> reason. A side store rather than a sentinel written
            // into the field itself: typed columns (date, number, select) can't hold
            // "not answered", and it would pollute reporting on the real value.
            $table->json('analysis_unanswered')->nullable()->after('analysis_completed_by');
        });
    }

    public function down(): void
    {
        Schema::table('pipeline_analysis_script_items', function (Blueprint $table) {
            $table->dropColumn('is_required');
        });

        Schema::table('deals', function (Blueprint $table) {
            $table->dropColumn('analysis_unanswered');
        });
    }
};
