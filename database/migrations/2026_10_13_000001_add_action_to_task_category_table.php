<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_category', function (Blueprint $table) {
            if (! Schema::hasColumn('task_category', 'action')) {
                // Quick-action a task in this category can trigger from its row/detail
                // (e.g. "call" surfaces Call / Begin qualification). Null = none.
                $table->string('action', 32)->nullable()->after('category_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('task_category', function (Blueprint $table) {
            if (Schema::hasColumn('task_category', 'action')) {
                $table->dropColumn('action');
            }
        });
    }
};
