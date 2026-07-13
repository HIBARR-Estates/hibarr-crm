<?php

namespace Tests\Feature\TaskLifecycle;

use App\Notifications\NewTask;
use App\Notifications\TaskLifecycleCompletedNotification;
use App\Notifications\TaskLifecycleCreatedNotification;
use App\Notifications\TaskLifecycleDueNotification;
use App\Notifications\TaskLifecycleUpdatedNotification;
use App\Services\Notifications\UnsClient;
use App\Services\TaskLifecycleNotificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TaskLifecycleTestCase;

class TaskLifecycleNotificationsTest extends TaskLifecycleTestCase
{
    use SetsFeatureFlags;

    private TaskLifecycleNotificationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->enableLifecycleFlag();
        $this->service = app(TaskLifecycleNotificationService::class);
    }

    public function test_it_notifies_all_assignees_when_task_is_created(): void
    {
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId, $this->assigneeTwoId]);

        $this->service->notifyCreated($task, $this->assignerId);

        Notification::assertSentTo(
            [$this->user($this->assigneeOneId), $this->user($this->assigneeTwoId)],
            TaskLifecycleCreatedNotification::class
        );
        Notification::assertNotSentTo(
            $this->user($this->assignerId),
            TaskLifecycleCreatedNotification::class
        );
    }

    public function test_it_notifies_assignees_when_assigner_updates_task(): void
    {
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId, $this->assigneeTwoId]);
        $task->heading = 'Updated heading';
        $this->saveTaskWithoutObservers($task);

        $this->service->notifyUpdated($task, $this->assignerId);

        Notification::assertSentTo(
            [$this->user($this->assigneeOneId), $this->user($this->assigneeTwoId)],
            TaskLifecycleUpdatedNotification::class
        );
        Notification::assertNotSentTo(
            $this->user($this->assignerId),
            TaskLifecycleUpdatedNotification::class
        );
    }

    public function test_it_notifies_assigner_when_assignee_updates_task(): void
    {
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId]);
        $task->heading = 'Updated by assignee';
        $this->saveTaskWithoutObservers($task);

        $this->service->notifyUpdated($task, $this->assigneeOneId);

        Notification::assertSentTo(
            $this->user($this->assignerId),
            TaskLifecycleUpdatedNotification::class
        );
        Notification::assertNotSentTo(
            $this->user($this->assigneeOneId),
            TaskLifecycleUpdatedNotification::class
        );
    }

    public function test_it_notifies_assignees_and_assigner_when_task_is_due(): void
    {
        Notification::fake();

        $task = $this->createTask([
            'due_date' => now()->format('Y-m-d H:i:s'),
        ], assigneeIds: [$this->assigneeOneId, $this->assigneeTwoId]);

        $this->service->notifyDue($task);

        Notification::assertSentTo(
            [
                $this->user($this->assigneeOneId),
                $this->user($this->assigneeTwoId),
                $this->user($this->assignerId),
            ],
            TaskLifecycleDueNotification::class
        );
    }

    public function test_it_notifies_assigner_when_assignee_marks_task_completed(): void
    {
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId]);
        $task->board_column_id = $this->doneColumnId;
        $this->saveTaskWithoutObservers($task);

        $this->service->notifyCompleted($task, $this->assigneeOneId);

        Notification::assertSentTo(
            $this->user($this->assignerId),
            TaskLifecycleCompletedNotification::class
        );
        Notification::assertNotSentTo(
            $this->user($this->assigneeOneId),
            TaskLifecycleCompletedNotification::class
        );
    }

    public function test_it_does_not_send_duplicate_notification_for_self_assigned_update(): void
    {
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assignerId]);
        $task->heading = 'Self update';
        $this->saveTaskWithoutObservers($task);

        $this->service->notifyUpdated($task, $this->assignerId);

        Notification::assertNothingSent();
    }

    public function test_it_does_not_send_due_notification_twice_for_same_task(): void
    {
        Notification::fake();
        Cache::flush();

        $task = $this->createTask([
            'due_date' => now()->format('Y-m-d H:i:s'),
        ], assigneeIds: [$this->assigneeOneId]);

        $this->service->notifyDue($task);
        Notification::assertSentTimes(TaskLifecycleDueNotification::class, 2);

        $this->service->notifyDue($task);
        Notification::assertSentTimes(TaskLifecycleDueNotification::class, 2);
    }

    public function test_it_logs_and_does_not_crash_when_notification_dispatch_fails(): void
    {
        Notification::shouldReceive('send')
            ->once()
            ->andThrow(new \RuntimeException('Notification service unavailable'));

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId]);

        $this->service->notifyCreated($task, $this->assignerId);

        $this->assertTrue(true);
    }

    public function test_lifecycle_create_does_not_send_legacy_new_task_notification(): void
    {
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId]);
        $this->service->notifyCreated($task, $this->assignerId);

        Notification::assertNotSentTo(
            $this->user($this->assigneeOneId),
            NewTask::class
        );
        Notification::assertSentTo(
            $this->user($this->assigneeOneId),
            TaskLifecycleCreatedNotification::class
        );
    }

    public function test_uns_client_returns_false_without_throwing_on_failure(): void
    {
        config([
            'services.notification_service.base_url' => 'https://uns.test',
            'services.notification_service.internal_api_key' => 'secret',
        ]);

        \Illuminate\Support\Facades\Http::fake([
            'https://uns.test/v1/notifications' => \Illuminate\Support\Facades\Http::response('error', 500),
        ]);

        $client = new UnsClient();
        $result = $client->send([
            'event' => 'CRM_EMAIL',
            'userId' => 1,
            'channels' => ['email'],
            'idempotencyKey' => 'test-key',
            'data' => [
                'emailAddress' => 'user@test.local',
                'subject' => 'Subject',
                'body' => 'Body',
                'fromEmail' => 'crm@test.local',
            ],
        ]);

        $this->assertFalse($result);
    }

    public function test_it_skips_lifecycle_notifications_when_flag_is_off(): void
    {
        $this->setFeatureFlag('crm.task-lifecycle-notifications', false);
        Notification::fake();

        $task = $this->createTask(assigneeIds: [$this->assigneeOneId]);
        $this->service->notifyCreated($task, $this->assignerId);

        Notification::assertNothingSent();
    }
}
