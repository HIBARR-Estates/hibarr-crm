<?php

namespace App\Enums;

enum DealPackageMode: string
{
    case Single = 'single';
    case Multiple = 'multiple';

    public function allowsMultiplePackages(): bool
    {
        return $this === self::Multiple;
    }

    public function allowsPipelineRouting(): bool
    {
        return $this === self::Single;
    }
}
