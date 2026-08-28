<?php

use App\Models\DealFollowUp;
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
        if (! Schema::hasColumn('lead_follow_up', 'host_id')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                // User "in charge of" the meeting. Distinct from `participants`
                // (JSON attendee list) and from `added_by` (who created the row).
                // Immutable after creation — DealController::updateFollow never
                // reads or writes this column.
                $table->unsignedInteger('host_id')->nullable()->after('added_by');
                $table->foreign('host_id')->references('id')->on('users')->onDelete('set null');
            });
        }

        $this->backfillHostId();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('lead_follow_up', 'host_id')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropForeign(['host_id']);
                $table->dropColumn('host_id');
            });
        }
    }

    /**
     * Backfill existing rows with the same deal-agent/lead-owner resolution
     * DealFollowUp::assignedAgentUserId() uses, falling back to the row's
     * creator so no meeting is ever left without a host going forward.
     */
    private function backfillHostId(): void
    {
        if (! Schema::hasTable('lead_follow_up')) {
            return;
        }

        DealFollowUp::query()
            ->whereNull('host_id')
            ->with(['deal.leadAgent', 'lead'])
            ->chunkById(200, function ($followUps) {
                foreach ($followUps as $followUp) {
                    $hostId = $followUp->assignedAgentUserId() ?? $followUp->added_by;

                    if ($hostId) {
                        $followUp->updateQuietly(['host_id' => $hostId]);
                    }
                }
            });
    }
};
