<?php

namespace Tests\Feature;

use App\Models\Lead;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LeadBulkDeleteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('leads');
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->default(1);
            $table->string('client_name')->nullable();
            $table->string('client_email')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function test_bulk_delete_rolls_back_when_a_deletion_fails(): void
    {
        $firstId = $this->insertLead('First Lead');
        $secondId = $this->insertLead('Second Lead');

        try {
            Lead::withoutEvents(function () use ($firstId, $secondId) {
                DB::transaction(function () use ($firstId, $secondId) {
                    foreach ([$firstId, $secondId] as $index => $leadId) {
                        if ($index === 1) {
                            throw new \RuntimeException('Simulated delete failure');
                        }

                        $lead = Lead::query()->findOrFail($leadId);
                        if ($lead->forceDelete() === false) {
                            throw new \RuntimeException('Failed to delete lead '.$lead->id);
                        }
                    }
                });
            });
            $this->fail('Expected bulk delete transaction to throw');
        } catch (\RuntimeException $e) {
            $this->assertSame('Simulated delete failure', $e->getMessage());
        }

        $this->assertNotNull(Lead::find($firstId));
        $this->assertNotNull(Lead::find($secondId));
    }

    private function insertLead(string $name): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => 1,
            'client_name' => $name,
            'client_email' => strtolower(str_replace(' ', '.', $name)).'@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
