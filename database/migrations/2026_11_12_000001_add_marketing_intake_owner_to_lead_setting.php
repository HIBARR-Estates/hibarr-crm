<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Default lead owner for leads saved through the marketing lead flow (a user id). */
    public function up(): void
    {
        if (Schema::hasColumn('lead_setting', 'marketing_intake_owner_id')) {
            return;
        }

        Schema::table('lead_setting', function (Blueprint $table) {
            $table->unsignedInteger('marketing_intake_owner_id')->nullable()->after('marketing_intake_origin_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('lead_setting', 'marketing_intake_owner_id')) {
            return;
        }

        Schema::table('lead_setting', function (Blueprint $table) {
            $table->dropColumn('marketing_intake_owner_id');
        });
    }
};
