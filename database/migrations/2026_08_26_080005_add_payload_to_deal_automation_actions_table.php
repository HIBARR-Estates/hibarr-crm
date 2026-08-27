<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->json('payload')->nullable()->after('field_value');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropColumn('payload');
        });
    }
};
