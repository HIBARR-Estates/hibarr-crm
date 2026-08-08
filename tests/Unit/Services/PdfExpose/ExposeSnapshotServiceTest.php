<?php

namespace Tests\Unit\Services\PdfExpose;

use App\Models\ExposeSnapshot;
use App\Models\Lead;
use App\Models\User;
use App\Services\PdfExpose\ExposeGeneratorService;
use App\Services\PdfExpose\ExposeSnapshotService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ExposeSnapshotServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureMinimalPeopleSchema();
    }

    public function test_generate_plain_token_uses_exp_prefix_and_hashes_deterministically(): void
    {
        $plain = ExposeSnapshot::generatePlainToken();

        $this->assertStringStartsWith('exp_', $plain);
        $this->assertSame(4 + 48, strlen($plain));
        $this->assertSame(hash('sha256', $plain), ExposeSnapshot::hashToken($plain));
        $this->assertSame(substr($plain, 0, 12), ExposeSnapshot::tokenPrefix($plain));
        $this->assertNotSame($plain, ExposeSnapshot::hashToken($plain));
    }

    public function test_agent_and_lead_snapshot_mappers_include_ids_and_names(): void
    {
        $agentId = (int) \DB::table('users')->insertGetId([
            'company_id' => 1,
            'name' => 'Jane Agent',
            'email' => 'jane@example.com',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leadId = (int) \DB::table('leads')->insertGetId([
            'company_id' => 1,
            'client_name' => 'Ada Lovelace',
            'client_email' => 'ada@example.com',
            'company_name' => 'Analytical Engines',
            'mobile' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $agent = User::withoutGlobalScopes()->findOrFail($agentId);
        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);

        $service = new ExposeSnapshotService(
            $this->createMock(ExposeGeneratorService::class)
        );

        $agentSnapshot = $this->invokePrivate($service, 'buildAgentSnapshot', [
            $agent,
            [
                'name' => 'Jane Agent',
                'email' => 'jane@example.com',
                'phone' => '+49123',
                'position' => 'Sales',
                'image' => null,
            ],
        ]);

        $leadSnapshot = $this->invokePrivate($service, 'buildLeadSnapshot', [$lead]);

        $this->assertSame($agentId, $agentSnapshot['id']);
        $this->assertSame('Jane Agent', $agentSnapshot['name']);
        $this->assertSame('jane@example.com', $agentSnapshot['email']);
        $this->assertSame('Sales', $agentSnapshot['position']);

        $this->assertSame($leadId, $leadSnapshot['id']);
        $this->assertSame('Ada Lovelace', $leadSnapshot['name']);
        $this->assertSame('ada@example.com', $leadSnapshot['email']);
        $this->assertSame('Analytical Engines', $leadSnapshot['company_name']);
    }

    /**
     * @param  list<mixed>  $args
     */
    private function invokePrivate(object $target, string $method, array $args = []): mixed
    {
        $ref = new \ReflectionMethod($target, $method);
        $ref->setAccessible(true);

        return $ref->invokeArgs($target, $args);
    }

    private function ensureMinimalPeopleSchema(): void
    {
        if (!Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->unsignedInteger('user_id')->nullable();
                $table->text('payload')->nullable();
                $table->integer('last_activity')->nullable();
            });
        }

        if (!Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->string('status')->default('active');
                $table->unsignedInteger('is_client_contact')->nullable();
                $table->string('image')->nullable();
                $table->string('mobile')->nullable();
                $table->string('salutation')->nullable();
                $table->timestamps();
            });
        } else {
            \DB::table('users')->delete();
        }

        if (!Schema::hasTable('leads')) {
            Schema::create('leads', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('client_name')->nullable();
                $table->string('client_email')->nullable();
                $table->string('company_name')->nullable();
                $table->string('mobile')->nullable();
                $table->string('salutation')->nullable();
                $table->string('office')->nullable();
                $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable();
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            \DB::table('leads')->delete();
        }
    }
}
