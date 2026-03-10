<?php

namespace App\Enums;

enum MlmMetric: string
{
    case Nsa = 'nsa';
    case Nsd = 'nsd';
    case Vsa = 'vsa';
    case Vsd = 'vsd';
    case NsaNsd = 'nsa_nsd';
    case VsaVsd = 'vsa_vsd';

    /**
     * Resolve the metric value from an AgentMetric model.
     */
    public function resolveValue(object $metrics): float
    {
        return match ($this) {
            self::Nsa => (float) $metrics->nsa,
            self::Nsd => (float) $metrics->nsd,
            self::Vsa => (float) $metrics->vsa,
            self::Vsd => (float) $metrics->vsd,
            self::NsaNsd => (float) ($metrics->nsa + $metrics->nsd),
            self::VsaVsd => (float) ($metrics->vsa + $metrics->vsd),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Nsa => 'Number of Sales by Agent',
            self::Nsd => 'Number of Sales by Downlines',
            self::Vsa => 'Value of Sales by Agent',
            self::Vsd => 'Value of Sales by Downlines',
            self::NsaNsd => 'Total Sales Count (Agent + Downlines)',
            self::VsaVsd => 'Total Sales Value (Agent + Downlines)',
        };
    }

    public static function toArray(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
