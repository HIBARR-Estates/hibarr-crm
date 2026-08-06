<?php

namespace App\Services\Qualification;

use App\Enums\QualificationActionType;

class QualificationActionCatalog
{
    public const VERSION = 1;

    public const STATUS_AVAILABLE = 'available';

    public const STATUS_COMING_SOON = 'coming_soon';

    /**
     * @return array{version: int, actions: list<array<string, mixed>>}
     */
    public function toArray(): array
    {
        return [
            'version' => self::VERSION,
            'actions' => array_map(
                fn (array $entry) => $entry,
                $this->entries()
            ),
        ];
    }

    /**
     * @return list<array{
     *   type: string,
     *   label: string,
     *   status: string,
     *   requiresRuntimePayload: bool,
     *   optionalConfigKeys: list<string>
     * }>
     */
    public function entries(): array
    {
        $statuses = $this->statusMap();

        return array_map(
            function (QualificationActionType $type) use ($statuses) {
                return [
                    'type' => $type->value,
                    'label' => $type->label(),
                    'status' => $statuses[$type->value] ?? self::STATUS_COMING_SOON,
                    'requiresRuntimePayload' => $type->requiresRuntimePayload(),
                    'optionalConfigKeys' => $type->optionalConfigKeys(),
                ];
            },
            QualificationActionType::cases()
        );
    }

    public function statusFor(string $type): string
    {
        return $this->statusMap()[$type] ?? self::STATUS_COMING_SOON;
    }

    public function isExecutable(string $type): bool
    {
        $status = $this->statusFor($type);

        return $status === self::STATUS_AVAILABLE
            && in_array($type, [
                QualificationActionType::BookConsultation->value,
                QualificationActionType::InviteWebinar->value,
                QualificationActionType::ScheduleCallback->value,
                QualificationActionType::MarkNoFit->value,
            ], true);
    }

    public function isNoOp(string $type): bool
    {
        return in_array($type, [
            QualificationActionType::ScheduleCallback->value,
            QualificationActionType::MarkNoFit->value,
        ], true);
    }

    /**
     * @return array<string, string>
     */
    private function statusMap(): array
    {
        return [
            QualificationActionType::BookConsultation->value => self::STATUS_AVAILABLE,
            QualificationActionType::InviteWebinar->value => self::STATUS_AVAILABLE,
            QualificationActionType::ScheduleCallback->value => self::STATUS_AVAILABLE,
            QualificationActionType::MarkNoFit->value => self::STATUS_AVAILABLE,
            QualificationActionType::CreateTask->value => self::STATUS_COMING_SOON,
            QualificationActionType::ScheduleMeeting->value => self::STATUS_COMING_SOON,
            QualificationActionType::CreateDeal->value => self::STATUS_COMING_SOON,
            QualificationActionType::AddNote->value => self::STATUS_COMING_SOON,
            QualificationActionType::LogActivity->value => self::STATUS_COMING_SOON,
            QualificationActionType::SendEmail->value => self::STATUS_COMING_SOON,
            QualificationActionType::SendSms->value => self::STATUS_COMING_SOON,
            QualificationActionType::AssignOwner->value => self::STATUS_COMING_SOON,
        ];
    }
}
