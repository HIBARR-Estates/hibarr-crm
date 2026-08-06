<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expose_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('token_hash', 64)->unique();
            $table->string('token_prefix', 16);
            // property | developer_project | unit_type
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id');
            // unit type id when entity_type = unit_type (entity_id = project id)
            $table->unsignedBigInteger('sub_entity_id')->nullable();
            $table->unsignedBigInteger('agent_user_id');
            $table->unsignedBigInteger('lead_id');
            $table->string('layout')->nullable();
            $table->json('request_payload');
            $table->json('agent_snapshot');
            $table->json('lead_snapshot');
            $table->json('expose_payload');
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->json('warnings')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'lead_id', 'created_at'], 'expose_snapshots_company_lead_created_idx');
            $table->index(['company_id', 'agent_user_id', 'created_at'], 'expose_snapshots_company_agent_created_idx');
            $table->index(['company_id', 'entity_type', 'entity_id'], 'expose_snapshots_company_entity_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expose_snapshots');
    }
};
