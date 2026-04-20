<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;

class BulkActionCompleted extends BaseNotification
{
    protected string $module;
    protected string $actionType;
    protected int $count;
    protected array $records;
    protected int $sampleLimit = 10;

    /**
     * @param array<int, array{label: string, url: string}> $records
     */
    public function __construct(string $module, string $actionType, int $count, array $records = [])
    {
        $this->module = $module;
        $this->actionType = $actionType;
        $this->count = $count;
        $this->records = $records;
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $moduleLabel = $this->getModuleLabel();
        $actionLabel = $this->getActionLabel();

        // Ensure branding + domain-specific links work with your BaseNotification
        $this->company = $notifiable->company ?? company();
        $build = parent::build($notifiable);

        $url = route('dashboard');
        $url = getDomainSpecificUrl($url, $this->company);
        $intro = "Your bulk {$actionLabel} action for {$moduleLabel} has completed. Below are the updated records:";
        $actionDescription = "Click a link to view each updated record.";
        $records = $this->getRenderableRecords();
        $sampleRecords = array_slice($records, 0, $this->sampleLimit);

        $build
            ->subject("{$moduleLabel} bulk {$actionLabel} completed - " . config('app.name'))
            ->view('mail.bulk-action-completed', [
                'url' => $url,
                'themeColor' => $this->company?->header_color,
                'actionText' => 'Open Dashboard',
                'notifiableName' => $notifiable->name,
                'moduleLabel' => $moduleLabel,
                'actionLabel' => $actionLabel,
                'intro' => $intro,
                'actionDescription' => $actionDescription,
                'records' => $records,
                'sampleRecords' => $sampleRecords,
                'recordCount' => $this->count > 0 ? $this->count : count($records),
                'recordNoun' => $this->getRecordNoun(),
            ]);

        parent::resetLocale();

        return $build;
    }

    protected function getModuleLabel(): string
    {
        return match ($this->module) {
            'deal' => 'Deals',
            'task' => 'Tasks',
            default => ucfirst($this->module),
        };
    }

    protected function getActionLabel(): string
    {
        return match ($this->actionType) {
            'change-status' => 'status update',
            'change-deal-agents' => 'agent reassignment',
            'milestone' => 'milestone update',
            'delete' => 'deletion',
            default => str_replace('-', ' ', $this->actionType),
        };
    }

    protected function getActionDescription(string $actionLabel, string $moduleLabel): string
    {
        return "You can review the {$moduleLabel} {$actionLabel} results from your dashboard using the button below:";
    }

    /**
     * @return array<int, array{label: string, url: string}>
     */
    protected function getRenderableRecords(): array
    {
        return array_values(array_filter(array_map(function (array $record): ?array {
            $recordUrl = trim((string) ($record['url'] ?? ''));
            $recordLabel = trim((string) ($record['label'] ?? ''));

            if ($recordUrl === '' || $recordLabel === '') {
                return null;
            }

            return [
                'label' => $recordLabel,
                'url' => $recordUrl,
            ];
        }, $this->records)));
    }

    protected function getRecordNoun(): string
    {
        return match ($this->module) {
            'deal' => 'deals',
            'task' => 'tasks',
            default => strtolower($this->module) . 's',
        };
    }
}

