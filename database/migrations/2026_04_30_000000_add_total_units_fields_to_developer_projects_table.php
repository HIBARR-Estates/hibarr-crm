<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->unsignedInteger('total_units')->nullable()->default(0)->after('number_of_units');
            $table->unsignedInteger('total_units_sold')->nullable()->default(0)->after('total_units');
        });
    }

    public function down(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->dropColumn(['total_units', 'total_units_sold']);
        });
    }
};
