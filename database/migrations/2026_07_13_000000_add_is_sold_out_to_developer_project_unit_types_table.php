<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('developer_project_unit_types', function (Blueprint $table) {
            $table->boolean('is_sold_out')->default(false)->after('total_sold');
        });
    }

    public function down(): void
    {
        Schema::table('developer_project_unit_types', function (Blueprint $table) {
            $table->dropColumn('is_sold_out');
        });
    }
};
