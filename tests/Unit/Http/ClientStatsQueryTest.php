<?php

namespace Tests\Unit\Http;

use App\Http\Controllers\ClientController;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ClientStatsQueryTest extends TestCase
{
    public function test_client_id_is_passed_as_a_binding_not_concatenated(): void
    {
        // The event carries the SQL as sent to PDO; the pretend log substitutes bindings back in.
        $executed = [];
        DB::listen(function (QueryExecuted $query) use (&$executed) {
            $executed[] = $query;
        });

        DB::pretend(fn () => (new ClientController())->clientStats('7 or 1=1'));

        $this->assertCount(1, $executed);
        $this->assertStringNotContainsString('1=1', $executed[0]->sql);
        $this->assertStringNotContainsString('7', $executed[0]->sql);
        $this->assertSame([7, 7, 7, 7, 7, 7], $executed[0]->bindings);
    }
}
