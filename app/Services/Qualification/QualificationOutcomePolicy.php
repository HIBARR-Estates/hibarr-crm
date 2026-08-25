<?php

namespace App\Services\Qualification;

use App\Enums\QualificationOutcome;
use Illuminate\Validation\ValidationException;

class QualificationOutcomePolicy
{
    /**
     * Highest-priority lifecycle wins when multiple outcomes are selected.
     * bookMeeting (qualified) > inviteWebinar (nurturing) > callback > noFit (lost)
     *
     * @var list<QualificationOutcome>
     */
    private const PRIORITY = [
        QualificationOutcome::BookMeeting,
        QualificationOutcome::InviteWebinar,
        QualificationOutcome::Callback,
        QualificationOutcome::NoFit,
    ];

    /**
     * @param  list<string|QualificationOutcome>  $outcomes
     */
    public function resolveWinner(array $outcomes): QualificationOutcome
    {
        $normalized = $this->normalize($outcomes);

        if ($normalized === []) {
            throw ValidationException::withMessages([
                'outcomes' => ['At least one outcome is required.'],
            ]);
        }

        foreach (self::PRIORITY as $candidate) {
            if (in_array($candidate, $normalized, true)) {
                return $candidate;
            }
        }

        throw ValidationException::withMessages([
            'outcomes' => ['No valid qualification outcome provided.'],
        ]);
    }

    /**
     * @param  list<string|QualificationOutcome>  $outcomes
     * @return list<string>
     */
    public function normalizeToValues(array $outcomes): array
    {
        return array_map(
            static fn (QualificationOutcome $outcome) => $outcome->value,
            $this->normalize($outcomes)
        );
    }

    /**
     * @param  list<string|QualificationOutcome>  $outcomes
     * @return list<QualificationOutcome>
     */
    private function normalize(array $outcomes): array
    {
        $unique = [];

        foreach ($outcomes as $outcome) {
            $enum = $outcome instanceof QualificationOutcome
                ? $outcome
                : QualificationOutcome::tryFrom((string) $outcome);

            if ($enum === null) {
                throw ValidationException::withMessages([
                    'outcomes' => ["Invalid outcome: {$outcome}"],
                ]);
            }

            $unique[$enum->value] = $enum;
        }

        return array_values($unique);
    }
}
