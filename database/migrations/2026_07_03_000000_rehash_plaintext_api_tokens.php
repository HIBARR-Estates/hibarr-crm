<?php

use App\Models\ApiToken;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('api_tokens')
            ->select(['id', 'token'])
            ->orderBy('id')
            ->each(function ($row) {
                $storedToken = (string) $row->token;

                if (!ApiToken::isStoredPlaintextToken($storedToken)) {
                    return;
                }

                DB::table('api_tokens')
                    ->where('id', $row->id)
                    ->update(['token' => ApiToken::hashToken($storedToken)]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Hashed tokens cannot be restored to their original plaintext values.
    }
};
