<?php

namespace Tests\Unit\Services;

use App\Models\Task;
use App\Models\User;
use App\Services\TaskNotificationService;
use Tests\TestCase;

class TaskNotificationServiceTest extends TestCase
{
    public function test_assignees_excludes_actor_and_inactive_users(): void
    {
        $actor = $this->makeUser(1, 'active');
        $assignee = $this->makeUser(2, 'active');
        $inactive = $this->makeUser(3, 'inactive');

        $task = new Task(['heading' => 'Follow up client']);
        $task->id = 10;
        $task->setRelation('users', collect([$actor, $assignee, $inactive]));

        $recipients = app(TaskNotificationService::class)->assignees($task, $actor->id);

        $this->assertCount(1, $recipients);
        $this->assertSame(2, $recipients->first()->id);
    }

    private function makeUser(int $id, string $status): User
    {
        $user = new User([
            'name' => 'User '.$id,
            'email' => 'user'.$id.'@example.com',
            'status' => $status,
            'email_notifications' => true,
        ]);
        $user->id = $id;
        $user->exists = true;

        return $user;
    }
}
