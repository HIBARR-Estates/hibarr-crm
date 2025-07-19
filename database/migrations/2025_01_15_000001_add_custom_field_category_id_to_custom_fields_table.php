<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->unsignedInteger('custom_field_category_id')->nullable()->after('custom_field_group_id');
            $table->foreign('custom_field_category_id')->references('id')->on('custom_field_categories')->onDelete('set null')->onUpdate('cascade');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->dropForeign(['custom_field_category_id']);
            $table->dropColumn('custom_field_category_id');
        });
    }
}; 