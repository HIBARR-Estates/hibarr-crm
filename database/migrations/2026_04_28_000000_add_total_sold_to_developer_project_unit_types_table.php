<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('developer_project_unit_types', function (Blueprint $table) {
            $table->unsignedInteger('total_sold')->nullable()->default(null)->after('quantity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('developer_project_unit_types', function (Blueprint $table) {
            $table->dropColumn('total_sold');
        });
    }
};
