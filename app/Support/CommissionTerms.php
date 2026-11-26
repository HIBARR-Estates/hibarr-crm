<?php

namespace App\Support;

use App\Enums\PackageCommissionType;

/**
 * One commission rule: a percentage of some base, a fixed amount, or nothing.
 *
 * Packages, per-agent package overrides, a partner's referral terms and a deal's
 * own referral override all state their rule in this one shape (the
 * PackageCommissionType + value pair), and all of them turn it into money here.
 * Where two of them overlap, such as an agent who is both the closer and the
 * referrer on one package, they therefore round, ignore a stray value and treat
 * "none" the same way.
 */
final class CommissionTerms
{
    private function __construct(
        public readonly PackageCommissionType $type,
        public readonly ?float $value,
    ) {}

    /**
     * The rule these columns state, or null when they state none. A percentage or
     * fixed amount with no value is not a rule, and "none" never carries a value.
     */
    public static function make(PackageCommissionType|string|null $type, mixed $value): ?self
    {
        if ($type === null || $type === '') {
            return null;
        }

        $type = $type instanceof PackageCommissionType ? $type : PackageCommissionType::tryFrom($type);

        if ($type === null) {
            return null;
        }

        if ($type === PackageCommissionType::None) {
            return new self($type, null);
        }

        if ($value === null || $value === '') {
            return null;
        }

        return new self($type, (float) $value);
    }

    /** Explicitly pays nothing, as opposed to stating no rule at all. */
    public function isNone(): bool
    {
        return $this->type === PackageCommissionType::None;
    }

    public function isPercentage(): bool
    {
        return $this->type === PackageCommissionType::Percentage;
    }

    /** The rate when this is a percentage, else null: a fixed amount has no rate. */
    public function percentage(): ?float
    {
        return $this->isPercentage() ? $this->value : null;
    }

    /**
     * What these terms pay. A percentage is taken from $percentageBase; a fixed
     * amount ignores it and is already in the currency it pays out in.
     */
    public function amount(float $percentageBase): float
    {
        return match ($this->type) {
            PackageCommissionType::Percentage => round($percentageBase * ($this->value / 100), 2),
            PackageCommissionType::Fixed => round((float) $this->value, 2),
            PackageCommissionType::None => 0.0,
        };
    }
}
