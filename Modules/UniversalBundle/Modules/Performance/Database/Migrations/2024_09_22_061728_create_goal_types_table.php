<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\KeyResultsMetrics;
use App\Models\Company;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('goal_types')) {
            Schema::create('goal_types', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->enum('type', ['individual', 'department', 'company'])->default('individual');
                $table->boolean('view_by_owner')->default(false);
                $table->boolean('manage_by_owner')->default(false);
                $table->boolean('view_by_manager')->default(false);
                $table->boolean('manage_by_manager')->default(false);
                $table->text('view_by_roles')->nullable();
                $table->text('manage_by_roles')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('key_results_metrics')) {
            Schema::create('key_results_metrics', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->string('name');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('objectives')) {
            Schema::create('objectives', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->string('title');
                $table->text('description')->nullable();
                $table->foreignId('goal_type')->constrained('goal_types')->onDelete('cascade')->nullable();
                $table->unsignedInteger('department_id')->nullable()->index('objectives_department_id_foreign');
                $table->foreign(['department_id'])->references(['id'])->on('teams')->onUpdate('CASCADE')->onDelete('SET NULL');
                $table->date('start_date');
                $table->date('end_date');
                $table->enum('priority', ['low', 'medium', 'high'])->default('low');
                $table->enum('check_in_frequency', ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly'])->default('weekly');
                $table->string('schedule_on')->nullable();
                $table->integer('rotation_date')->nullable();
                $table->boolean('send_check_in_reminder')->default(true);
                $table->unsignedInteger('created_by')->nullable()->index('objectives_users_id_foreign');
                $table->foreign(['created_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('SET NULL');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('objective_owners')) {
            Schema::create('objective_owners', function (Blueprint $table) {
                $table->id();
                $table->foreignId('objective_id')->constrained('objectives')->onDelete('cascade');
                $table->unsignedInteger('owner_id')->nullable();
                $table->foreign('owner_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
        if (!Schema::hasTable('key_results')) {
            Schema::create('key_results', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->foreignId('objective_id')->constrained();
                $table->string('title');
                $table->text('description')->nullable();
                $table->unsignedInteger('metrics_id')->nullable()->index('key_results_metrics_id_foreign');
                $table->float('target_value')->nullable();
                $table->float('current_value')->nullable();
                $table->float('original_current_value')->nullable();
                $table->float('key_percentage')->nullable();
                $table->date('last_check_in')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('check_ins')) {
            Schema::create('check_ins', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->foreignId('key_result_id')->constrained();
                $table->text('progress_update');
                $table->float('current_value')->nullable();
                $table->decimal('objective_percentage', 8, 2);
                $table->enum('confidence_level', ['low', 'medium', 'high'])->default('low');
                $table->text('barriers')->nullable();
                $table->dateTime('check_in_date')->nullable();
                $table->unsignedInteger('check_in_by')->nullable()->index('check_ins_users_id_foreign');
                $table->foreign(['check_in_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('SET NULL');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('objective_progress_statuses')) {
            Schema::create('objective_progress_statuses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('objective_id')->constrained('objectives')->onDelete('cascade');
                $table->decimal('objective_progress', 5, 2);
                $table->decimal('time_left_percentage', 5, 2);
                $table->enum('status', ['onTrack', 'atRisk', 'offTrack', 'completed']);
                $table->enum('color', ['success', 'warning', 'danger', 'primary']);
                $table->text('condition');
                $table->timestamps();
            });
        }

        $companies = Company::withoutGlobalScopes()->select('id')->get();

        foreach ($companies as $company) {
            $data = GoalType::defaultGoalTypes($company);
            GoalType::insert($data);

            $data = KeyResultsMetrics::defaultKeyResultsMetrics($company);
            KeyResultsMetrics::insert($data);
        }
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('objective_progress_statuses');
        Schema::dropIfExists('check_ins');
        Schema::dropIfExists('key_results');
        Schema::dropIfExists('objective_owners');
        Schema::dropIfExists('objectives');
        Schema::dropIfExists('key_results_metrics');
        Schema::dropIfExists('goal_types');
    }

};
