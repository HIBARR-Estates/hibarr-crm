<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Biolinks\Enums\BlockHoverAnimation;
use Modules\Biolinks\Enums\BlockSpacing;
use Modules\Biolinks\Enums\Font;
use Modules\Biolinks\Enums\YesNo;
use Modules\Biolinks\Enums\Status;
use Modules\Biolinks\Enums\Theme;
use Modules\Biolinks\Enums\VerifiedBadge;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('biolinks', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->string('page_link')->nullable();
            $table->integer('total_page_views')->default(0);
            $table->string('status')->default(Status::Active);
            $table->timestamps();
        });

        Schema::create('biolink_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('biolink_id')->unsigned()->nullable();
            $table->foreign('biolink_id')->references('id')->on('biolinks')->onDelete('cascade')->onUpdate('cascade');
            $table->string('theme')->default(Theme::GRADIENTA);
            $table->string('theme_color')->nullable();
            $table->string('custom_color_one')->nullable();
            $table->string('custom_color_two')->nullable();
            $table->string('favicon')->nullable();
            $table->string('font')->default(Font::ARIAL);
            $table->string('block_space')->default(BlockSpacing::MEDIUM);
            $table->string('block_hover_animation')->default(BlockHoverAnimation::NONE);
            $table->string('verified_badge')->default(VerifiedBadge::NONE);
            $table->string('display_branding')->default(YesNo::No);
            $table->string('branding_name')->nullable();
            $table->string('branding_url')->nullable();
            $table->string('branding_text_color');
            $table->string('protection_password');
            $table->string('is_sensitive')->default(YesNo::No);
            $table->string('page_title');
            $table->string('meta_description');
            $table->string('meta_keywords');
            $table->longText('custom_css');
            $table->longText('custom_js');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(['biolink', 'biolink_settings']);
    }

};
