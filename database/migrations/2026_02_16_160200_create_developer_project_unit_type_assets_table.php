<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('developer_project_unit_type_assets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('unit_type_id');
            $table->unsignedInteger('company_id');

            $table->string('name')->nullable();
            $table->string('asset_type', 20)->default('image'); // image, video, video_url
            $table->string('file_path')->nullable();
            $table->string('external_url', 2048)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->json('tags')->nullable(); // ["cover","interior","exterior","floor-plan","gallery"]
            $table->json('metadata')->nullable();
            $table->unsignedInteger('order')->default(0);

            $table->timestamps();

            // Foreign keys
            $table->foreign('unit_type_id')
                ->references('id')->on('developer_project_unit_types')
                ->onDelete('cascade');

            $table->foreign('company_id')
                ->references('id')->on('companies')
                ->onDelete('cascade');

            // Indexes
            $table->index(['unit_type_id', 'asset_type'], 'dput_asset_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('developer_project_unit_type_assets');
    }
};
