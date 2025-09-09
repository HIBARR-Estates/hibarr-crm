<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('salary_slips', 'additional_earning_json')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->text('additional_earning_json')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {

        });
    }

};
