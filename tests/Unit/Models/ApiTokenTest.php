<?php

namespace Tests\Unit\Models;

use App\Models\ApiToken;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ApiTokenTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (!Schema::hasTable('api_tokens')) {
            Schema::create('api_tokens', function (Blueprint $table) {
                $table->id();
                $table->string('token', 64)->unique();
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name');
                $table->json('permissions')->nullable();
                $table->boolean('revoked')->default(false);
                $table->timestamps();
            });
        }
    }

    public function test_find_by_plain_token_matches_hashed_storage(): void
    {
        $plainToken = ApiToken::generatePlainToken();

        DB::table('api_tokens')->insert([
            'token' => ApiToken::hashToken($plainToken),
            'name' => 'Lookup Test Token',
            'permissions' => json_encode([]),
            'revoked' => false,
            'company_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $found = ApiToken::findByPlainToken($plainToken, 1);

        $this->assertNotNull($found);
        $this->assertSame(ApiToken::hashToken($plainToken), $found->token);
    }

    public function test_find_by_plain_token_does_not_match_legacy_plaintext_storage(): void
    {
        $plainToken = ApiToken::generatePlainToken();

        DB::table('api_tokens')->insert([
            'token' => $plainToken,
            'name' => 'Legacy Plaintext Token',
            'permissions' => json_encode([]),
            'revoked' => false,
            'company_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertNull(ApiToken::findByPlainToken($plainToken, 1));
    }

    public function test_is_stored_plaintext_token_detects_legacy_values(): void
    {
        $this->assertTrue(ApiToken::isStoredPlaintextToken(ApiToken::generatePlainToken()));
        $this->assertFalse(ApiToken::isStoredPlaintextToken(ApiToken::hashToken('hib_example')));
    }
}
