<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('email_conversations')) {
            Schema::create('email_conversations', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->unsignedInteger('company_id');
                $table->timestamps();

                $table->foreign('company_id')
                    ->references('id')
                    ->on('companies')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');
            });
        }

        if (! Schema::hasColumn('email_messages', 'conversation_id')) {
            Schema::table('email_messages', function (Blueprint $table) {
                // Set from the reply graph (Message-ID / In-Reply-To / References), never from the subject.
                $table->unsignedBigInteger('conversation_id')->nullable()->after('company_id');

                $table->foreign('conversation_id', 'email_messages_conversation_foreign')
                    ->references('id')
                    ->on('email_conversations')
                    ->onDelete('set null')
                    ->onUpdate('cascade');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('email_messages', 'conversation_id')) {
            Schema::table('email_messages', function (Blueprint $table) {
                $table->dropForeign('email_messages_conversation_foreign');
                $table->dropColumn('conversation_id');
            });
        }

        Schema::dropIfExists('email_conversations');
    }
};
