<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Invitations now expire (UserInvitation::EXPIRY_DAYS, 7 days from sending)
 * and are single-use. Existing invites were never given an expiry and their
 * codes were derived from sha1(time . inviter id), so give each the same
 * 7-day life counted from when it was sent: old links stop working now and
 * recent ones keep only their remaining days.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_invitations')) {
            return;
        }

        if (! Schema::hasColumn('user_invitations', 'expires_at')) {
            Schema::table('user_invitations', function (Blueprint $table) {
                $table->timestamp('expires_at')->nullable()->after('status');
            });
        }

        DB::table('user_invitations')
            ->whereNull('expires_at')
            ->select(['id', 'created_at'])
            ->chunkById(200, function ($invites) {
                foreach ($invites as $invite) {
                    DB::table('user_invitations')->where('id', $invite->id)->update([
                        'expires_at' => $invite->created_at ? Carbon::parse($invite->created_at)->addDays(7) : now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasTable('user_invitations') && Schema::hasColumn('user_invitations', 'expires_at')) {
            Schema::table('user_invitations', function (Blueprint $table) {
                $table->dropColumn('expires_at');
            });
        }
    }
};
