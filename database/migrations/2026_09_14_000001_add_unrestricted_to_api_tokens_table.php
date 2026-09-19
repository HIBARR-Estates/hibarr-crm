<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * API tokens used to get full access whenever they carried no scopes. Full
 * access is now an explicit `unrestricted` flag and a token without scopes
 * reaches nothing. Tokens that relied on the old default keep their access by
 * getting the flag set here.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('api_tokens')) {
            return;
        }

        if (! Schema::hasColumn('api_tokens', 'unrestricted')) {
            Schema::table('api_tokens', function (Blueprint $table) {
                $table->boolean('unrestricted')->default(false)->after('permissions');
            });
        }

        DB::table('api_tokens')->select(['id', 'permissions'])->chunkById(200, function ($tokens) {
            $ids = $tokens
                ->filter(fn ($token) => $this->hadImplicitFullAccess($token->permissions))
                ->pluck('id');

            if ($ids->isNotEmpty()) {
                DB::table('api_tokens')->whereIn('id', $ids)->update(['unrestricted' => true]);
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('api_tokens') && Schema::hasColumn('api_tokens', 'unrestricted')) {
            Schema::table('api_tokens', function (Blueprint $table) {
                $table->dropColumn('unrestricted');
            });
        }
    }

    /**
     * The old rule, as ApiTokenAuth applied it through the model's array cast:
     * NULL, JSON null, [] and {"scopes": [] | null} all meant full access.
     */
    private function hadImplicitFullAccess(?string $permissions): bool
    {
        if ($permissions === null) {
            return true;
        }

        $decoded = json_decode($permissions, true);

        // Malformed JSON never meant full access under the old rule — it fell
        // through normalizeScopes() to an empty scope list, same as any other
        // non-array value.
        if (json_last_error() !== JSON_ERROR_NONE) {
            return false;
        }

        if ($decoded === null) {
            return true;
        }

        if (! is_array($decoded)) {
            return false;
        }

        if (array_key_exists('scopes', $decoded)) {
            return $decoded['scopes'] === null || $decoded['scopes'] === [];
        }

        return $decoded === [];
    }
};
