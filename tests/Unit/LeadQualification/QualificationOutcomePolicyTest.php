<?php

namespace Tests\Unit\LeadQualification;

use App\Enums\QualificationOutcome;
use App\Services\Qualification\QualificationOutcomePolicy;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class QualificationOutcomePolicyTest extends TestCase
{
    private QualificationOutcomePolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new QualificationOutcomePolicy;
    }

    public function test_single_outcome_is_winner(): void
    {
        $winner = $this->policy->resolveWinner([QualificationOutcome::Callback->value]);
        $this->assertSame(QualificationOutcome::Callback, $winner);
    }

    public function test_book_meeting_beats_no_fit(): void
    {
        $winner = $this->policy->resolveWinner([
            QualificationOutcome::NoFit->value,
            QualificationOutcome::BookMeeting->value,
        ]);
        $this->assertSame(QualificationOutcome::BookMeeting, $winner);
    }

    public function test_priority_order_across_all(): void
    {
        $winner = $this->policy->resolveWinner([
            QualificationOutcome::NoFit->value,
            QualificationOutcome::Callback->value,
            QualificationOutcome::InviteWebinar->value,
        ]);
        $this->assertSame(QualificationOutcome::InviteWebinar, $winner);
    }

    public function test_empty_outcomes_throw(): void
    {
        $this->expectException(ValidationException::class);
        $this->policy->resolveWinner([]);
    }

    public function test_normalize_dedupes_values(): void
    {
        $values = $this->policy->normalizeToValues([
            'bookMeeting',
            'bookMeeting',
            'callback',
        ]);
        $this->assertSame(['bookMeeting', 'callback'], $values);
    }
}
