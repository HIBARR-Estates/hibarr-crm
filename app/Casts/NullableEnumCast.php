<?php

namespace App\Casts;

use BackedEnum;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use UnitEnum;

/**
 * Enum cast that treats empty/null/invalid backing values as null
 * instead of throwing (e.g. legacy rows with salutation = '').
 *
 * @template TEnum of BackedEnum
 */
class NullableEnumCast implements CastsAttributes
{
    /**
     * @param  class-string<TEnum&BackedEnum>  $enumClass
     */
    public function __construct(protected string $enumClass)
    {
    }

    public function get(Model $model, string $key, mixed $value, array $attributes): ?BackedEnum
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof $this->enumClass) {
            return $value;
        }

        return $this->enumClass::tryFrom($value);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof UnitEnum) {
            if (! $value instanceof $this->enumClass) {
                throw new InvalidArgumentException(
                    "Value for {$key} must be an instance of {$this->enumClass}."
                );
            }

            /** @var BackedEnum $value */
            return (string) $value->value;
        }

        $enum = $this->enumClass::tryFrom($value);

        return $enum?->value;
    }
}
