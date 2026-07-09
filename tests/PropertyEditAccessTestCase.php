<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

abstract class PropertyEditAccessTestCase extends TestCase
{
    protected int $companyId = 1;

    protected int $creatorId = 1;

    protected int $responsibleAgentId = 2;

    protected int $requesterId = 3;

    protected int $propertyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createSchema();
        $this->seedData();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('property_watchers');
        Schema::dropIfExists('property_collaborators');
        Schema::dropIfExists('property_edit_access_requests');
        Schema::dropIfExists('properties');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    protected function createSchema(): void
    {
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
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable();
            $table->text('payload')->nullable();
            $table->integer('last_activity')->nullable();
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('responsible_agent_id')->nullable();
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('status')->nullable();
            $table->json('owner_info')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('property_edit_access_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedInteger('requesting_agent_id');
            $table->unsignedInteger('responsible_agent_id');
            $table->unsignedInteger('company_id');
            $table->string('status', 20)->default('pending');
            $table->text('message')->nullable();
            $table->text('response_message')->nullable();
            $table->unsignedInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('property_collaborators', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedInteger('user_id');
            $table->timestamp('granted_at');
            $table->string('granted_via', 30)->default('access_request');
            $table->unsignedInteger('granted_by')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->unsignedInteger('revoked_by')->nullable();
            $table->timestamps();
        });

        Schema::create('property_watchers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedInteger('user_id');
            $table->string('added_via', 20)->default('manual');
            $table->timestamps();
        });
    }

    protected function seedData(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([
            $this->creatorId => 'Creator',
            $this->responsibleAgentId => 'Responsible Agent',
            $this->requesterId => 'Requester',
        ] as $id => $name) {
            DB::table('users')->insert([
                'id' => $id,
                'company_id' => $this->companyId,
                'name' => $name,
                'email' => "user{$id}@example.com",
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('properties')->insert([
            'id' => $this->propertyId,
            'company_id' => $this->companyId,
            'added_by' => $this->creatorId,
            'responsible_agent_id' => $this->responsibleAgentId,
            'title' => 'Test Property',
            'description' => 'Original description',
            'status' => 'Available',
            'owner_info' => json_encode(['full_name' => 'Owner']),
            'is_published' => true,
            'published_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function actingAsUser(int $userId): void
    {
        $user = \App\Models\User::withoutGlobalScopes()->find($userId);
        session(['user' => $user]);
    }
}
