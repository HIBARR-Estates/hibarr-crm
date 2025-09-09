<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Biolinks\Enums\Alignment;
use Modules\Biolinks\Enums\BorderRadius;
use Modules\Biolinks\Enums\BorderStyle;
use Modules\Biolinks\Enums\ObjectFit;
use Modules\Biolinks\Enums\Status;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('biolink_blocks', function (Blueprint $table) {
            $table->id();
            $table->integer('biolink_id')->unsigned()->nullable();
            $table->foreign('biolink_id')->references('id')->on('biolinks')->onDelete('cascade')->onUpdate('cascade');
            $table->string('type');
            $table->string('name')->nullable();
            $table->text('url')->nullable();
            $table->boolean('open_in_new_tab')->default(false);
            $table->string('text_color')->nullable()->default('#000000');
            $table->string('text_alignment')->nullable()->default(Alignment::CENTER);
            $table->string('background_color')->nullable()->default('#FFFFFF');
            $table->string('animation')->nullable();
            $table->string('heading_type')->nullable();
            $table->text('paragraph')->nullable();
            $table->string('image')->nullable();
            $table->string('image_alt')->nullable();
            $table->string('avatar_size')->nullable();
            $table->string('object_fit')->default(ObjectFit::COVER);
            $table->string('border_radius')->default(BorderRadius::STRAIGHT);
            $table->string('border_width')->nullable()->default('0');
            $table->string('border_color')->nullable()->default('#000000');
            $table->string('border_style')->default(BorderStyle::SOLID);
            $table->string('border_shadow_x')->nullable()->default('0');
            $table->string('border_shadow_y')->nullable()->default('0');
            $table->string('border_shadow_blur')->nullable()->default('20');
            $table->string('border_shadow_spread')->nullable()->default('0');
            $table->string('border_shadow_color')->nullable()->default('#00000010');
            $table->string('status')->default(Status::Active);
            $table->integer('position')->nullable();
            $table->string('icon_size')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('telegram')->nullable();
            $table->string('whatsapp')->nullable();
            $table->string('facebook')->nullable();
            $table->string('instagram')->nullable();
            $table->string('twitter')->nullable();
            $table->string('youtube')->nullable();
            $table->string('linkedin')->nullable();
            $table->string('discord')->nullable();
            $table->string('snapchat')->nullable();
            $table->string('pinterest')->nullable();
            $table->string('reddit')->nullable();
            $table->string('tiktok')->nullable();
            $table->string('spotify')->nullable();
            $table->string('threads')->nullable();
            $table->string('twitch')->nullable();
            $table->string('address')->nullable();
            $table->string('paypal_type')->nullable();
            $table->string('product_title')->nullable();
            $table->string('currency_code')->nullable();
            $table->integer('price')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('biolink_blocks');
    }

};
