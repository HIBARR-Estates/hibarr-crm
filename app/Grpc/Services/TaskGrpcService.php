<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\TaskServiceInterface;
use App\Grpc\Generated\Task\CreateTaskRequest;
use App\Grpc\Generated\Task\GetTaskRequest;
use App\Grpc\Generated\Task\UpdateTaskRequest;
use App\Grpc\Generated\Task\DeleteTaskRequest;
use App\Grpc\Generated\Task\ChangeTaskStatusRequest;
use App\Grpc\Generated\Task\ListTasksRequest;
use App\Grpc\Generated\Task\ListTasksResponse;
use App\Grpc\Generated\Task\TaskResponse;
use App\Grpc\Generated\Task\Task as TaskMessage;
use App\Grpc\Generated\Common\PBEmpty;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Models\Task;
use App\Services\TaskService;
use Illuminate\Validation\ValidationException;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class TaskGrpcService implements TaskServiceInterface
{
    public function __construct(
        private TaskService $taskService,
    ) {}

    public function Create(ContextInterface $ctx, CreateTaskRequest $in): TaskResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $data = [
                'heading'    => $in->getHeading(),
                'company_id' => $companyId,
            ];

            if ($in->hasDescription()) $data['description'] = $in->getDescription();
            if ($in->getStartDate()) $data['start_date'] = $in->getStartDate();
            if ($in->getDueDate()) $data['due_date'] = $in->getDueDate();
            if ($in->getPriority()) $data['priority'] = $in->getPriority();
            if ($in->hasProjectId()) $data['project_id'] = $in->getProjectId();
            if ($in->hasBoardColumnId()) $data['board_column_id'] = $in->getBoardColumnId();
            if ($in->hasTaskCategoryId()) $data['category_id'] = $in->getTaskCategoryId();
            if ($in->hasMilestoneId()) $data['milestone_id'] = $in->getMilestoneId();
            if ($in->hasIsPrivate()) $data['is_private'] = $in->getIsPrivate();
            if ($in->hasBillable()) $data['billable'] = $in->getBillable();
            if ($in->hasEstimateHours()) $data['estimate_hours'] = $in->getEstimateHours();
            if ($in->hasEstimateMinutes()) $data['estimate_minutes'] = $in->getEstimateMinutes();
            if ($in->hasRepeat()) $data['repeat'] = $in->getRepeat();
            if ($in->hasRepeatCount()) $data['repeat_count'] = $in->getRepeatCount();
            if ($in->hasRepeatType()) $data['repeat_type'] = $in->getRepeatType();
            if ($in->hasRepeatCycles()) $data['repeat_cycles'] = $in->getRepeatCycles();

            $assigneeIds = iterator_to_array($in->getAssigneeIds());
            if (!empty($assigneeIds)) $data['user_ids'] = $assigneeIds;

            $labelIds = iterator_to_array($in->getLabelIds());
            if (!empty($labelIds)) $data['task_labels'] = $labelIds;

            if ($in->hasCustomFieldsJson()) {
                $data['custom_fields_data'] = json_decode($in->getCustomFieldsJson(), true);
            }

            $task = $this->taskService->createTask($data);

            // Sync polymorphic relations
            $dealIds = iterator_to_array($in->getDealIds());
            $leadIds = iterator_to_array($in->getLeadIds());
            $propertyIds = iterator_to_array($in->getPropertyIds());

            if (!empty($dealIds)) $task->deals()->sync($dealIds);
            if (!empty($leadIds)) $task->leads()->sync($leadIds);
            if (!empty($propertyIds)) $task->properties()->sync($propertyIds);

            $task->load(['users', 'labels', 'deals', 'leads', 'properties']);

            return $this->buildResponse($task);
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Get(ContextInterface $ctx, GetTaskRequest $in): TaskResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $task = null;

            if ($in->getId() > 0) {
                $task = Task::where('company_id', $companyId)
                    ->with(['users', 'labels', 'deals', 'leads', 'properties'])
                    ->find($in->getId());
            } elseif ($in->hasTaskShortCode() && $in->getTaskShortCode()) {
                $task = Task::where('company_id', $companyId)
                    ->where('task_short_code', $in->getTaskShortCode())
                    ->with(['users', 'labels', 'deals', 'leads', 'properties'])
                    ->first();
            } else {
                throw new GRPCException('Task identifier required: id or task_short_code', StatusCode::INVALID_ARGUMENT);
            }

            if (!$task) {
                throw new GRPCException('Task not found', StatusCode::NOT_FOUND);
            }

            return $this->buildResponse($task);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Update(ContextInterface $ctx, UpdateTaskRequest $in): TaskResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Task ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $task = Task::where('company_id', $companyId)->find($id);

            if (!$task) {
                throw new GRPCException("Task not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $data = [];
            if ($in->hasHeading()) $data['heading'] = $in->getHeading();
            if ($in->hasDescription()) $data['description'] = $in->getDescription();
            if ($in->hasStartDate()) $data['start_date'] = $in->getStartDate();
            if ($in->hasDueDate()) $data['due_date'] = $in->getDueDate();
            if ($in->hasPriority()) $data['priority'] = $in->getPriority();
            if ($in->hasStatus()) $data['status'] = $in->getStatus();
            if ($in->hasProjectId()) $data['project_id'] = $in->getProjectId();
            if ($in->hasBoardColumnId()) $data['board_column_id'] = $in->getBoardColumnId();
            if ($in->hasTaskCategoryId()) $data['category_id'] = $in->getTaskCategoryId();
            if ($in->hasMilestoneId()) $data['milestone_id'] = $in->getMilestoneId();
            if ($in->hasIsPrivate()) $data['is_private'] = $in->getIsPrivate();
            if ($in->hasBillable()) $data['billable'] = $in->getBillable();
            if ($in->hasEstimateHours()) $data['estimate_hours'] = $in->getEstimateHours();
            if ($in->hasEstimateMinutes()) $data['estimate_minutes'] = $in->getEstimateMinutes();
            if ($in->hasRepeat()) $data['repeat'] = $in->getRepeat();
            if ($in->hasRepeatCount()) $data['repeat_count'] = $in->getRepeatCount();
            if ($in->hasRepeatType()) $data['repeat_type'] = $in->getRepeatType();
            if ($in->hasRepeatCycles()) $data['repeat_cycles'] = $in->getRepeatCycles();

            $assigneeIds = iterator_to_array($in->getAssigneeIds());
            if (!empty($assigneeIds)) $data['user_ids'] = $assigneeIds;

            $labelIds = iterator_to_array($in->getLabelIds());
            if (!empty($labelIds)) $data['task_labels'] = $labelIds;

            if ($in->hasCustomFieldsJson()) {
                $data['custom_fields_data'] = json_decode($in->getCustomFieldsJson(), true);
            }

            $task = $this->taskService->updateTask($task, $data);

            // Sync polymorphic relations
            $dealIds = iterator_to_array($in->getDealIds());
            $leadIds = iterator_to_array($in->getLeadIds());
            $propertyIds = iterator_to_array($in->getPropertyIds());

            if (!empty($dealIds)) $task->deals()->sync($dealIds);
            if (!empty($leadIds)) $task->leads()->sync($leadIds);
            if (!empty($propertyIds)) $task->properties()->sync($propertyIds);

            $task->load(['users', 'labels', 'deals', 'leads', 'properties']);

            return $this->buildResponse($task);
        } catch (GRPCException $e) {
            throw $e;
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Delete(ContextInterface $ctx, DeleteTaskRequest $in): PBEmpty
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Task ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $task = Task::where('company_id', $companyId)->find($id);

            if (!$task) {
                throw new GRPCException("Task not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $this->taskService->deleteTask($task);

            return new PBEmpty();
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function ChangeStatus(ContextInterface $ctx, ChangeTaskStatusRequest $in): TaskResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();
            $columnId = $in->getBoardColumnId();

            if ($id <= 0) {
                throw new GRPCException('Task ID is required', StatusCode::INVALID_ARGUMENT);
            }

            if ($columnId <= 0) {
                throw new GRPCException('Board column ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $task = Task::where('company_id', $companyId)->find($id);

            if (!$task) {
                throw new GRPCException("Task not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $task = $this->taskService->changeStatus($task, $columnId);
            $task->load(['users', 'labels', 'deals', 'leads', 'properties']);

            return $this->buildResponse($task);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function List(ContextInterface $ctx, ListTasksRequest $in): ListTasksResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'created_at';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = Task::where('company_id', $companyId)
                ->with(['users', 'labels', 'deals', 'leads', 'properties']);

            if ($in->hasWithTrashed() && $in->getWithTrashed()) $query->withTrashed();

            if ($in->hasProjectId()) $query->where('project_id', $in->getProjectId());
            if ($in->hasBoardColumnId()) $query->where('board_column_id', $in->getBoardColumnId());
            if ($in->hasTaskCategoryId()) $query->where('task_category_id', $in->getTaskCategoryId());
            if ($in->hasMilestoneId()) $query->where('milestone_id', $in->getMilestoneId());
            if ($in->hasAssigneeId()) {
                $query->whereHas('users', fn ($q) => $q->where('users.id', $in->getAssigneeId()));
            }
            if ($in->hasPriority()) $query->where('priority', $in->getPriority());
            if ($in->hasStatus()) $query->where('status', $in->getStatus());
            if ($in->hasIsPrivate()) $query->where('is_private', $in->getIsPrivate());
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('heading', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhere('task_short_code', 'like', "%{$search}%");
                });
            }
            if ($in->hasDueFrom()) $query->where('due_date', '>=', $in->getDueFrom());
            if ($in->hasDueTo()) $query->where('due_date', '<=', $in->getDueTo());
            if ($in->hasCreatedFrom()) $query->where('created_at', '>=', $in->getCreatedFrom());
            if ($in->hasCreatedTo()) $query->where('created_at', '<=', $in->getCreatedTo());
            if ($in->hasDealId()) {
                $query->whereHas('deals', fn ($q) => $q->where('deals.id', $in->getDealId()));
            }
            if ($in->hasLeadId()) {
                $query->whereHas('leads', fn ($q) => $q->where('leads.id', $in->getLeadId()));
            }
            if ($in->hasPropertyId()) {
                $query->whereHas('properties', fn ($q) => $q->where('properties.id', $in->getPropertyId()));
            }

            $allowedSortColumns = ['id', 'heading', 'priority', 'status', 'start_date', 'due_date', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) $sortBy = 'created_at';

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListTasksResponse();
            foreach ($paginator->items() as $task) {
                $response->getTasks()[] = $this->buildMessage($task);
            }

            $meta = new PaginationMeta();
            $meta->setCurrentPage($paginator->currentPage());
            $meta->setPerPage($paginator->perPage());
            $meta->setTotal($paginator->total());
            $meta->setTotalPages($paginator->lastPage());
            $meta->setHasMore($paginator->hasMorePages());
            $response->setPagination($meta);

            return $response;
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    // ── Helpers ────────────────────────────────────────────

    private function buildResponse(Task $task): TaskResponse
    {
        $response = new TaskResponse();
        $response->setTask($this->buildMessage($task));
        return $response;
    }

    private function buildMessage(Task $task): TaskMessage
    {
        $msg = new TaskMessage();
        $msg->setId($task->id);
        $msg->setHeading($task->heading ?? '');
        $msg->setDescription($task->description ?? '');
        $msg->setTaskShortCode($task->task_short_code ?? '');
        $msg->setStartDate($this->dateToString($task->start_date));
        $msg->setDueDate($this->dateToString($task->due_date));
        $msg->setCompletedOn($this->dateToString($task->completed_on));
        $msg->setPriority($task->priority ?? '');
        $msg->setStatus($task->status ?? '');
        $msg->setColumnPriority($task->column_priority ?? 0);
        $msg->setProjectId($task->project_id ?? 0);
        $msg->setBoardColumnId($task->board_column_id ?? 0);
        $msg->setTaskCategoryId($task->task_category_id ?? 0);
        $msg->setMilestoneId($task->milestone_id ?? 0);
        $msg->setCompanyId($task->company_id ?? 0);
        $msg->setCreatedBy($task->created_by ?? 0);
        $msg->setAddedBy($task->added_by ?? 0);
        $msg->setLastUpdatedBy($task->last_updated_by ?? 0);
        $msg->setIsPrivate((bool) ($task->is_private ?? false));
        $msg->setBillable((bool) ($task->billable ?? false));
        $msg->setEstimateHours($task->estimate_hours ?? 0);
        $msg->setEstimateMinutes($task->estimate_minutes ?? 0);
        $msg->setRepeat((bool) ($task->repeat ?? false));
        $msg->setRepeatCount($task->repeat_count ?? 0);
        $msg->setRepeatType($task->repeat_type ?? '');
        $msg->setRepeatCycles($task->repeat_cycles ?? 0);
        $msg->setRecurringTaskId($task->recurring_task_id ?? 0);
        $msg->setDependentTaskId($task->dependent_task_id ?? 0);
        $msg->setEventId($task->event_id ?? 0);
        $msg->setCreatedAt($this->dateToString($task->created_at));
        $msg->setUpdatedAt($this->dateToString($task->updated_at));
        $msg->setDeletedAt($this->dateToString($task->deleted_at));

        if ($task->relationLoaded('users')) {
            $msg->setAssigneeIds($task->users->pluck('id')->toArray());
        }
        if ($task->relationLoaded('labels')) {
            $msg->setLabelIds($task->labels->pluck('id')->toArray());
        }
        if ($task->relationLoaded('deals')) {
            $msg->setDealIds($task->deals->pluck('id')->toArray());
        }
        if ($task->relationLoaded('leads')) {
            $msg->setLeadIds($task->leads->pluck('id')->toArray());
        }
        if ($task->relationLoaded('properties')) {
            $msg->setPropertyIds($task->properties->pluck('id')->toArray());
        }

        return $msg;
    }

    private function getCompanyId(ContextInterface $ctx): int
    {
        // RoadRunner stores gRPC metadata as top-level context values (not under a 'metadata' key).
        // Each value is an array of strings.
        $values = $ctx->getValue('x-company-id');
        $companyId = is_array($values) ? ($values[0] ?? null) : $values;
        if (!$companyId) {
            throw new GRPCException('Company context not found. Send x-company-id in gRPC metadata.', StatusCode::UNAUTHENTICATED);
        }
        return (int) $companyId;
    }

    private function mapValidationException(ValidationException $e): GRPCException
    {
        $errors = [];
        foreach ($e->errors() as $field => $messages) {
            foreach ($messages as $message) {
                $errors[] = "{$field}: {$message}";
            }
        }
        return new GRPCException('Validation failed: ' . implode('; ', $errors), StatusCode::INVALID_ARGUMENT);
    }

    private function dateToString(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }

    private function mapException(\Throwable $e): GRPCException
    {
        \Log::error('TaskGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
