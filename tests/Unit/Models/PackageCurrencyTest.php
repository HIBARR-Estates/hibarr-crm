<?php

namespace Tests\Unit\Models;

use App\Grpc\Services\PackageGrpcService;
use App\Grpc\Transformers\PackageTransformer;
use App\Models\Package;
use Database\Seeders\PackageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class PackageCurrencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_currency_is_fillable(): void
    {
        $this->assertContains('currency', (new Package())->getFillable());
    }

    public function test_packages_table_has_currency_column_with_eur_default(): void
    {
        $this->assertTrue(Schema::hasColumn('packages', 'currency'));

        $package = Package::create([
            'name' => 'Currency Default Test',
            'value' => 100,
            'company_id' => 1,
        ]);

        $package->refresh();

        $this->assertSame('EUR', $package->currency);
    }

    public function test_package_seeder_sets_currency_eur_for_all_default_packages(): void
    {
        $this->seed(PackageSeeder::class);

        $expectedNames = [
            'Basic',
            'Bank',
            'Inspection',
            'Asset Protection',
            'Legal Service',
        ];

        $packages = Package::withoutGlobalScopes()
            ->where('company_id', 1)
            ->whereIn('name', $expectedNames)
            ->get();

        $this->assertCount(5, $packages);

        foreach ($packages as $package) {
            $this->assertSame('EUR', $package->currency, "Package {$package->name} should be EUR");
        }
    }

    public function test_transformer_defaults_null_currency_to_eur(): void
    {
        $package = new Package([
            'name' => 'Null Currency',
            'value' => 10,
        ]);
        $package->currency = null;

        $transformed = (new PackageTransformer())->transform($package);

        $this->assertSame('EUR', $transformed['currency']);
    }

    public function test_transformer_passes_through_explicit_currency(): void
    {
        $package = new Package([
            'name' => 'USD Package',
            'value' => 10,
            'currency' => 'USD',
        ]);

        $transformed = (new PackageTransformer())->transform($package);

        $this->assertSame('USD', $transformed['currency']);
    }

    public function test_grpc_build_message_defaults_null_currency_to_eur(): void
    {
        if (!class_exists(\App\Grpc\Generated\Package\Package::class)
            || !method_exists(\App\Grpc\Generated\Package\Package::class, 'setCurrency')) {
            $this->markTestSkipped('Generated Package gRPC message with setCurrency is not available. Run `make proto`.');
        }

        $package = new Package([
            'name' => 'Null Currency',
            'value' => 10,
        ]);
        $package->id = 1;
        $package->currency = null;

        $service = new PackageGrpcService();
        $method = new ReflectionMethod(PackageGrpcService::class, 'buildMessage');
        $method->setAccessible(true);

        $message = $method->invoke($service, $package);

        $this->assertSame('EUR', $message->getCurrency());
    }

    public function test_grpc_build_message_passes_through_explicit_currency(): void
    {
        if (!class_exists(\App\Grpc\Generated\Package\Package::class)
            || !method_exists(\App\Grpc\Generated\Package\Package::class, 'setCurrency')) {
            $this->markTestSkipped('Generated Package gRPC message with setCurrency is not available. Run `make proto`.');
        }

        $package = new Package([
            'name' => 'USD Package',
            'value' => 10,
            'currency' => 'USD',
        ]);
        $package->id = 2;

        $service = new PackageGrpcService();
        $method = new ReflectionMethod(PackageGrpcService::class, 'buildMessage');
        $method->setAccessible(true);

        $message = $method->invoke($service, $package);

        $this->assertSame('USD', $message->getCurrency());
    }
}
