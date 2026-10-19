<?php

namespace Tests\Unit\Support;

use App\Models\Deal;
use App\Models\Lead;
use App\Support\PolymorphicModelType;
use PHPUnit\Framework\TestCase;

class PolymorphicModelTypeTest extends TestCase
{
    /**
     * The exact value found in crm_events.model_type in production. Its
     * singular `Model` namespace and lowercase class name meant the row never
     * matched the `where('model_type', App\Models\Lead::class)` filter the entity
     * timeline uses, so lead call events were written but never displayed.
     */
    public function test_it_canonicalises_the_singular_namespace_lowercase_form(): void
    {
        $this->assertSame(Lead::class, PolymorphicModelType::canonicalize('App\\Model\\lead'));
    }

    public function test_it_canonicalises_the_known_malformed_spellings(): void
    {
        foreach (['App\\Model\\lead', 'App\\Models\\Lead', 'App\\\\Models\\\\Lead', 'App/Models/Lead', 'AppModelsLead', 'app\\models\\lead'] as $variant) {
            $this->assertSame(Lead::class, PolymorphicModelType::canonicalize($variant), "Failed for: {$variant}");
        }
    }

    public function test_it_canonicalises_deals_and_tasks(): void
    {
        $this->assertSame(Deal::class, PolymorphicModelType::canonicalize('App\\Model\\deal'));
        $this->assertSame(\App\Models\Task::class, PolymorphicModelType::canonicalize('App/Models/Task'));
    }

    public function test_it_leaves_unknown_classes_untouched(): void
    {
        // Not one of ours — pass through rather than guess a rewrite.
        $this->assertSame('Domain\\Some\\Model', PolymorphicModelType::canonicalize('Domain\\Some\\Model'));
    }

    public function test_it_maps_empty_values_to_null(): void
    {
        $this->assertNull(PolymorphicModelType::canonicalize(null));
        $this->assertNull(PolymorphicModelType::canonicalize(''));
        $this->assertNull(PolymorphicModelType::canonicalize('   '));
    }
}