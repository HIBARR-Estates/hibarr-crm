<?php

namespace App\Http\Controllers\ApiV2;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Http\Requests\ApiV2\CrmWrite\CreateMeetingV2Request;
use App\Http\Requests\ApiV2\CrmWrite\CreateNoteV2Request;
use App\Http\Requests\ApiV2\CrmWrite\CreateTaskV2Request;
use App\Http\Requests\ApiV2\CrmWrite\ListCrmWriteV2Request;
use App\Http\Requests\ApiV2\CrmWrite\UpdateMeetingV2Request;
use App\Http\Requests\ApiV2\CrmWrite\UpdateNoteV2Request;
use App\Http\Requests\ApiV2\CrmWrite\UpdateTaskV2Request;
use App\Http\Requests\ApiV2\CrmWrite\UpsertPaymentV2Request;
use App\Services\ApiV2\CrmWriteService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CrmWriteApiController extends Controller
{
    public function __construct(
        private readonly CrmWriteService $crmWriteService
    ) {}

    public function listTasks(ListCrmWriteV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request) {
                $result = $this->crmWriteService->listTasks($companyId, $request->validated());

                return $this->crmWriteService->serializePaginatedList($result['items'], $result['paginator']);
            },
            'Tasks fetched successfully'
        );
    }

    public function getTask(Request $request, int $taskId): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializeTask(
                $this->crmWriteService->getTask($companyId, $taskId)
            ),
            'Task fetched successfully'
        );
    }

    public function createTask(CreateTaskV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializeTask(
                $this->crmWriteService->createTask($companyId, $request->validated())
            ),
            'Task created successfully',
            201
        );
    }

    public function updateTask(UpdateTaskV2Request $request, int $taskId): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializeTask(
                $this->crmWriteService->updateTask($companyId, $taskId, $request->validated())
            ),
            'Task updated successfully'
        );
    }

    public function deleteTask(Request $request, int $taskId): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($taskId) {
                $this->crmWriteService->deleteTask($companyId, $taskId);

                return null;
            },
            'Task deleted successfully'
        );
    }

    public function listNotes(ListCrmWriteV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request) {
                $result = $this->crmWriteService->listNotes($companyId, $request->validated());

                return $this->crmWriteService->serializePaginatedList($result['items'], $result['paginator']);
            },
            'Notes fetched successfully'
        );
    }

    public function getNote(Request $request, int $noteId): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request, $noteId) {
                $type = $this->requiredNoteType($request);
                $result = $this->crmWriteService->getNote($companyId, $noteId, $type);

                return $this->crmWriteService->serializeNote($result['note'], $result['type']);
            },
            'Note fetched successfully'
        );
    }

    public function createNote(CreateNoteV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request) {
                $result = $this->crmWriteService->createNote($companyId, $request->validated());

                return $this->crmWriteService->serializeNote($result['note'], $result['type']);
            },
            'Note created successfully',
            201
        );
    }

    public function updateNote(UpdateNoteV2Request $request, int $noteId): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request, $noteId) {
                $result = $this->crmWriteService->updateNote($companyId, $noteId, $request->validated());

                return $this->crmWriteService->serializeNote($result['note'], $result['type']);
            },
            'Note updated successfully'
        );
    }

    public function deleteNote(Request $request, int $noteId): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request, $noteId) {
                $type = $this->requiredNoteType($request);
                $this->crmWriteService->deleteNote($companyId, $noteId, $type);

                return null;
            },
            'Note deleted successfully'
        );
    }

    public function listMeetings(ListCrmWriteV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request) {
                $result = $this->crmWriteService->listMeetings($companyId, $request->validated());

                return $this->crmWriteService->serializePaginatedList($result['items'], $result['paginator']);
            },
            'Meetings fetched successfully'
        );
    }

    public function getMeeting(Request $request, int $meetingId): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializeMeeting(
                $this->crmWriteService->getMeeting($companyId, $meetingId)
            ),
            'Meeting fetched successfully'
        );
    }

    public function createMeeting(CreateMeetingV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializeMeeting(
                $this->crmWriteService->createMeeting($companyId, $request->validated())
            ),
            'Meeting created successfully',
            201
        );
    }

    public function updateMeeting(UpdateMeetingV2Request $request, int $meetingId): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializeMeeting(
                $this->crmWriteService->updateMeeting($companyId, $meetingId, $request->validated())
            ),
            'Meeting updated successfully'
        );
    }

    public function deleteMeeting(Request $request, int $meetingId): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($meetingId) {
                $this->crmWriteService->deleteMeeting($companyId, $meetingId);

                return null;
            },
            'Meeting deleted successfully'
        );
    }

    public function listPayments(ListCrmWriteV2Request $request): JsonResponse
    {
        return $this->handle(
            $request,
            function (int $companyId) use ($request) {
                $result = $this->crmWriteService->listPayments($companyId, $request->validated());

                return $this->crmWriteService->serializePaginatedList($result['items'], $result['paginator']);
            },
            'Payments fetched successfully'
        );
    }

    public function getPayment(Request $request, int $paymentId): JsonResponse
    {
        return $this->handle(
            $request,
            fn (int $companyId) => $this->crmWriteService->serializePayment(
                $this->crmWriteService->getPayment($companyId, $paymentId)
            ),
            'Payment fetched successfully'
        );
    }

    public function upsertPayment(UpsertPaymentV2Request $request): JsonResponse
    {
        $companyId = (int) $request->header('X-COMPANY-ID');
        if ($companyId <= 0) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 401);
        }

        try {
            $result = $this->crmWriteService->upsertPayment(
                $companyId,
                $request->validated(),
                $request->file('bill')
            );

            $created = (bool) $result['created'];
            $message = $created ? 'Payment created successfully' : 'Payment updated successfully';
            $payload = $this->crmWriteService->serializePayment($result['payment']);

            return response()->json(
                Reply::successWithData($message, ['data' => $payload]),
                $created ? 201 : 200
            );
        } catch (ValidationException $exception) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Validation failed.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (ModelNotFoundException) {
            return response()->json(Reply::error('Record not found.'), 404);
        } catch (\Throwable $exception) {
            $referenceId = uniqid('CRM-WRITE-', true);

            Log::error('CRM write API request failed', [
                'reference_id' => $referenceId,
                'endpoint' => $request->path(),
                'company_id' => $companyId,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'CRM write request failed. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * @param  callable(int): array<string, mixed>|null  $action
     */
    private function handle(
        Request $request,
        callable $action,
        string $message,
        int $successStatus = 200
    ): JsonResponse {
        $companyId = (int) $request->header('X-COMPANY-ID');
        if ($companyId <= 0) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 401);
        }

        try {
            $payload = $action($companyId);
            $response = Reply::success($message);

            if ($payload !== null) {
                $response = is_array($payload) && array_key_exists('data', $payload)
                    ? Reply::successWithData($message, $payload)
                    : Reply::successWithData($message, ['data' => $payload]);
            }

            return response()->json($response, $successStatus);
        } catch (ValidationException $exception) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Validation failed.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (ModelNotFoundException) {
            return response()->json(Reply::error('Record not found.'), 404);
        } catch (\Throwable $exception) {
            $referenceId = uniqid('CRM-WRITE-', true);

            Log::error('CRM write API request failed', [
                'reference_id' => $referenceId,
                'endpoint' => $request->path(),
                'company_id' => $companyId,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'CRM write request failed. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    private function requiredNoteType(Request $request): string
    {
        $type = $request->query('type');

        if (!in_array($type, ['lead', 'deal'], true)) {
            throw ValidationException::withMessages([
                'type' => ['The type query parameter is required and must be lead or deal.'],
            ]);
        }

        return $type;
    }
}
