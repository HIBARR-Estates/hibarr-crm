<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'can_receive_calls')) {
            Schema::table('users', function (Blueprint $table) {
                $column = $table->boolean('can_receive_calls')->default(true);
                if (Schema::hasColumn('users', 'status')) {
                    $column->after('status');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'can_receive_calls')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('can_receive_calls');
            });
        }
    }
};
