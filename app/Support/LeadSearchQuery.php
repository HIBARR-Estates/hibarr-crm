<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Shared lead list search helpers (Inertia index, form-data, deal gathering, etc.).
 */
class LeadSearchQuery
{
    /**
     * Match a free-text search term against leads.mobile, including JSON phone
     * parts (countryCode/country_code, areaCode, phoneNumber/phone) and digit-only
     * concatenations for antd-phone-input and legacy stored formats.
     *
     * Plain-string mobiles (e.g. "+41…") are matched via LIKE / digit stripping only;
     * JSON paths are guarded with JSON_VALID so MySQL does not error on non-JSON rows.
     *
     * @param  Builder<\App\Models\Lead>  $query
     */
    public static function applyMobileMatch(
        Builder $query,
        string $search,
        string $column = 'mobile',
    ): void {
        $term = '%' . $search . '%';
        $digits = preg_replace('/\D+/', '', $search) ?? '';
        $digitTerm = $digits !== '' ? '%' . $digits . '%' : null;

        $query->orWhere($column, 'like', $term);

        if (! self::supportsJsonMobileSearch()) {
            if ($digitTerm !== null) {
                $query->orWhereRaw(self::stripNonDigitsSql($column) . ' LIKE ?', [$digitTerm]);
            }

            return;
        }

        foreach (['countryCode', 'country_code', 'areaCode', 'phoneNumber', 'phone'] as $path) {
            $query->orWhereRaw(
                self::jsonExtractSql($column, $path) . ' LIKE ?',
                [$term],
            );
        }

        if ($digitTerm === null) {
            return;
        }

        $query->orWhereRaw(
            self::jsonConcatSql(
                $column,
                [
                    self::jsonExtractSql($column, 'countryCode'),
                    self::jsonExtractSql($column, 'areaCode'),
                    self::jsonExtractSql($column, 'phoneNumber'),
                ],
            ) . ' LIKE ?',
            [$digitTerm],
        );

        $query->orWhereRaw(
            self::jsonConcatSql(
                $column,
                [
                    self::jsonExtractSql($column, 'country_code'),
                    self::stripNonDigitsSql(self::jsonExtractSql($column, 'phone')),
                ],
            ) . ' LIKE ?',
            [$digitTerm],
        );

        $query->orWhereRaw(self::stripNonDigitsSql($column) . ' LIKE ?', [$digitTerm]);
    }

    private static function supportsJsonMobileSearch(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'sqlite'], true);
    }

    private static function jsonExtractSql(string $column, string $path): string
    {
        $jsonPath = '$.' . $path;

        return match (DB::connection()->getDriverName()) {
            'mysql' => "IF(JSON_VALID({$column}), JSON_UNQUOTE(JSON_EXTRACT({$column}, '{$jsonPath}')), NULL)",
            'sqlite' => "CASE WHEN json_valid({$column}) THEN json_extract({$column}, '{$jsonPath}') ELSE NULL END",
            default => 'NULL',
        };
    }

    /**
     * @param  list<string>  $parts
     */
    private static function jsonConcatSql(string $column, array $parts): string
    {
        $concat = 'CONCAT(' . implode(', ', array_map(
            fn (string $part) => "COALESCE({$part}, '')",
            $parts,
        )) . ')';

        return match (DB::connection()->getDriverName()) {
            'mysql' => "IF(JSON_VALID({$column}), {$concat}, NULL)",
            'sqlite' => "CASE WHEN json_valid({$column}) THEN {$concat} ELSE NULL END",
            default => 'NULL',
        };
    }

    private static function stripNonDigitsSql(string $column): string
    {
        return "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE({$column}, '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')";
    }
}
