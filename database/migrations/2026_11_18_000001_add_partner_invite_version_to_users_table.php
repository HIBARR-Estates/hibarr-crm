<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A counter bumped by every invite-status change. The Partners roster compares
 * it to tell an older response from a newer one: updated_at is hidden from the
 * browser and only accurate to the second.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'partner_invite_version')) {
                $table->unsignedInteger('partner_invite_version')->default(0)->after('partner_invited_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'partner_invite_version')) {
                $table->dropColumn('partner_invite_version');
            }
        });
    }
};
