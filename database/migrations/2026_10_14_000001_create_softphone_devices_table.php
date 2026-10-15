<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('softphone_devices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->index();
            // Human label for the line, e.g. "German", "Swedish".
            $table->string('label');
            // sipgate Neo WebRTC endpoint for this channel.
            $table->string('wss_url');
            $table->string('uri');
            $table->string('authorization_username')->nullable();
            $table->text('authorization_password'); // encrypted at rest
            $table->string('display_name')->nullable();
            $table->boolean('is_default')->default(false);
            $table->unsignedBigInteger('added_by')->nullable();
            $table->unsignedBigInteger('last_updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('softphone_devices');
    }
};
