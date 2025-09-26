<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Enums\ResolutionStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('communication_activities', function (Blueprint $table) {
            //
            $table->string('resolution_status')->nullable()->default(ResolutionStatus::Pending)->after('channel_type'); // resolved, unresolved, pending
            $table->integer('resolution_attempts')->default(0)->after('resolution_status');
            $table->timestamp('last_resolution_attempt_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('communication_activities', function (Blueprint $table) {
            //
            $table->dropColumn(['resolution_status', 'resolution_attempts', 'last_resolution_attempt_at']);
        });
    }
};
