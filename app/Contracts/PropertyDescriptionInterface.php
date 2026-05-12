<?php

namespace App\Contracts;

interface PropertyDescriptionInterface
{
    /**
     * Generate a description from form payload.
     *
     * @param  array<string, mixed>  $formData
     */
    public function generate(array $formData, ?string $featureContext = null): string;
}
