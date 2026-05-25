<?php

namespace App\Services;

use App\Enums\OutcomeStatus;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class CrmEventDescriptionBuilder
{
    public static function dealValueUpdated(
        null|float|int|string $from,
        null|float|int|string $to,
        null|int|string $currency = null
    ): string {
        return 'Deal value updated from ' . self::formatCurrency($from, $currency) . ' to ' . self::formatCurrency($to, $currency);
    }

    public static function dealTitleRenamed(?string $from, ?string $to): string
    {
        return 'Deal title renamed from "' . self::safeText($from) . '" to "' . self::safeText($to) . '"';
    }

    public static function dealCloseDateChanged(CarbonInterface|string|null $from, CarbonInterface|string|null $to): string
    {
        return 'Deal close date changed from ' . self::formatDate($from) . ' to ' . self::formatDate($to);
    }

    public static function dealAgentAssigned(?string $fromName, ?string $toName): string
    {
        return 'Deal agent changed from ' . self::safeText($fromName) . ' to ' . self::safeText($toName);
    }

    public static function dealStageChanged(?string $fromStage, ?string $toStage): string
    {
        return 'Deal stage changed from ' . self::safeText($fromStage) . ' to ' . self::safeText($toStage);
    }

    public static function dealPipelineChanged(?string $fromPipeline, ?string $toPipeline): string
    {
        return 'Deal pipeline changed from ' . self::safeText($fromPipeline) . ' to ' . self::safeText($toPipeline);
    }

    public static function dealStatusChanged(?string $fromStatus, ?string $toStatus): string
    {
        return 'Deal status changed from ' . self::safeText($fromStatus) . ' to ' . self::safeText($toStatus);
    }

    public static function dealClientChanged(?string $fromClient, ?string $toClient): string
    {
        return 'Deal client changed from ' . self::safeText($fromClient) . ' to ' . self::safeText($toClient);
    }

    public static function dealSourceChanged(?string $fromSource, ?string $toSource): string
    {
        return 'Deal source changed from ' . self::safeText($fromSource) . ' to ' . self::safeText($toSource);
    }

    public static function dealOutcomeChanged(OutcomeStatus|string|null $from, OutcomeStatus|string|null $to): string
    {
        return 'Deal outcome changed from ' . self::formatOutcome($from) . ' to ' . self::formatOutcome($to);
    }

    public static function formatDate(CarbonInterface|string|null $date): string
    {
        if (!$date) {
            return '--';
        }

        try {
            if ($date instanceof CarbonInterface) {
                return $date->format('M d, Y H:i');
            }

            return Carbon::parse($date)->format('M d, Y H:i');
        } catch (\Throwable) {
            return '--';
        }
    }

    public static function formatCurrency(
        null|float|int|string $amount,
        null|int|string $currency = null
    ): string {
        if ($amount === null || $amount === '') {
            return '--';
        }

        $numericAmount = (float) $amount;

        // Prefer the application's canonical currency formatter when a currency id is available.
        if (is_numeric($currency) && function_exists('currency_format')) {
            try {
                return (string) currency_format($numericAmount, (int) $currency);
            } catch (\Throwable) {
                // Fall through to local formatting.
            }
        }

        $formattedAmount = number_format($numericAmount, 2, '.', ',');
        $formattedAmount = rtrim(rtrim($formattedAmount, '0'), '.');

        if (is_string($currency) && trim($currency) !== '' && !is_numeric($currency)) {
            return strtoupper($currency) . ' ' . $formattedAmount;
        }

        return $formattedAmount;
    }

    private static function formatOutcome(OutcomeStatus|string|null $status): string
    {
        if ($status instanceof OutcomeStatus) {
            return strtolower($status->name);
        }

        if (!is_string($status) || trim($status) === '') {
            return 'unknown';
        }

        return str_replace('_', ' ', strtolower(trim($status)));
    }

    private static function safeText(?string $value): string
    {
        $cleaned = trim((string) $value);

        return $cleaned !== '' ? $cleaned : 'unknown';
    }
}
