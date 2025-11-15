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
        Schema::table('communication_activities', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_activity_id')->nullable()->after('lead_id');
            $table->foreign('parent_activity_id')->references('id')->on('communication_activities')->onDelete('cascade');
            $table->index('parent_activity_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('communication_activities', function (Blueprint $table) {
            $table->dropForeign(['parent_activity_id']);
            $table->dropIndex(['parent_activity_id']);
            $table->dropColumn('parent_activity_id');
        });
    }
};