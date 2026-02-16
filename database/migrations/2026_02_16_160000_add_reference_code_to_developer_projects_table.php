<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->string('reference_code', 50)->nullable()->after('name');
            $table->unique(['company_id', 'reference_code'], 'dev_proj_company_ref_unique');
        });
    }

    public function down(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->dropUnique('dev_proj_company_ref_unique');
            $table->dropColumn('reference_code');
        });
    }
};
