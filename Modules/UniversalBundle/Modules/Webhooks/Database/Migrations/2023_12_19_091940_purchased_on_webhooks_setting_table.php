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

        Schema::whenTableDoesntHaveColumn('webhooks_global_settings', 'purchased_on', function (Blueprint $table) {
            $table->timestamp('purchased_on')->nullable()->after('supported_until');
        });
    }

};
