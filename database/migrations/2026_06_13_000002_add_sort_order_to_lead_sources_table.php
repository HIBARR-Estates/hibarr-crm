<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasColumn('lead_sources', 'sort_order')) {
            Schema::table('lead_sources', function (Blueprint $table) {
                $table->integer('sort_order')->default(0)->after('type');
            });

            // Populate existing records with sequential sort_order
            $sources = DB::table('lead_sources')->orderBy('id')->get();
            $order = 1;
            foreach ($sources as $source) {
                DB::table('lead_sources')->where('id', $source->id)->update(['sort_order' => $order]);
                $order++;
            }
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        if (Schema::hasColumn('lead_sources', 'sort_order')) {
            Schema::table('lead_sources', function (Blueprint $table) {
                $table->dropColumn('sort_order');
            });
        }
    }
};
