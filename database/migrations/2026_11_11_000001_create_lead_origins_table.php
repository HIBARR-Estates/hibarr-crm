<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lead origin: which team or channel brought a lead into the CRM (Marketing,
 * and whatever else a company adds in Lead settings). Separate from the lead
 * source, which names the campaign or channel the person came through.
 *
 * Existing leads are not backfilled; their origin stays empty. Each company
 * gets a "Marketing" option, which the marketing lead flow stamps by default.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lead_origins')) {
            Schema::create('lead_origins', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->integer('sort_order')->default(0);
                $table->unsignedInteger('added_by')->nullable();
                $table->unsignedInteger('last_updated_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name'], 'lead_origins_company_name_unique');
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
                $table->foreign('added_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('last_updated_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('leads', 'lead_origin_id')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->foreignId('lead_origin_id')->nullable()->after('source_id')
                    ->constrained('lead_origins')->nullOnDelete();
            });
        }

        Schema::table('lead_setting', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_setting', 'marketing_intake_department_ids')) {
                // Departments (teams) whose members may use the marketing lead flow.
                $table->json('marketing_intake_department_ids')->nullable();
            }
            if (! Schema::hasColumn('lead_setting', 'marketing_intake_origin_id')) {
                // The origin that flow stamps; null falls back to "Marketing".
                $table->unsignedBigInteger('marketing_intake_origin_id')->nullable();
            }
        });

        $now = now();
        foreach (DB::table('companies')->pluck('id') as $companyId) {
            $exists = DB::table('lead_origins')
                ->where('company_id', $companyId)
                ->where('name', 'Marketing')
                ->exists();

            if (! $exists) {
                DB::table('lead_origins')->insert([
                    'company_id' => $companyId,
                    'name' => 'Marketing',
                    'sort_order' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('lead_setting', function (Blueprint $table) {
            foreach (['marketing_intake_department_ids', 'marketing_intake_origin_id'] as $column) {
                if (Schema::hasColumn('lead_setting', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        if (Schema::hasColumn('leads', 'lead_origin_id')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropConstrainedForeignId('lead_origin_id');
            });
        }

        Schema::dropIfExists('lead_origins');
    }
};
