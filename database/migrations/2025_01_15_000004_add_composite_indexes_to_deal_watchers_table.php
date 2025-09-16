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
        Schema::table('deal_watchers', function (Blueprint $table) {
            $table->index(['deal_id', 'user_id'], 'dw_deal_user_idx');
            $table->index(['user_id', 'deal_id'], 'dw_user_deal_idx');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('deal_watchers', function (Blueprint $table) {
            $table->dropIndex('dw_deal_user_idx');
            $table->dropIndex('dw_user_deal_idx');
        });
    }
};
