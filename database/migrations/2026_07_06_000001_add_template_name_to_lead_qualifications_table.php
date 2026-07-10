<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('lead_qualifications')) {
            return;
        }

        if (Schema::hasColumn('lead_qualifications', 'template_name')) {
            return;
        }

        Schema::table('lead_qualifications', function (Blueprint $table) {
            $table->string('template_name')->nullable()->after('template_version');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('lead_qualifications')) {
            return;
        }

        if (!Schema::hasColumn('lead_qualifications', 'template_name')) {
            return;
        }

        Schema::table('lead_qualifications', function (Blueprint $table) {
            $table->dropColumn('template_name');
        });
    }
};
