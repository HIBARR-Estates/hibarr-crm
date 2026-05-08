<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expose_jobs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('user_id');
            // entity_type: 'property' | 'developer_project' | 'unit_type'
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id');
            // sub_entity_id: used for unit_type (stores unitTypeId; entity_id stores projectId)
            $table->unsignedBigInteger('sub_entity_id')->nullable();
            // status: queued | processing | ready | failed
            $table->string('status')->default('queued');
            $table->string('filename');
            $table->string('download_url', 2048)->nullable();
            $table->string('object_path', 2048)->nullable();
            $table->json('payload'); // client_name, client_email, layout, etc.
            $table->text('error_message')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expose_jobs');
    }
};
