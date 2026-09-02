<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Splits "commission has been distributed for this deal" from "this deal is
 * fully frozen" (is_locked). A deal can be commission_locked (value can no
 * longer change, because a commission was already calculated against it)
 * while still being fully editable otherwise — stage, agent, notes — right up
 * until something separately marks it is_locked as finally complete.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (! Schema::hasColumn('deals', 'commission_locked')) {
                $table->boolean('commission_locked')->default(false)->after('is_locked');
            }
            if (! Schema::hasColumn('deals', 'commission_locked_at')) {
                $table->timestamp('commission_locked_at')->nullable()->after('commission_locked');
            }
        });
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            foreach (['commission_locked_at', 'commission_locked'] as $column) {
                if (Schema::hasColumn('deals', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
