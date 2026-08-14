<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads')) {
            return;
        }

        if (! Schema::hasColumn('leads', 'preferred_contact_time')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->string('preferred_contact_time')->nullable()->after('temperature');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('leads')) {
            return;
        }

        if (Schema::hasColumn('leads', 'preferred_contact_time')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropColumn('preferred_contact_time');
            });
        }
    }
};
