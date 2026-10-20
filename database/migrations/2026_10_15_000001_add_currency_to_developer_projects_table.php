<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Existing project-level prices were entered as GBP. The column default
     * assigns that currency without changing the stored amounts.
     */
    public function up(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->string('currency', 5)->default('GBP')->after('starting_price');
        });
    }

    public function down(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
};
