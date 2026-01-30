<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('developer_project_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('developer_project_id')
                ->constrained('developer_projects')
                ->cascadeOnDelete();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->enum('asset_type', ['image', 'video', 'video_url'])->default('image');
            $table->string('file_path', 500)->nullable();
            $table->string('external_url', 500)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->bigInteger('file_size')->unsigned()->nullable();
            $table->json('tags')->nullable();
            $table->json('metadata')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->nullOnDelete();

            $table->index(['developer_project_id', 'asset_type']);
            $table->index('company_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('developer_project_assets');
    }
};
