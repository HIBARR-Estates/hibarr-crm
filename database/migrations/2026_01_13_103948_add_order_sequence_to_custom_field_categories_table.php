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
        Schema::table('custom_field_categories', function (Blueprint $table) {
            if (!Schema::hasColumn('custom_field_categories', 'order')) {
                $table->integer('order')->default(0)->after('custom_field_group_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_field_categories', function (Blueprint $table) {
            if (Schema::hasColumn('custom_field_categories', 'order')) {
                $table->dropColumn('order');
            }
        });
    }
};
