<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('softphone_call_agents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->index();
            $table->unsignedBigInteger('user_id')->unique();
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('active')->default(true);
            $table->unsignedBigInteger('added_by')->nullable();
            $table->unsignedBigInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        // Backfill existing users who already hold make_softphone_calls.
        $userIds = DB::table('user_permissions')
            ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
            ->where('permissions.name', 'make_softphone_calls')
            ->pluck('user_permissions.user_id');

        foreach ($userIds as $userId) {
            $companyId = DB::table('users')->where('id', $userId)->value('company_id');
            if (empty($companyId)) {
                continue;
            }
            DB::table('softphone_call_agents')->insertOrIgnore([
                'company_id' => $companyId,
                'user_id' => $userId,
                'priority' => 100,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('softphone_call_agents');
    }
};
