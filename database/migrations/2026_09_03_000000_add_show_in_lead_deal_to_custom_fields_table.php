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
        Schema::table('custom_fields', function (Blueprint $table) {
            // Cross-population toggles for FILE fields, read on the *other*
            // module's page than the one the field is defined on — each is
            // only ever surfaced in the UI for a field on the module it
            // doesn't name (a Lead field's "show_in_deal", a Deal field's
            // "show_in_lead"); the field's own module always shows it and
            // needs no toggle.
            //
            // Different defaults on purpose: show_in_deal defaults true so
            // an existing Lead file field already gated by pipeline (see
            // the "Show for pipeline(s)" picker) keeps cross-populating to
            // matching deals unchanged. show_in_lead defaults false because
            // this migration is what *introduces* Deal-field-to-Lead
            // cross-population — defaulting it true would make every
            // existing Deal file field suddenly appear on its lead's Files
            // tab the moment this ships.
            if (!Schema::hasColumn('custom_fields', 'show_in_lead')) {
                $table->boolean('show_in_lead')->default(false)->after('display_config');
            }
            if (!Schema::hasColumn('custom_fields', 'show_in_deal')) {
                $table->boolean('show_in_deal')->default(true)->after('show_in_lead');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            if (Schema::hasColumn('custom_fields', 'show_in_deal')) {
                $table->dropColumn('show_in_deal');
            }
            if (Schema::hasColumn('custom_fields', 'show_in_lead')) {
                $table->dropColumn('show_in_lead');
            }
        });
    }
};
