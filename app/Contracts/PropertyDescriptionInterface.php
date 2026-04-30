<?php

namespace App\Contracts;

interface PropertyDescriptionInterface
{
    /**
     * Generate a property description from form payload.
     *
     * @param  array<string, mixed>  $formData
     */
    public function generate(array $formData): string;
}
