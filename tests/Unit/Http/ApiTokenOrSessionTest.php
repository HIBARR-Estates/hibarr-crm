<?php

namespace Tests\Unit\Http;

use App\Http\Middleware\ApiTokenOrSession;
use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ApiTokenOrSessionTest extends TestCase
{
    public function test_signed_in_user_passes_acting_for_their_own_company(): void
    {
        $request = $this->request(['HTTP_X_COMPANY_ID' => '9']);
        $request->setUserResolver(fn () => $this->user(['status' => 'active', 'login' => 'enable']));

        $response = $this->handle($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('5', $response->getContent());
    }

    public function test_anonymous_request_without_a_token_is_rejected(): void
    {
        $this->ensureApiTokensTable();

        $this->assertSame(401, $this->handle($this->request(['HTTP_X_COMPANY_ID' => '9']))->getStatusCode());
    }

    public function test_deactivated_session_user_needs_a_token(): void
    {
        $this->ensureApiTokensTable();

        $request = $this->request(['HTTP_X_COMPANY_ID' => '9']);
        $request->setUserResolver(fn () => $this->user(['status' => 'deactive', 'login' => 'enable']));

        $this->assertSame(401, $this->handle($request)->getStatusCode());
    }

    public function test_valid_api_token_is_accepted_for_its_company(): void
    {
        $this->ensureApiTokensTable();

        DB::table('api_tokens')->insert([
            'token' => ApiToken::hashToken('test-token'),
            'name' => 'Test Token',
            'company_id' => 3,
            'permissions' => json_encode([]),
            'unrestricted' => true,
            'revoked' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->handle($this->request(['HTTP_X_API_TOKEN' => 'test-token']));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('3', $response->getContent());
    }

    private function handle(Request $request)
    {
        return app(ApiTokenOrSession::class)
            ->handle($request, fn (Request $request) => response((string) $request->header('X-COMPANY-ID')));
    }

    private function request(array $server): Request
    {
        return Request::create('/api/v1/crm-events', 'GET', [], [], [], $server);
    }

    private function user(array $attributes): User
    {
        $user = new User();
        $user->setRawAttributes(array_merge(['id' => 1, 'company_id' => 5], $attributes));

        return $user;
    }

    private function ensureApiTokensTable(): void
    {
        if (Schema::hasTable('api_tokens')) {
            return;
        }

        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->json('permissions')->nullable();
            $table->boolean('unrestricted')->default(false);
            $table->boolean('revoked')->default(false);
            $table->timestamps();
        });
    }
}
