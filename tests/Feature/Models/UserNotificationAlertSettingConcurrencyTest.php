<?php

namespace Tests\Feature\Models;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class UserNotificationAlertSettingConcurrencyTest extends TestCase
{
    private string $databasePath;

    private string $barrierPath;

    private string $workerScriptPath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->databasePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'notification-alert-settings-' . uniqid('', true) . '.sqlite';
        $this->barrierPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'notification-alert-settings-' . uniqid('', true) . '.barrier';
        $this->workerScriptPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'notification-alert-settings-worker-' . uniqid('', true) . '.php';

        touch($this->databasePath);

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', $this->databasePath);
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('user_notification_alert_settings');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
        });

        Schema::create('user_notification_alert_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id')->unique();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('notch_position', 20)->default('top-center');
            $table->unsignedSmallInteger('notch_duration_ms')->default(4200);
            $table->boolean('alerts_muted')->default(false);
            $table->timestamps();
        });

        DB::table('users')->insert([
            'id' => 1,
            'company_id' => 1,
            'name' => 'Test User',
            'email' => 'user@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        file_put_contents($this->workerScriptPath, $this->workerScript());
    }

    protected function tearDown(): void
    {
        @unlink($this->workerScriptPath);
        @unlink($this->barrierPath);
        @unlink($this->databasePath);

        parent::tearDown();
    }

    public function test_simultaneous_first_writes_merge_without_losing_defaults_or_peer_updates(): void
    {
        $processes = [
            $this->startWorker(['notch_position' => 'bottom-right']),
            $this->startWorker(['alerts_muted' => true]),
        ];

        file_put_contents($this->barrierPath, 'go');

        foreach ($processes as $process) {
            $process->wait();

            $this->assertTrue(
                $process->isSuccessful(),
                "Worker failed: " . $process->getErrorOutput() . $process->getOutput(),
            );
        }

        $setting = DB::table('user_notification_alert_settings')->where('user_id', 1)->first();

        $this->assertNotNull($setting);
        $this->assertSame('bottom-right', $setting->notch_position);
        $this->assertSame(4200, (int) $setting->notch_duration_ms);
        $this->assertTrue((bool) $setting->alerts_muted);
        $this->assertSame(1, DB::table('user_notification_alert_settings')->count());
    }

    private function startWorker(array $payload): Process
    {
        $process = new Process([
            PHP_BINARY,
            $this->workerScriptPath,
        ], base_path(), [
            'APP_BASE_PATH' => base_path(),
            'DB_PATH' => $this->databasePath,
            'BARRIER_FILE' => $this->barrierPath,
            'PAYLOAD_JSON' => json_encode($payload, JSON_THROW_ON_ERROR),
        ]);

        $process->start();

        return $process;
    }

    private function workerScript(): string
    {
        $repoRoot = var_export(base_path(), true);

        return <<<'PHP'
<?php

$repoRoot = getenv('APP_BASE_PATH') ?: %s; 
$dbPath = getenv('DB_PATH') ?: '';
$barrierFile = getenv('BARRIER_FILE') ?: '';
$payload = json_decode(getenv('PAYLOAD_JSON') ?: '{}', true);

require $repoRoot . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';

$app = require $repoRoot . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

config()->set('database.default', 'sqlite');
config()->set('database.connections.sqlite.database', $dbPath);

\Illuminate\Support\Facades\DB::purge('sqlite');
\Illuminate\Support\Facades\DB::reconnect('sqlite');

while (! file_exists($barrierFile)) {
    usleep(10000);
    clearstatcache(false, $barrierFile);
}

\App\Models\UserNotificationAlertSetting::upsertForUser(1, is_array($payload) ? $payload : []);

PHP;

        return sprintf($script, $repoRoot);
    }
}
