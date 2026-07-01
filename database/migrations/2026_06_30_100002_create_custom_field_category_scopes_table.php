<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custom_field_category_scopes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('category_id')->references('id')->on('custom_field_categories')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('pipeline_stage_id')->references('id')->on('pipeline_stages')->onDelete('cascade')->onUpdate('cascade');

            $table->unique(['category_id', 'pipeline_id', 'pipeline_stage_id'], 'cfc_scope_unique');
        });

        if (Schema::hasTable('custom_field_category_pipeline')) {
            $rows = DB::table('custom_field_category_pipeline')->get();
            foreach ($rows as $row) {
                $companyId = DB::table('lead_pipelines')->where('id', $row->pipeline_id)->value('company_id');
                DB::table('custom_field_category_scopes')->insert([
                    'company_id' => $companyId,
                    'category_id' => $row->category_id,
                    'pipeline_id' => $row->pipeline_id,
                    'pipeline_stage_id' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_field_category_scopes');
    }
};
