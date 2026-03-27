<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offerables', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('offerable_type');
            $table->timestamp('disabled_at')->nullable()->after('is_active');
            $table->unsignedInteger('disabled_by')->nullable()->after('disabled_at');

            $table->foreign('disabled_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('offerables', function (Blueprint $table) {
            $table->dropForeign(['disabled_by']);
            $table->dropColumn(['is_active', 'disabled_at', 'disabled_by']);
        });
    }
};
