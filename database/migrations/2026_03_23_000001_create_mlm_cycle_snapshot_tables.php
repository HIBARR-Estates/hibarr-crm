<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Snapshot of levels frozen at cycle activation
        Schema::create('mlm_cycle_level_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('cycle_id');
            $table->unsignedBigInteger('source_level_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('rank')->default(0);
            $table->unsignedDecimal('commission_percentage', 5, 2)->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('cycle_id')->references('id')->on('mlm_cycles')->cascadeOnDelete();
            $table->foreign('source_level_id')->references('id')->on('mlm_levels')->nullOnDelete();

            $table->unique(['cycle_id', 'source_level_id']);
            $table->index(['cycle_id', 'rank']);
        });

        // 2. Snapshot of level criteria frozen at cycle activation
        Schema::create('mlm_cycle_criteria_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cycle_level_snapshot_id');
            $table->unsignedInteger('logic_group')->default(1);
            $table->string('metric', 20);
            $table->string('operator', 5)->default('>=');
            $table->unsignedDecimal('threshold', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('cycle_level_snapshot_id', 'cls_criteria_snapshot_fk')
                ->references('id')->on('mlm_cycle_level_snapshots')->cascadeOnDelete();
            $table->index(['cycle_level_snapshot_id', 'logic_group'], 'cls_criteria_group_idx');
        });

        // 3. Add max_commission_snapshot to mlm_cycles
        Schema::table('mlm_cycles', function (Blueprint $table) {
            $table->unsignedDecimal('max_commission_snapshot', 5, 2)
                ->nullable()
                ->after('max_overflow_multiplier');
        });

        // 4. Add cycle_level_snapshot_id FK to mlm_commissions and agent_level_history
        Schema::table('mlm_commissions', function (Blueprint $table) {
            $table->unsignedBigInteger('cycle_level_snapshot_id')
                ->nullable()
                ->after('level_id');

            $table->foreign('cycle_level_snapshot_id', 'comm_cls_fk')
                ->references('id')->on('mlm_cycle_level_snapshots')->nullOnDelete();
        });

        Schema::table('agent_level_history', function (Blueprint $table) {
            $table->unsignedBigInteger('cycle_level_snapshot_id')
                ->nullable()
                ->after('level_id');

            $table->foreign('cycle_level_snapshot_id', 'alh_cls_fk')
                ->references('id')->on('mlm_cycle_level_snapshots')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('agent_level_history', function (Blueprint $table) {
            $table->dropForeign('alh_cls_fk');
            $table->dropColumn('cycle_level_snapshot_id');
        });

        Schema::table('mlm_commissions', function (Blueprint $table) {
            $table->dropForeign('comm_cls_fk');
            $table->dropColumn('cycle_level_snapshot_id');
        });

        Schema::table('mlm_cycles', function (Blueprint $table) {
            $table->dropColumn('max_commission_snapshot');
        });

        Schema::dropIfExists('mlm_cycle_criteria_snapshots');
        Schema::dropIfExists('mlm_cycle_level_snapshots');
    }
};
