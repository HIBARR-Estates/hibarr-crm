<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\EmployeeDetails;
use App\Models\HibarrDealFields;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadMarketing;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class BitrixImportController extends Controller
{
    public function store(Request $request)
    {
        $payload = $request->all();

        $dealData = Arr::get($payload, 'deal', []);
        $contactData = Arr::get($payload, 'contact', []);
        $responsibleData = Arr::get($payload, 'responsiblePerson', []);

        $dealName = trim((string) Arr::get($dealData, 'dealName'));
        if ($dealName === '') {
            return Reply::error('Deal name is required.');
        }

        $companyId = 1;

        try {
            $result = DB::transaction(function () use ($dealData, $contactData, $responsibleData, $dealName, $companyId) {
                // Ensure responsible user exists
                $responsibleUser = $this->resolveResponsibleUser($responsibleData, $companyId);

                if ($responsibleUser) {
                    auth()->setUser($responsibleUser);
                }

                // Create or update contact
                $lead = $this->upsertLead($contactData, $companyId, $responsibleUser);

                // Resolve pipeline and stage
                [$pipeline, $stage] = $this->resolvePipelineAndStage($dealData, $companyId);

                if (!$stage) {
                    throw new \RuntimeException('No matching pipeline stage could be resolved for the payload.');
                }
                $bitrixId = $this->toInt(Arr::get($dealData, 'bitrixId'));

                // Create or update deal
                // Use bitrix_id for lookup if provided, otherwise fallback to name-based lookup
                $dealQuery = Deal::withoutGlobalScopes()
                    ->where('company_id', $companyId);
                
                if ($bitrixId !== null) {
                    $dealQuery->where('bitrix_id', $bitrixId);
                } else {
                    
                }
                
                $deal = $dealQuery->first();

                $isNewDeal = false;
                if (!$deal) {
                    $deal = new Deal();
                    $deal->company_id = $companyId;
                    if ($bitrixId !== null) {
                        $deal->bitrix_id = $bitrixId;
                    }
                    $deal->name = $dealName;
                    $deal->column_priority = 0;
                    $deal->value = 0;
                    $isNewDeal = true;
                    
                    // Set created_at from payload if provided
                    if ($createdDate = $this->parseDate(Arr::get($dealData, 'createdDate'))) {
                        $deal->created_at = $createdDate;
                    }
                }

                $deal->lead_id = $lead->id;

                $dealValue = $this->toFloat(Arr::get($dealData, 'dealValue'))
                    ?? $this->toFloat(Arr::get($dealData, 'amountPaid'))
                    ?? $this->toFloat(Arr::get($dealData, 'customerBudget'));
                if ($dealValue !== null) {
                    $deal->value = $dealValue;
                }

                $deal->lead_pipeline_id = $stage->lead_pipeline_id;
                $deal->pipeline_stage_id = $stage->id;

                if ($responsibleUser) {
                    $leadAgent = LeadAgent::withoutGlobalScopes()
                        ->firstOrCreate(
                            [
                                'company_id' => $companyId,
                                'user_id' => $responsibleUser->id,
                            ],
                            [
                                'status' => 'enabled',
                            ]
                        );

                    $deal->agent_id = $leadAgent->id;
                }

                if ($date = $this->parseDate(Arr::get($dealData, 'kickoffMeetingDate'))) {
                    $deal->close_date = $date;
                }

                $note = $this->buildDealNotes($deal, $dealData, $contactData);
                if ($note !== null) {
                    $deal->note = $note;
                }

                // Use saveQuietly to prevent DealObserver from triggering automation
                // This ensures the deal stays at the stage specified in the payload
                $deal->saveQuietly();

                if ($responsibleUser) {
                    try {
                        $deal->dealWatchers()->syncWithoutDetaching([$responsibleUser->id]);
                    } catch (\Exception $e) {
                        // Log but don't fail the import if watcher sync fails
                        Log::warning('Bitrix import: Failed to sync deal watchers', [
                            'deal_id' => $deal->id,
                            'user_id' => $responsibleUser->id,
                        ]);
                    }
                }

                $this->scheduleFollowUpIfNeeded($deal, Arr::get($dealData, 'nextMeeting'));

                $this->upsertHibarrFields($deal, $dealData);

                return [
                    'deal' => $deal,
                    'lead' => $lead,
                    'responsible_user' => $responsibleUser,
                    'is_new_deal' => $isNewDeal,
                ];
            });
        } catch (Throwable $e) {
            $this->logoutIfAuthenticated();

            return $this->handleBitrixImportFailure($e, $payload);
        }

        $this->logoutIfAuthenticated();

        return Reply::successWithData('Bitrix deal synced successfully.', [
            'deal_id' => $result['deal']->id,
            'contact_id' => $result['lead']->id,
            'responsible_user_id' => optional($result['responsible_user'])->id,
            'is_new_deal' => $result['is_new_deal'],
        ]);
    }

    public function commentStore(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        $bitrixDealId = $request->input('deal_id');
        $comments = $request->input('comments', []);
        
        if (!$bitrixDealId) {
            return Reply::error('Deal ID is required.');
        }
        
        try {
            $result = DB::transaction(function () use ($bitrixDealId, $comments, $companyId) {
                // Find the deal by bitrix_id
                $deal = Deal::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('bitrix_id', $bitrixDealId)
                    ->first();
                
                if (!$deal) {
                    throw new \RuntimeException('Deal not found with Bitrix ID: ' . $bitrixDealId);
                }
                
                $notesCreated = 0;
                
                // Create a note for each comment
                foreach ($comments as $commentData) {
                    $authorEmail = trim((string) Arr::get($commentData, 'author_email', ''));
                    $title = trim((string) Arr::get($commentData, 'title', 'Bitrix Comment'));
                    $comment = Arr::get($commentData, 'comment', '');
                    $createdDate = Arr::get($commentData, 'created_date');
                    $attachments = Arr::get($commentData, 'attachments', []);
                    
                    // Convert comment to string and trim
                    if (is_string($comment)) {
                        $comment = trim($comment);
                    } else {
                        $comment = '';
                    }
                    
                    if ($comment === '') {
                        continue; // Skip empty comments
                    }
                    
                    // Resolve the author user if email is provided
                    $authorUser = null;
                    if ($authorEmail !== '') {
                        $authorUser = User::withoutGlobalScopes()
                            ->where('company_id', $companyId)
                            ->where('email', $authorEmail)
                            ->first();
                    }
                    
                    // Set authenticated user for the observer to work properly
                    // Always reset auth state for each comment to prevent cross-contamination
                    if ($authorUser) {
                        auth()->setUser($authorUser);
                    } else {
                        // Clear auth state if no author found to prevent using previous iteration's user
                        auth()->logout();
                    }
                    
                    // Build the comment details with attachments as rich text links
                    $details = nl2br(htmlspecialchars($comment, ENT_QUOTES, 'UTF-8'), false);
                    if (!empty($attachments) && is_array($attachments)) {
                        foreach ($attachments as $attachment) {
                            $attachmentUrl = '';
                            $linkText = '';
                            
                            // Handle object/array attachments with url and filename
                            if (is_array($attachment) || is_object($attachment)) {
                                $attachmentArray = (array) $attachment;
                                $attachmentUrl = Arr::get($attachmentArray, 'url', '');
                                $linkText = Arr::get($attachmentArray, 'filename', '');
                                
                                // If no filename provided, try to extract from URL
                                if (empty($linkText) && !empty($attachmentUrl)) {
                                    $parsedUrl = parse_url($attachmentUrl);
                                    if (isset($parsedUrl['path'])) {
                                        $filename = basename($parsedUrl['path']);
                                        if ($filename && $filename !== '/') {
                                            $linkText = $filename;
                                        }
                                    }
                                }
                                
                                // Fallback to URL if no filename found
                                if (empty($linkText)) {
                                    $linkText = $attachmentUrl;
                                }
                            } 
                            // Handle string attachments (backward compatibility)
                            elseif (is_string($attachment)) {
                                $attachmentUrl = $attachment;
                                $linkText = $attachmentUrl;
                                
                                // Try to extract filename from URL
                                $parsedUrl = parse_url($attachment);
                                if (isset($parsedUrl['path'])) {
                                    $filename = basename($parsedUrl['path']);
                                    if ($filename && $filename !== '/') {
                                        $linkText = $filename;
                                    }
                                }
                            } else {
                                // Skip invalid attachment types
                                continue;
                            }
                            
                            // Only add link if we have a valid URL
                            if (!empty($attachmentUrl)) {
                                $attachmentUrl = htmlspecialchars($attachmentUrl, ENT_QUOTES, 'UTF-8');
                                $linkText = htmlspecialchars($linkText, ENT_QUOTES, 'UTF-8');
                                $details .= "<br><a href=\"{$attachmentUrl}\" target=\"_blank\" rel=\"noopener noreferrer\">{$linkText}</a>";
                            }
                        }
                    }

                    $details = "<p>" . $details . "</p>";
                    
                    // Check if a note with the same title and details already exists for this deal
                    $existingNote = DealNote::withoutGlobalScopes()
                        ->where('deal_id', $deal->id)
                        ->where('title', $title)
                        ->where('details', $details)
                        ->first();
                    
                    if ($existingNote) {
                        // Note already exists, skip creation
                        continue;
                    }
                    
                    $note = new DealNote();
                    $note->deal_id = $deal->id;
                    $note->title = $title;
                    $note->details = $details;
                    
                    // Override added_by if we have an author
                    if ($authorUser) {
                        $note->added_by = $authorUser->id;
                        $note->last_updated_by = $authorUser->id;
                    }
                    
                    $note->saveQuietly();
                    
                    // Set the created_at timestamp if provided
                    if ($createdDate) {
                        try {
                            $parsedDate = Carbon::parse($createdDate);
                            $note->created_at = $parsedDate;
                            $note->saveQuietly();
                        } catch (\Exception $e) {
                            Log::warning('Bitrix import: Invalid date format for comment', [
                                'created_date' => $createdDate,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }
                    
                    $notesCreated++;
                }
                
                return [
                    'deal_id' => $deal->id,
                    'notes_created' => $notesCreated,
                ];
            });
        } catch (\Exception $e) {
            $this->logoutIfAuthenticated();
            
            Log::error('Bitrix import: Failed to create comments', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);
            
            return Reply::error('Comment creation failed: ' . $e->getMessage());
        }
        
        $this->logoutIfAuthenticated();
        
        return Reply::successWithData('Comments synced successfully.', [
            'deal_id' => $result['deal_id'],
            'notes_created' => $result['notes_created'],
        ]);
    }

    public function taskImport(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID') ?? 1;
        $bitrixDealId = $request->input('dealId');
        $tasks = $request->input('tasks', []);
        
        if (!$bitrixDealId) {
            return Reply::error('Bitrix deal ID is required.');
        }
        
        if (empty($tasks)) {
            return Reply::error('Tasks array is required.');
        }
        
        try {
            $result = DB::transaction(function () use ($bitrixDealId, $tasks, $companyId) {
                // All database operations are wrapped in this transaction
                // If any operation fails, the entire transaction will be rolled back
                
                // Find the deal by bitrix_id
                $deal = Deal::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('bitrix_id', $bitrixDealId)
                    ->first();
                
                if (!$deal) {
                    throw new \RuntimeException('Deal not found with Bitrix ID: ' . $bitrixDealId);
                }
                
                $tasksCreated = 0;
                $tasksSkipped = 0;
                $createdTasks = [];
                
                // Get default board columns (DB query within transaction)
                $incompleteColumn = TaskboardColumn::where('slug', 'incomplete')
                    ->where('company_id', $companyId)
                    ->first();
                
                $completedColumn = TaskboardColumn::where('slug', 'completed')
                    ->where('company_id', $companyId)
                    ->first();
                
                if (!$incompleteColumn) {
                    throw new \RuntimeException('Default task board column (incomplete) not found for company: ' . $companyId);
                }
                
                // Process each task
                foreach ($tasks as $taskData) {
                    try {
                        // Reset auth state at the start of each iteration to prevent cross-contamination
                        auth()->logout();
                        
                        $taskHeading = trim((string) Arr::get($taskData, 'heading', ''));
                        
                        if (empty($taskHeading)) {
                            Log::warning('Bitrix task import: Skipping task with empty heading', [
                                'task_data' => $taskData,
                            ]);
                            $tasksSkipped++;
                            continue;
                        }
                        
                        // Check for duplicate task: same heading and linked to the same deal (DB query within transaction)
                        $existingTask = $deal->tasks()
                            ->where('heading', $taskHeading)
                            ->where('company_id', $companyId)
                            ->first();
                        
                        if ($existingTask) {
                            Log::info('Bitrix task import: Duplicate task skipped', [
                                'task_heading' => $taskHeading,
                                'existing_task_id' => $existingTask->id,
                                'deal_id' => $deal->id,
                            ]);
                            $tasksSkipped++;
                            continue;
                        }
                        // Resolve user IDs from emails
                        $userIds = [];
                        $userEmails = Arr::get($taskData, 'user_emails', []);
                        
                        if (!empty($userEmails) && is_array($userEmails)) {
                            foreach ($userEmails as $email) {
                                $email = trim((string) $email);
                                if ($email === '') {
                                    continue;
                                }
                                
                                // DB query within transaction
                                $user = User::withoutGlobalScopes()
                                    ->where('company_id', $companyId)
                                    ->where('email', $email)
                                    ->first();
                                
                                if ($user) {
                                    $userIds[] = $user->id;
                                } else {
                                    Log::warning('Bitrix task import: User not found by email', [
                                        'email' => $email,
                                        'company_id' => $companyId,
                                    ]);
                                }
                            }
                        }
                        
                        // Normalize priority (normal -> medium)
                        $priority = strtolower(trim(Arr::get($taskData, 'priority', 'medium')));
                        if ($priority === 'normal') {
                            $priority = 'medium';
                        }
                        if (!in_array($priority, ['low', 'medium', 'high'])) {
                            $priority = 'medium';
                        }
                        
                        // Parse dates - check both due_date and deadline fields
                        $dueDate = null;
                        $dueDateStr = Arr::get($taskData, 'due_date');
                        if (empty($dueDateStr) || $dueDateStr === '0') {
                            // Fallback to deadline field if due_date is not provided
                            $dueDateStr = Arr::get($taskData, 'deadline');
                        }
                        
                        if ($dueDateStr && $dueDateStr !== '0') {
                            try {
                                // Try parsing as DD-MM-YYYY format
                                $dueDate = Carbon::createFromFormat('d-m-Y', $dueDateStr);
                            } catch (\Exception $e) {
                                // Fallback to Carbon parse
                                $dueDate = $this->parseDate($dueDateStr);
                            }
                        }
                        
                        $startDate = null;
                        $startDateStr = Arr::get($taskData, 'start_date');
                        if ($startDateStr && $startDateStr !== '0') {
                            try {
                                // Try parsing as DD-MM-YYYY format
                                $startDate = Carbon::createFromFormat('d-m-Y', $startDateStr);
                            } catch (\Exception $e) {
                                // Fallback to Carbon parse
                                $startDate = $this->parseDate($startDateStr);
                            }
                        }
                        
                        // Handle 0 values - convert to null
                        $projectId = $this->toInt(Arr::get($taskData, 'project_id'));
                        $projectId = ($projectId === 0 || $projectId === null) ? null : $projectId;
                        
                        $categoryId = $this->toInt(Arr::get($taskData, 'category_id'));
                        $categoryId = ($categoryId === 0 || $categoryId === null) ? null : $categoryId;
                        
                        // Determine board column based on COMPLETED field or board_column_id
                        $boardColumnId = $this->toInt(Arr::get($taskData, 'board_column_id'));
                        $completed = strtoupper(trim((string) Arr::get($taskData, 'COMPLETED', '')));
                        
                        if ($boardColumnId === 0 || $boardColumnId === null) {
                            // Use COMPLETED field to determine status
                            if ($completed === 'Y' && $completedColumn) {
                                $boardColumnId = $completedColumn->id;
                            } else {
                                // Default to incomplete for "N" or empty
                                $boardColumnId = $incompleteColumn->id;
                            }
                        }
                        
                        $milestoneId = $this->toInt(Arr::get($taskData, 'milestone_id'));
                        $milestoneId = ($milestoneId === 0 || $milestoneId === null) ? null : $milestoneId;
                        
                        // Get task labels
                        $taskLabels = Arr::get($taskData, 'task_labels', []);
                        if (!is_array($taskLabels)) {
                            $taskLabels = [];
                        }
                        // Filter out 0 values
                        $taskLabels = array_filter($taskLabels, function($labelId) {
                            return $labelId !== 0 && $labelId !== null;
                        });
                        
                        // Create the task
                        $task = new Task();
                        $task->company_id = $companyId;
                        $task->heading = $taskHeading;
                        $task->description = trim_editor(Arr::get($taskData, 'description', ''));
                        $task->due_date = $dueDate;
                        $task->start_date = $startDate;
                        $task->project_id = $projectId;
                        $task->task_category_id = $categoryId;
                        $task->priority = $priority;
                        $task->board_column_id = $boardColumnId;
                        $task->is_private = $this->toBoolean(Arr::get($taskData, 'is_private')) ? 1 : 0;
                        $task->billable = $this->toBoolean(Arr::get($taskData, 'billable')) ? 1 : 0;
                        $task->estimate_hours = $this->toInt(Arr::get($taskData, 'estimate_hours')) ?? 0;
                        $task->estimate_minutes = $this->toInt(Arr::get($taskData, 'estimate_minutes')) ?? 0;
                        $task->repeat = $this->toBoolean(Arr::get($taskData, 'repeat')) ? 1 : 0;
                        $task->milestone_id = $milestoneId;
                        
                        // Set authenticated user for observer to work properly
                        // Use withoutGlobalScopes() to be consistent with initial user lookup
                        if (!empty($userIds)) {
                            // DB query within transaction - use withoutGlobalScopes() for consistency
                            $firstUser = User::withoutGlobalScopes()->find($userIds[0]);
                            if ($firstUser) {
                                auth()->setUser($firstUser);
                            }
                        }
                        
                        // Save the task (DB operation within transaction)
                        $task->saveQuietly();
                        
                        // Sync task labels (DB operation within transaction)
                        if (!empty($taskLabels)) {
                            $task->labels()->sync($taskLabels);
                        }
                        
                        // Sync task users (DB operation within transaction)
                        if (!empty($userIds)) {
                            $task->users()->sync($userIds);
                        }
                        
                        // Link task to deal using polymorphic relationship (DB operation within transaction)
                        $deal->tasks()->syncWithoutDetaching([$task->id]);
                        
                        $tasksCreated++;
                        $createdTasks[] = [
                            'id' => $task->id,
                            'heading' => $task->heading,
                        ];
                        
                    } catch (\Exception $e) {
                        Log::error('Bitrix task import: Failed to create individual task', [
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                        ]);
                        // Continue with next task instead of failing entire import
                        continue;
                    }
                }
                
                return [
                    'deal_id' => $deal->id,
                    'tasks_created' => $tasksCreated,
                    'tasks_skipped' => $tasksSkipped,
                ];
            });
        } catch (\Exception $e) {
            $this->logoutIfAuthenticated();
            
            Log::error('Bitrix task import: Failed to create tasks', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'deal_id' => $bitrixDealId,
            ]);
            
            return Reply::error('Task creation failed: ' . $e->getMessage());
        }
        
        $this->logoutIfAuthenticated();
        
        return Reply::successWithData('Tasks synced successfully.', [
            'deal_id' => $result['deal_id'],
            'tasks_created' => $result['tasks_created'],
            'tasks_skipped' => $result['tasks_skipped'],
        ]);
    }

    private function resolveResponsibleUser(array $responsibleData, int $companyId): ?User
    {
        $email = trim((string) Arr::get($responsibleData, 'email'));
        $name = trim((string) Arr::get($responsibleData, 'name'));

        if ($email === '') {
            return null;
        }

        $user = User::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('email', $email)
            ->first();

        if ($user) {
            return $user;
        }

        $password = Str::random(16);

        $user = new User();
        $user->company_id = $companyId;
        $user->email = $email;
        $user->name = $name !== '' ? $name : Str::before($email, '@');
        $user->password = Hash::make($password);
        $user->status = 'active';
        $user->save();

        // Create EmployeeDetails first (before attaching roles)
        // This matches the pattern in EmployeeController and may be expected by observers/events
        EmployeeDetails::firstOrCreate(
            [
                'user_id' => $user->id,
                'company_id' => $companyId,
            ],
            [
                'joining_date' => now(),
            ]
        );

        $employeeRole = Role::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('name', 'employee')
            ->first();

        $salesRole = Role::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('name', 'sales agent')
            ->first();

        // Only attach roles that exist
        $rolesToAttach = array_filter([$employeeRole, $salesRole]);
        
        if (empty($rolesToAttach)) {
            // If no roles exist, try to find any role or skip role assignment
            // This prevents errors when roles haven't been set up yet
            Log::warning('Bitrix import: No employee or sales agent roles found for company', [
                'company_id' => $companyId,
                'user_email' => $user->email,
            ]);
        } else {
            foreach ($rolesToAttach as $role) {
                if ($role && $role->id) {
                    // attachRole expects a Role object, not an ID
                    $user->attachRole($role);
                    $user->assignUserRolePermission($role->id);
                }
            }
        }

        return $user;
    }

    private function upsertLead(array $contactData, int $companyId, ?User $responsibleUser): Lead
    {
        $email = trim((string) Arr::get($contactData, 'email'));
        $phone = trim((string) Arr::get($contactData, 'phone'));
        $name = trim((string) Arr::get($contactData, 'name'));

        $lead = null;

        if ($email !== '') {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('client_email', $email)
                ->first();
        }

        if (!$lead && $phone !== '') {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('mobile', $phone)
                ->first();
        }

        if (!$lead && $name !== '') {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('client_name', $name)
                ->first();
        }

        if (!$lead) {
            $lead = new Lead();
            $lead->company_id = $companyId;
            $lead->client_email = $email !== '' ? $email : null;
            $lead->client_name = $name !== '' ? $name : 'Unknown Lead';
            $lead->mobile = $phone !== '' ? $phone : null;
            $lead->address = Arr::get($contactData, 'address');
            $lead->note = Arr::get($contactData, 'comments');
            if ($responsibleUser) {
                $lead->lead_owner = $responsibleUser->id;
            }
            $lead->column_priority = 0;
            
            // Set created_at from payload if provided
            if ($createdDate = $this->parseDate(Arr::get($contactData, 'createdDate'))) {
                $lead->created_at = $createdDate;
            }
            
            $lead->save();
        } else {
            $lead->client_name = $name !== '' ? $name : $lead->client_name;
            if ($email !== '' && $lead->client_email !== $email) {
                $lead->client_email = $email;
            }
            if ($phone !== '' && $lead->mobile !== $phone) {
                $lead->mobile = $phone;
            }
            $lead->address = Arr::get($contactData, 'address', $lead->address);
            $lead->note = $this->combineNotes($lead->note, Arr::get($contactData, 'comments'));
            if ($responsibleUser && !$lead->lead_owner) {
                $lead->lead_owner = $responsibleUser->id;
            }
            $lead->save();
        }

        $marketingPayload = [
            'utm_source' => Arr::get($contactData, 'utmSource'),
            'utm_medium' => Arr::get($contactData, 'utmMedium'),
            'utm_campaign' => Arr::get($contactData, 'utmCampaign'),
            'utm_term' => Arr::get($contactData, 'utmTerm'),
            'utm_content' => Arr::get($contactData, 'utmContent'),
            'facebook_click_id' => Arr::get($contactData, 'facebookClickId'),
            'facebook_lead_id' => Arr::get($contactData, 'facebookLeadId'),
            'last_webinar_date' => $this->parseDate(Arr::get($contactData, 'webinarDate')),
            'contact_score' => $this->toInt(Arr::get($contactData, 'score')),
            'has_registered_for_the_webinar' => $this->toBoolean(Arr::get($contactData, 'hasRegisteredTheWebinar')) ?? false,
            'has_joined_the_facebook_group' => $this->toBoolean(Arr::get($contactData, 'hasJoinedFacebookGroup')) ?? false,
            'has_downloaded_the_ebook' => $this->toBoolean(Arr::get($contactData, 'hasDownloadedEbook')) ?? false,
        ];

        try {
            $lead->marketing()->updateOrCreate(
                ['lead_id' => $lead->id],
                $marketingPayload
            );
        } catch (\Exception $e) {
            // Log but don't fail the import if marketing data fails
            Log::warning('Bitrix import: Failed to upsert lead marketing data', [
                'lead_id' => $lead->id,
            ]);
        }

        return $lead;
    }

    private function handleBitrixImportFailure(Throwable $e, array $payload)
    {
        $contactEmail = Arr::get($payload, 'contact.email');
        $responsibleEmail = Arr::get($payload, 'responsiblePerson.email');

        Log::error('Bitrix import failed', [
            'message' => $e->getMessage(),
            'exception_type' => get_class($e),
            'exception_code' => $e->getCode(),
            'exception_trace' => $e->getTraceAsString(),
            'deal_name' => Arr::get($payload, 'deal.dealName'),
            'contact_email_present' => !empty($contactEmail),
            'responsible_email_present' => !empty($responsibleEmail),
        ]);

        // Always return a generic message to avoid leaking internals even if debug is enabled.
        $message = 'Unable to sync Bitrix deal. Please verify the payload and try again.';

        return Reply::error($message);
    }

    private function logoutIfAuthenticated(): void
    {
        if (auth()->check()) {
            auth()->logout();
        }
    }

    private function resolvePipelineAndStage(array $dealData, int $companyId): array
    {
        $pipelineName = trim((string) Arr::get($dealData, 'pipeline'));
        $stageIdentifier = Arr::get($dealData, 'dealStage');

        $pipeline = null;
        if ($pipelineName !== '') {
            $pipeline = LeadPipeline::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('name', $pipelineName)
                ->first();
        }

        $stage = null;

        if ($stageIdentifier !== null && $stageIdentifier !== '') {
            // If stageIdentifier is numeric, prioritize ID matching
            if (is_numeric($stageIdentifier)) {
                $stageId = (int) $stageIdentifier;
                
                // First, try to find the stage in the specified pipeline (if pipeline was found)
                if ($pipeline) {
                    $stage = PipelineStage::withoutGlobalScopes()
                        ->where('company_id', $companyId)
                        ->where('lead_pipeline_id', $pipeline->id)
                        ->where('id', $stageId)
                        ->first();
                }
                
                // If not found in the pipeline, try finding by ID globally (stage might exist in another pipeline)
                if (!$stage) {
                    $stage = PipelineStage::withoutGlobalScopes()
                        ->where('company_id', $companyId)
                        ->where('id', $stageId)
                        ->first();
                    
                    // Log a warning if stage was found but in a different pipeline
                    if ($stage && $pipeline && $stage->lead_pipeline_id !== $pipeline->id) {
                        Log::warning('Bitrix import: Stage found in different pipeline than specified', [
                            'stage_id' => $stageId,
                            'found_pipeline_id' => $stage->lead_pipeline_id,
                            'specified_pipeline_id' => $pipeline->id,
                            'specified_pipeline_name' => $pipeline->name,
                        ]);
                    }
                }
                
                // If still not found by ID, log an error
                if (!$stage) {
                    Log::warning('Bitrix import: Stage ID not found', [
                        'stage_id' => $stageId,
                        'company_id' => $companyId,
                        'pipeline_id' => $pipeline?->id,
                        'pipeline_name' => $pipeline?->name,
                    ]);
                }
            }
            
            // If not found by ID (or not numeric), try name and slug
            if (!$stage) {
                $stage = PipelineStage::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->when($pipeline, function ($query) use ($pipeline) {
                        $query->where('lead_pipeline_id', $pipeline->id);
                    })
                    ->where(function ($query) use ($stageIdentifier) {
                        $query->where('name', $stageIdentifier)
                            ->orWhere('slug', $stageIdentifier);
                    })
                    ->first();
            }
        }

        if (!$stage && $pipeline) {
            $stage = PipelineStage::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('lead_pipeline_id', $pipeline->id)
                ->orderBy('priority')
                ->first();
        }

        if (!$stage) {
            $stage = PipelineStage::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->orderBy('priority')
                ->first();
        }

        if (!$stage) {
            return [null, null];
        }

        if (!$pipeline) {
            $pipeline = $stage->pipeline;
            
            if ($pipeline === null) {
                Log::warning('Bitrix import: Failed to load pipeline from stage', [
                    'stage_id' => $stage->id,
                    'company_id' => $companyId,
                ]);
            }
        }

        return [$pipeline, $stage];
    }

    private function upsertHibarrFields(Deal $deal, array $dealData): void
    {
        $hibarrFields = [
            'budget_range' => Arr::get($dealData, 'customerBudget') ?? '',
            'inspection_trip_date' => $this->parseDate(Arr::get($dealData, 'nextMeeting')),
            'strategy_meeting_booked' => $this->toBoolean(Arr::get($dealData, 'strategyMeeting')) ? 1 : 0,
            'downpayment_paid' => $this->toBoolean(Arr::get($dealData, 'downpayment')) ? 1 : 0,
            'deposit_confirmation' => Arr::get($dealData, 'depositConfirmation') ?? '',
            'reservation_agreement' => Arr::get($dealData, 'reservationAgreement') ?? '',
            'sales_contract' => Arr::get($dealData, 'salesContract') ?? '',
            'motivation/comment' => Arr::get($dealData, 'motivation') ?? '',
        ];

        HibarrDealFields::updateOrCreate(
            ['deal_id' => $deal->id],
            $hibarrFields
        );
    }

    private function combineNotes(?string $existing, ?string $new): ?string
    {
        $existing = trim((string) $existing);
        $new = trim((string) $new);

        if ($existing === '') {
            return $new ?: null;
        }

        if ($new === '') {
            return $existing;
        }

        return $existing . "\n\n" . $new;
    }

    private function buildDealNotes(Deal $deal, array $dealData, array $contactData): ?string
    {
        $additional = [];

        if ($amount = Arr::get($dealData, 'amountPaid')) {
            $additional[] = 'Amount Paid: ' . $amount;
        }

        if ($passport = Arr::get($dealData, 'passport')) {
            $additional[] = 'Passport Details: ' . (is_array($passport) ? json_encode($passport) : (string) $passport);
        }

        if ($agentContract = Arr::get($dealData, 'agentContract')) {
            $additional[] = 'Agent Contract: ' . $agentContract;
        }

        if ($invoice = Arr::get($dealData, 'invoice')) {
            $additional[] = 'Invoice: ' . $invoice;
        }

        if ($receipts = Arr::get($dealData, 'recipts')) {
            $additional[] = 'Receipts: ' . $receipts;
        }

        if ($kickoffResult = Arr::get($dealData, 'KickoffMeetingResult_attendance')) {
            $additional[] = 'Kickoff Meeting Result: ' . $kickoffResult;
        }

        if ($language = Arr::get($contactData, 'language')) {
            $additional[] = 'Preferred Language: ' . $language;
        }

        if ($poa = Arr::get($contactData, 'POA')) {
            $additional[] = 'POA: ' . $poa;
        }

        if (empty($additional)) {
            return $deal->note;
        }

        $summary = "Bitrix Sync Summary:\n" . implode("\n", $additional);
        return $this->combineNotes($deal->note, $summary);
    }

    private function parseDate($value): ?Carbon
    {
        if (empty($value)) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Exception $exception) {
            return null;
        }
    }

    private function toBoolean($value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        $value = strtolower((string) $value);
        $truthy = ['yes', 'true', '1', 'y', 'on'];
        $falsy = ['no', 'false', '0', 'n', 'off'];

        if (in_array($value, $truthy, true)) {
            return true;
        }

        if (in_array($value, $falsy, true)) {
            return false;
        }

        return null;
    }

    private function toFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $normalized = preg_replace('/[^0-9.\-]/', '', (string) $value);
        return is_numeric($normalized) ? (float) $normalized : null;
    }

    private function toInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function scheduleFollowUpIfNeeded(Deal $deal, $nextMeeting): void
    {
        $date = $this->parseDate($nextMeeting);

        if (!$date) {
            return;
        }

        try {
            DealFollowUp::create([
                'deal_id' => $deal->id,
                'next_follow_up_date' => $date,
                'remark' => 'Imported from Bitrix',
                'added_by' => optional(auth()->user())->id,
            ]);
        } catch (\Exception $e) {
            // Log but don't fail the import if follow-up creation fails
            Log::warning('Bitrix import: Failed to create deal follow-up', [
                'deal_id' => $deal->id,
                'next_meeting' => $nextMeeting,
            ]);
        }
    }
}
