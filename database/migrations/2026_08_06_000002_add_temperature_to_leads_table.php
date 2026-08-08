<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        if (!Schema::hasColumn('leads', 'temperature')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->string('temperature')->nullable()->after('gender');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        if (Schema::hasColumn('leads', 'temperature')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropColumn('temperature');
            });
        }
    }
};
