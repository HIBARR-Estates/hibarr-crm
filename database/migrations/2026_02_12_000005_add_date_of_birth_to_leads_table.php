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
        if (!Schema::hasColumn('leads', 'date_of_birth')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->date('date_of_birth')->nullable()->after('gender');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('leads', 'date_of_birth')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropColumn('date_of_birth');
            });
        }
    }
};
