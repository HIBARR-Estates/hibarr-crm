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
        Schema::table('deal_automations', function (Blueprint $table) {
            $table->unsignedInteger('wait_duration_value')->nullable()->after('date_recurrence');
            $table->string('wait_duration_unit', 20)->nullable()->after('wait_duration_value');
        });

        // Rows here are created when a triggered automation has a wait
        // configured and its conditions passed — actions execute later from
        // deal-automations:process-pending-runs once run_at is due. One row
        // per automation+subject at a time (unique index) so repeated saves
        // on the same record can't stack duplicate delayed runs.
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
            $table->unique(['deal_automation_id', 'subject_type', 'subject_id']);
            $table->index('run_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deal_automation_pending_runs');

        Schema::table('deal_automations', function (Blueprint $table) {
            $table->dropColumn(['wait_duration_value', 'wait_duration_unit']);
        });
    }
};
