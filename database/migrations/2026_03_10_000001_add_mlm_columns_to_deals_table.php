<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->string('outcome_status', 20)->nullable()->after('pipeline_stage_id');
            $table->boolean('is_locked')->default(false)->after('outcome_status');
            $table->timestamp('locked_at')->nullable()->after('is_locked');
            $table->unsignedDecimal('max_commission_percentage', 5, 2)->nullable()->after('locked_at');

            $table->index('outcome_status');
            $table->index('is_locked');
        });
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->dropIndex(['outcome_status']);
            $table->dropIndex(['is_locked']);
            $table->dropColumn(['outcome_status', 'is_locked', 'locked_at', 'max_commission_percentage']);
        });
    }
};
