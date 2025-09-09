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
        if (!Schema::hasColumn('biometric_employees', 'card_number')) {
            Schema::table('biometric_employees', function (Blueprint $table) {
                $table->string('card_number')->nullable()->after('user_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('biometric_employees', 'card_number')) {
            Schema::table('biometric_employees', function (Blueprint $table) {
                $table->dropColumn('card_number');
            });
        }
    }
};
