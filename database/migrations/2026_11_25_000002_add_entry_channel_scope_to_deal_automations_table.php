<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            // lead_entry_received trigger scope: the channels (by OL uuid, so renames and
            // re-parenting never break an automation) the automation fires for. NULL / empty =
            // every channel. With descendants on (the default), a channel also covers
            // everything below it.
            $table->json('entry_channel_uuids')->nullable()->after('meeting_type_ids');
            $table->boolean('entry_channel_include_descendants')->default(true)->after('entry_channel_uuids');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            $table->dropColumn(['entry_channel_uuids', 'entry_channel_include_descendants']);
        });
    }
};
