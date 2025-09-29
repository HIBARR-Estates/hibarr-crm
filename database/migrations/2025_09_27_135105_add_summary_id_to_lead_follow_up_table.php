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
        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->unsignedBigInteger('summary_id')->nullable()->after('meeting_id');
            $table->foreign('summary_id')->references('id')->on('meeting_summary')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropForeign(['summary_id']);
            $table->dropColumn('summary_id');
        });
    }
};
