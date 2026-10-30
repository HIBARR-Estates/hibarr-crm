<?php

namespace Tests\Feature\Partners;

use App\Http\Controllers\LoginController;
use App\Models\Social;
use App\Models\SocialAuthSetting;
use App\Models\User;
use App\Services\PartnerInviteService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

class PartnerInviteSsoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('socials');
        Schema::dropIfExists('social_auth_settings');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('status')->default('active');
            $table->string('login')->default('enable');
            $table->string('partner_invite_status', 16)->nullable();
            $table->timestamp('partner_invited_at')->nullable();
            $table->integer('admin_approval')->nullable();
            $table->text('headers')->nullable();
            $table->text('location_details')->nullable();
            $table->timestamps();
        });

        Schema::create('socials', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->string('social_id')->nullable();
            $table->string('social_service')->nullable();
            $table->timestamps();
        });

        Schema::create('social_auth_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('keycloak_status')->default('disable');
            $table->timestamps();
        });

        SocialAuthSetting::create(['keycloak_status' => 'enable']);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_prelinked_identity_signs_in_without_email_verified(): void
    {
        $user = $this->partnerUser('kc-linked');
        $this->mockProvider($this->socialiteUser('kc-linked', false));

        $response = app(LoginController::class)->callback(Request::create('/callback', 'GET'), 'keycloak');

        $this->assertTrue($response->isRedirection());
        $this->assertTrue(Auth::check());
        $this->assertSame($user->id, Auth::id());
    }

    public function test_unlinked_identity_without_verified_email_is_rejected(): void
    {
        $this->partnerUser();
        $this->mockProvider($this->socialiteUser('kc-unknown', false));

        $response = app(LoginController::class)->callback(Request::create('/callback', 'GET'), 'keycloak');

        $this->assertTrue($response->isRedirection());
        $this->assertFalse(Auth::check());
    }

    public function test_invited_partner_is_marked_accepted_on_first_login(): void
    {
        $user = $this->partnerUser('kc-linked', PartnerInviteService::STATUS_INVITED);
        $this->mockProvider($this->socialiteUser('kc-linked', false));

        app(LoginController::class)->callback(Request::create('/callback', 'GET'), 'keycloak');

        $this->assertSame(
            PartnerInviteService::STATUS_ACCEPTED,
            User::withoutGlobalScopes()->find($user->id)->partner_invite_status
        );
    }

    private function partnerUser(?string $socialId = null, ?string $inviteStatus = null): User
    {
        $user = new User;
        $user->forceFill([
            'company_id' => 1,
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
            'password' => bcrypt('a-password-nobody-knows'),
            'status' => 'active',
            'login' => 'enable',
            'partner_invite_status' => $inviteStatus,
        ])->save();

        if ($socialId) {
            Social::create([
                'user_id' => $user->id,
                'social_id' => $socialId,
                'social_service' => 'keycloak',
            ]);
        }

        return $user->refresh();
    }

    private function mockProvider(SocialiteUser $returns): void
    {
        $driver = Mockery::mock();
        $driver->shouldReceive('stateless')->andReturnSelf();
        $driver->shouldReceive('with')->andReturnSelf();
        $driver->shouldReceive('redirect')->andReturn(redirect('https://idp.test/auth'));
        $driver->shouldReceive('user')->andReturn($returns);

        Socialite::shouldReceive('driver')->with('keycloak')->andReturn($driver);
    }

    private function socialiteUser(string $id, bool $emailVerified): SocialiteUser
    {
        $socialiteUser = new SocialiteUser;
        $socialiteUser->id = $id;
        $socialiteUser->email = 'ada@example.test';
        $socialiteUser->user = ['email_verified' => $emailVerified];

        return $socialiteUser;
    }
}
