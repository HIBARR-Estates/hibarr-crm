<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_routing_triggers', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('package_id');
            $table->string('field_key', 100);
            $table->string('match_value', 500)->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('package_id')->references('id')->on('packages')->onDelete('cascade')->onUpdate('cascade');
            $table->unique(['package_id', 'field_key']);
        });

        if (Schema::hasTable('companies') && !Schema::hasColumn('companies', 'package_pipeline_routing_trigger_fields')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->json('package_pipeline_routing_trigger_fields')->nullable()->after('deal_package_mode');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('companies', 'package_pipeline_routing_trigger_fields')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->dropColumn('package_pipeline_routing_trigger_fields');
            });
        }

        Schema::dropIfExists('package_routing_triggers');
    }
};
