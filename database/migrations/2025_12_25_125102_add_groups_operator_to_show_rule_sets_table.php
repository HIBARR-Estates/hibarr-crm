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
        Schema::table('show_rule_sets', function (Blueprint $table) {
            $table->enum('groups_operator', ['AND', 'OR'])->default('AND')->after('enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('show_rule_sets', function (Blueprint $table) {
            $table->dropColumn('groups_operator');
        });
    }
};
