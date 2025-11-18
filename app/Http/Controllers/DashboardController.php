<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\DashboardWidget;
use App\Models\DealFollowUp;
use App\Models\EmployeeDetails;
use App\Models\Event;
use App\Models\Holiday;
use App\Models\LeadPipeline;
use App\Models\Leave;
use App\Models\ProjectTimeLog;
use App\Models\ProjectTimeLogBreak;
use App\Models\PushNotificationSetting;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\Ticket;
use App\Traits\ClientDashboard;
use App\Traits\ClientPanelDashboard;
use App\Traits\CurrencyExchange;
use App\Traits\EmployeeDashboard;
use App\Traits\FinanceDashboard;
use App\Traits\HRDashboard;
use App\Traits\OverviewDashboard;
use App\Traits\ProjectDashboard;
use App\Traits\TicketDashboard;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Froiden\Envato\Traits\AppBoot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;


class DashboardController extends AccountBaseController
{

    use AppBoot, CurrencyExchange, OverviewDashboard, EmployeeDashboard, ProjectDashboard, ClientDashboard, HRDashboard, TicketDashboard, FinanceDashboard, ClientPanelDashboard;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.dashboard';

        $this->middleware(function ($request, $next) {
            return $next($request);
        });

    }

    /**
     * @return array|\Illuminate\Contracts\Foundation\Application|\Illuminate\Contracts\View\Factory|\Illuminate\Contracts\View\View|\Illuminate\Http\Response|mixed|void
     */
    public function index()
    {

        $this->isCheckScript();
        session()->forget(['qr_clock_in']);
        
        // Check if the request wants the new dashboard overview
        // if (request()->header('X-Inertia') || request()->wantsJson()) {
        if (true) {
            return $this->dashboardOverview();
        }
        
        if (in_array('employee', user_roles())) {

            $this->viewOverviewDashboard = user()->permission('view_overview_dashboard');
            $this->viewProjectDashboard = user()->permission('view_project_dashboard');
            $this->viewClientDashboard = user()->permission('view_client_dashboard');
            $this->viewHRDashboard = user()->permission('view_hr_dashboard');
            $this->viewTicketDashboard = user()->permission('view_ticket_dashboard');
            $this->viewFinanceDashboard = user()->permission('view_finance_dashboard');

            return $this->employeeDashboard();
        }

        if (in_array('client', user_roles())) {
            return $this->clientPanelDashboard();
        }
    }

    /**
     * Dashboard Overview with widgets
     */
    public function dashboardOverview()
    {
        $userId = user()->id;
        $viewTaskPermission = user()->permission('view_tasks');
        $viewDealPermission = user()->permission('view_deals');
        $viewLeadPermission = user()->permission('view_lead');
        
        // Get upcoming tasks ordered by due date
        $tasksQuery = Task::with([
            'project:id,project_name,project_short_code', 
            'users:id,name,image', 
            'boardColumn:id,column_name,slug', 
            'category:id,category_name',
            'labels'  // Remove column specification to let the model handle the accessor
        ])
            ->where('board_column_id', '!=', function($query) {
                $query->select('id')->from('taskboard_columns')->where('slug', 'completed');
            });

        // Apply permission-based filtering for tasks
        if ($viewTaskPermission == 'added') {
            $tasksQuery->where('added_by', $userId);
        } elseif ($viewTaskPermission == 'owned') {
            $tasksQuery->whereHas('users', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            });
        } elseif ($viewTaskPermission == 'both') {
            $tasksQuery->where(function ($query) use ($userId) {
                $query->where('added_by', $userId)
                      ->orWhereHas('users', function ($subQuery) use ($userId) {
                          $subQuery->where('user_id', $userId);
                      });
            });
        }

        $tasks = $tasksQuery->orderBy(
                \DB::raw("CASE 
                    WHEN due_date IS NOT NULL AND due_date < NOW() THEN 1
                    WHEN due_date IS NOT NULL AND DATE(due_date) = CURDATE() THEN 2
                    ELSE 3
                END")
            )
            ->orderBy('due_date', 'asc')
            ->limit(20)
            ->get()
            ->map(function ($task) {
                return [
                    'id' => $task->id,
                    'heading' => $task->heading,
                    'description' => $task->description,
                    'due_date' => $task->due_date?->toDateString(),
                    'start_date' => $task->start_date?->toDateString(),
                    'priority' => $task->priority,
                    'status' => $task->boardColumn->slug ?? 'incomplete',
                    'board_column_id' => $task->board_column_id,
                    'project' => $task->project ? [
                        'id' => $task->project->id,
                        'project_name' => $task->project->project_name,
                        'project_short_code' => $task->project->project_short_code,
                    ] : null,
                    'category' => $task->category ? [
                        'id' => $task->category->id,
                        'category_name' => $task->category->category_name,
                    ] : null,
                    'users' => $task->users->map(function ($user) {
                        return [
                            'id' => $user->id,
                            'name' => $user->name,
                            'image' => $user->image_url,
                        ];
                    })->toArray(),
                    'labels' => $task->labels->map(function ($label) {
                        return [
                            'id' => $label->id,
                            'label_name' => $label->label_name,
                            'label_color' => $label->label_color,
                        ];
                    })->toArray(),
                    'estimate_hours' => $task->estimate_hours,
                    'estimate_minutes' => $task->estimate_minutes,
                    'is_private' => $task->is_private,
                    'billable' => $task->billable,
                    'without_duedate' => $task->without_duedate,
                ];
            });

        // Get pipeline stages for deals tracker
        $pipelineStages = \App\Models\PipelineStage::orderBy('priority', 'asc')
            ->get()
            ->map(function ($stage) {
                return [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'label_color' => $stage->label_color,
                    'priority' => $stage->priority,
                ];
            });

        // Get deals for pipeline view
        $dealsQuery = \App\Models\Deal::with([
            'contact:id,client_name,client_email,mobile',
            'leadStage:id,name,label_color,priority',
            'currency:id,currency_symbol',
            'category:id,category_name',
            'leadAgent.user:id,name,image'
        ])->orderBy('updated_at', 'desc');

        // Apply permission-based filtering for deals
        if ($viewDealPermission == 'added') {
            $dealsQuery->where('added_by', $userId);
        } elseif ($viewDealPermission == 'owned') {
            $dealsQuery->where(function($query) use ($userId) {
                $query->whereHas('leadAgent', function($q) use ($userId) {
                    $q->where('user_id', $userId);
                })->orWhereHas('dealWatchers', function($q) use ($userId) {
                    $q->where('users.id', $userId);
                });
            });
        } elseif ($viewDealPermission == 'both') {
            $dealsQuery->where(function($query) use ($userId) {
                $query->where('added_by', $userId)
                      ->orWhereHas('leadAgent', function($q) use ($userId) {
                          $q->where('user_id', $userId);
                      })
                      ->orWhereHas('dealWatchers', function($q) use ($userId) {
                          $q->where('users.id', $userId);
                      });
            });
        }

        $allDeals = $dealsQuery->get()
            ->map(function ($deal) {
                return [
                    'id' => $deal->id,
                    'name' => $deal->name,
                    'value' => $deal->value,
                    'close_date' => $deal->close_date,
                    'pipeline_stage_id' => $deal->pipeline_stage_id,
                    'probability' => $deal->probability,
                    'contact' => $deal->contact ? [
                        'id' => $deal->contact->id,
                        'client_name' => $deal->contact->client_name,
                        'client_email' => $deal->contact->client_email,
                        'mobile' => $deal->contact->mobile,
                    ] : null,
                    'lead_stage' => $deal->leadStage ? [
                        'id' => $deal->leadStage->id,
                        'name' => $deal->leadStage->name,
                        'label_color' => $deal->leadStage->label_color,
                        'priority' => $deal->leadStage->priority,
                    ] : null,
                    'category' => $deal->category ? [
                        'id' => $deal->category->id,
                        'category_name' => $deal->category->category_name,
                    ] : null,
                    'agent' => $deal->leadAgent && $deal->leadAgent->user ? [
                        'id' => $deal->leadAgent->user->id,
                        'name' => $deal->leadAgent->user->name,
                        'image' => $deal->leadAgent->user->image_url,
                    ] : null,
                    'currency' => $deal->currency ? [
                        'currency_symbol' => $deal->currency->currency_symbol,
                    ] : null,
                    'updated_at' => $deal->updated_at->toISOString(),
                ];
            });

        $recentDeals = $allDeals->take(10);

        // Enhanced data quality analysis
        $dataQualityRecords = collect();
        
        // Analyze deals for data quality
        $poorDataQualityDeals = $allDeals->map(function ($deal) {
            $missingFields = [];
            $dataIssues = [];
            $totalFields = 0;
            $filledFields = 0;

            // Essential deal fields
            $dealFields = [
                'value' => 'Deal Value',
                'close_date' => 'Close Date',
                'probability' => 'Probability'
            ];

            foreach ($dealFields as $field => $label) {
                $totalFields++;
                $value = data_get($deal, $field);
                if (!empty($value)) {
                    $filledFields++;
                    // Additional validation
                    if ($field === 'probability' && ($value < 0 || $value > 100)) {
                        $dataIssues[] = [
                            'field' => $field,
                            'issue' => 'Probability should be between 0-100%',
                            'severity' => 'medium',
                            'suggestion' => 'Update probability to reflect realistic chance of closing'
                        ];
                    }
                } else {
                    $missingFields[] = $label;
                    $dataIssues[] = [
                        'field' => $field,
                        'issue' => $label . ' is missing',
                        'severity' => $field === 'value' ? 'high' : 'medium',
                        'suggestion' => 'Please provide ' . strtolower($label) . ' information'
                    ];
                }
            }

            // Contact information validation
            if ($deal['contact']) {
                $contactFields = [
                    'client_email' => 'Email',
                    'mobile' => 'Phone'
                ];
                
                foreach ($contactFields as $field => $label) {
                    $totalFields++;
                    $value = data_get($deal, 'contact.' . $field);
                    if (!empty($value)) {
                        $filledFields++;
                        // Email validation
                        if ($field === 'client_email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $dataIssues[] = [
                                'field' => 'contact_email',
                                'issue' => 'Invalid email format',
                                'severity' => 'high',
                                'suggestion' => 'Please provide a valid email address'
                            ];
                        }
                    } else {
                        $missingFields[] = 'Contact ' . $label;
                        $dataIssues[] = [
                            'field' => 'contact_' . $field,
                            'issue' => 'Contact ' . strtolower($label) . ' is missing',
                            'severity' => 'medium',
                            'suggestion' => 'Add contact ' . strtolower($label) . ' for better communication'
                        ];
                    }
                }
            } else {
                $totalFields += 2;
                $missingFields = array_merge($missingFields, ['Contact Email', 'Contact Phone']);
                $dataIssues[] = [
                    'field' => 'contact',
                    'issue' => 'No contact information available',
                    'severity' => 'high',
                    'suggestion' => 'Associate a contact with this deal'
                ];
            }

            // Category and agent validation
            if (!$deal['category']) {
                $totalFields++;
                $missingFields[] = 'Category';
                $dataIssues[] = [
                    'field' => 'category',
                    'issue' => 'Deal category not specified',
                    'severity' => 'low',
                    'suggestion' => 'Categorize deal for better reporting'
                ];
            } else {
                $totalFields++;
                $filledFields++;
            }

            if (!$deal['agent']) {
                $totalFields++;
                $missingFields[] = 'Agent';
                $dataIssues[] = [
                    'field' => 'agent',
                    'issue' => 'No agent assigned',
                    'severity' => 'high',
                    'suggestion' => 'Assign an agent to manage this deal'
                ];
            } else {
                $totalFields++;
                $filledFields++;
            }

            $dataQualityScore = $totalFields > 0 ? round(($filledFields / $totalFields) * 100) : 0;
            
            // Calculate priority score based on value and data quality
            $priorityScore = 0;
            if ($deal['value']) {
                $priorityScore += min(50, ($deal['value'] / 100000) * 30); // Value impact
            }
            $priorityScore += max(0, (100 - $dataQualityScore) * 0.5); // Data quality impact
            $priorityScore = min(100, $priorityScore);

            return [
                'id' => $deal['id'],
                'type' => 'deal',
                'name' => $deal['name'],
                'data_quality_score' => $dataQualityScore,
                'missing_fields' => $missingFields,
                'data_issues' => $dataIssues,
                'contact' => $deal['contact'],
                'value' => $deal['value'],
                'stage' => $deal['lead_stage']['name'] ?? null,
                'agent' => $deal['agent'],
                'updated_at' => $deal['updated_at'],
                'priority_score' => round($priorityScore),
            ];
        })->filter(function ($deal) {
            return $deal['data_quality_score'] < 80; // Only show records that need improvement
        })->sortByDesc('priority_score')->take(10)->values();

        // Get recent communication activities
        $recentActivities = \App\Models\CommunicationActivity::with(['deal:id,name'])
            ->when($viewDealPermission != 'all', function ($query) use ($userId, $viewDealPermission) {
                $query->whereHas('deal', function ($q) use ($userId, $viewDealPermission) {
                    if ($viewDealPermission == 'added') {
                        $q->where('added_by', $userId);
                    } elseif ($viewDealPermission == 'owned') {
                        $q->where(function($subQ) use ($userId) {
                            $subQ->whereHas('leadAgent', function($agentQ) use ($userId) {
                                $agentQ->where('user_id', $userId);
                            })->orWhereHas('dealWatchers', function($watcherQ) use ($userId) {
                                $watcherQ->where('users.id', $userId);
                            });
                        });
                    } elseif ($viewDealPermission == 'both') {
                        $q->where(function($subQ) use ($userId) {
                            $subQ->where('added_by', $userId)
                                  ->orWhereHas('leadAgent', function($agentQ) use ($userId) {
                                      $agentQ->where('user_id', $userId);
                                  })
                                  ->orWhereHas('dealWatchers', function($watcherQ) use ($userId) {
                                      $watcherQ->where('users.id', $userId);
                                  });
                        });
                    }
                });
            })
            ->orderBy('timestamp', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($activity) {
                return [
                    'id' => $activity->id,
                    'channel_type' => $activity->channel_type,
                    'message_content' => $activity->message_content,
                    'timestamp' => $activity->timestamp->toISOString(),
                    'sender_info' => $activity->sender_info,
                    'deal' => $activity->deal ? [
                        'id' => $activity->deal->id,
                        'name' => $activity->deal->name,
                    ] : null,
                ];
            });

        // Calculate comprehensive overview metrics
        $completedColumn = TaskboardColumn::where('slug', 'completed')->first();
        
        $currentMonthDealsCount = $allDeals->filter(function ($deal) {
            return \Carbon\Carbon::parse($deal['updated_at'])->isCurrentMonth();
        })->count();
        
        $lastMonthDealsCount = \App\Models\Deal::whereMonth('created_at', now()->subMonth()->month)
            ->whereYear('created_at', now()->subMonth()->year)
            ->when($viewDealPermission == 'added', function ($query) use ($userId) {
                $query->where('added_by', $userId);
            })
            ->when($viewDealPermission == 'owned', function ($query) use ($userId) {
                $query->where(function($q) use ($userId) {
                    $q->whereHas('leadAgent', function($subQ) use ($userId) {
                        $subQ->where('user_id', $userId);
                    })->orWhereHas('dealWatchers', function($subQ) use ($userId) {
                        $subQ->where('users.id', $userId);
                    });
                });
            })
            ->when($viewDealPermission == 'both', function ($query) use ($userId) {
                $query->where(function($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhereHas('leadAgent', function($subQ) use ($userId) {
                          $subQ->where('user_id', $userId);
                      })
                      ->orWhereHas('dealWatchers', function($subQ) use ($userId) {
                          $subQ->where('users.id', $userId);
                      });
                });
            })
            ->count();

        $dealsTrend = $lastMonthDealsCount > 0 
            ? round((($currentMonthDealsCount - $lastMonthDealsCount) / $lastMonthDealsCount) * 100)
            : ($currentMonthDealsCount > 0 ? 100 : 0);

        // Lead metrics (you may need to adjust based on your Lead model structure)
        $activeLeadsCount = \App\Models\Lead::when($viewLeadPermission == 'added', function ($query) use ($userId) {
                $query->where('added_by', $userId);
            })
            ->when($viewLeadPermission == 'owned', function ($query) use ($userId) {
                $query->where('lead_owner', $userId);
            })
            ->when($viewLeadPermission == 'both', function ($query) use ($userId) {
                $query->where(function($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhere('lead_owner', $userId);
                });
            })
            ->count();

        $openDealsCount = $allDeals->filter(function ($deal) {
            $closedStages = ['won', 'lost', 'closed']; // Adjust based on your stage names
            $stageSlug = strtolower($deal['lead_stage']['name'] ?? '');
            return !in_array($stageSlug, $closedStages);
        })->count();

        $closedDealsCount = $allDeals->filter(function ($deal) {
            $closedStages = ['won', 'closed']; // Adjust based on your stage names
            $stageSlug = strtolower($deal['lead_stage']['name'] ?? '');
            return in_array($stageSlug, $closedStages);
        })->count();

        // Calculate quota progress (you may need to adjust based on your quota system)
        $currentMonthValue = $allDeals->filter(function ($deal) {
            return \Carbon\Carbon::parse($deal['updated_at'])->isCurrentMonth();
        })->sum('value');
        
        $monthlyQuota = 1000000; // You should get this from user settings or company settings
        
        // Conversion rate calculation
        $totalLeads = \App\Models\Lead::when($viewLeadPermission == 'added', function ($query) use ($userId) {
                $query->where('added_by', $userId);
            })
            ->when($viewLeadPermission == 'owned', function ($query) use ($userId) {
                $query->where('lead_owner', $userId);
            })
            ->when($viewLeadPermission == 'both', function ($query) use ($userId) {
                $query->where(function($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhere('lead_owner', $userId);
                });
            })
            ->count();
        
        $conversionRate = $totalLeads > 0 ? round(($allDeals->count() / $totalLeads) * 100, 1) : 0;

        $overviewMetrics = [
            'activeLeads' => $activeLeadsCount,
            'openDeals' => $openDealsCount,
            'closedDeals' => $closedDealsCount,
            'quotaProgress' => [
                'current' => $currentMonthValue,
                'target' => $monthlyQuota,
            ],
            'conversionRate' => $conversionRate,
            'trends' => [
                'openDeals' => [
                    'value' => abs($dealsTrend),
                    'isPositive' => $dealsTrend >= 0,
                ],
                'conversionRate' => [
                    'value' => 5, // You would calculate this based on historical data
                    'isPositive' => true,
                ],
            ],
        ];

        // Calculate basic stats for backwards compatibility  
        $pendingTasksCount = Task::where('board_column_id', '!=', $completedColumn?->id)
            ->when($viewTaskPermission == 'added', function ($query) use ($userId) {
                $query->where('added_by', $userId);
            })
            ->when($viewTaskPermission == 'owned', function ($query) use ($userId) {
                $query->whereHas('users', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                });
            })
            ->when($viewTaskPermission == 'both', function ($query) use ($userId) {
                $query->where(function ($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhereHas('users', function ($subQ) use ($userId) {
                          $subQ->where('user_id', $userId);
                      });
                });
            })
            ->count();
            
        // Update overview metrics to use calculated pending activities
        $overviewMetrics['pendingActivities'] = $pendingTasksCount;
        
        $stats = [
            'total_tasks' => Task::when($viewTaskPermission == 'added', function ($query) use ($userId) {
                $query->where('added_by', $userId);
            })
            ->when($viewTaskPermission == 'owned', function ($query) use ($userId) {
                $query->whereHas('users', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                });
            })
            ->when($viewTaskPermission == 'both', function ($query) use ($userId) {
                $query->where(function ($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhereHas('users', function ($subQ) use ($userId) {
                          $subQ->where('user_id', $userId);
                      });
                });
            })
            ->count(),
            
            'completed_tasks' => Task::where('board_column_id', $completedColumn?->id)
                ->when($viewTaskPermission == 'added', function ($query) use ($userId) {
                    $query->where('added_by', $userId);
                })
                ->when($viewTaskPermission == 'owned', function ($query) use ($userId) {
                    $query->whereHas('users', function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    });
                })
                ->when($viewTaskPermission == 'both', function ($query) use ($userId) {
                    $query->where(function ($q) use ($userId) {
                        $q->where('added_by', $userId)
                          ->orWhereHas('users', function ($subQ) use ($userId) {
                              $subQ->where('user_id', $userId);
                          });
                    });
                })
                ->count(),
            
            'pending_tasks' => Task::where('board_column_id', '!=', $completedColumn?->id)
                ->when($viewTaskPermission == 'added', function ($query) use ($userId) {
                    $query->where('added_by', $userId);
                })
                ->when($viewTaskPermission == 'owned', function ($query) use ($userId) {
                    $query->whereHas('users', function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    });
                })
                ->when($viewTaskPermission == 'both', function ($query) use ($userId) {
                    $query->where(function ($q) use ($userId) {
                        $q->where('added_by', $userId)
                          ->orWhereHas('users', function ($subQ) use ($userId) {
                              $subQ->where('user_id', $userId);
                          });
                    });
                })
                ->count(),
            
            'overdue_tasks' => Task::where('due_date', '<', now())
                ->where('board_column_id', '!=', $completedColumn?->id)
                ->when($viewTaskPermission == 'added', function ($query) use ($userId) {
                    $query->where('added_by', $userId);
                })
                ->when($viewTaskPermission == 'owned', function ($query) use ($userId) {
                    $query->whereHas('users', function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    });
                })
                ->when($viewTaskPermission == 'both', function ($query) use ($userId) {
                    $query->where(function ($q) use ($userId) {
                        $q->where('added_by', $userId)
                          ->orWhereHas('users', function ($subQ) use ($userId) {
                              $subQ->where('user_id', $userId);
                          });
                    });
                })
                ->count(),
            
            'total_deals' => \App\Models\Deal::when($viewDealPermission == 'added', function ($query) use ($userId) {
                $query->where('added_by', $userId);
            })
            ->when($viewDealPermission == 'owned', function ($query) use ($userId) {
                $query->where(function($q) use ($userId) {
                    $q->whereHas('leadAgent', function($subQ) use ($userId) {
                        $subQ->where('user_id', $userId);
                    })->orWhereHas('dealWatchers', function($subQ) use ($userId) {
                        $subQ->where('users.id', $userId);
                    });
                });
            })
            ->when($viewDealPermission == 'both', function ($query) use ($userId) {
                $query->where(function($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhereHas('leadAgent', function($subQ) use ($userId) {
                          $subQ->where('user_id', $userId);
                      })
                      ->orWhereHas('dealWatchers', function($subQ) use ($userId) {
                          $subQ->where('users.id', $userId);
                      });
                });
            })
            ->count(),
            
            'deals_this_month' => \App\Models\Deal::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->when($viewDealPermission == 'added', function ($query) use ($userId) {
                    $query->where('added_by', $userId);
                })
                ->when($viewDealPermission == 'owned', function ($query) use ($userId) {
                    $query->where(function($q) use ($userId) {
                        $q->whereHas('leadAgent', function($subQ) use ($userId) {
                            $subQ->where('user_id', $userId);
                        })->orWhereHas('dealWatchers', function($subQ) use ($userId) {
                            $subQ->where('users.id', $userId);
                        });
                    });
                })
                ->when($viewDealPermission == 'both', function ($query) use ($userId) {
                    $query->where(function($q) use ($userId) {
                        $q->where('added_by', $userId)
                          ->orWhereHas('leadAgent', function($subQ) use ($userId) {
                              $subQ->where('user_id', $userId);
                          })
                          ->orWhereHas('dealWatchers', function($subQ) use ($userId) {
                              $subQ->where('users.id', $userId);
                          });
                    });
                })
                ->count(),
            
            'total_activities' => \App\Models\CommunicationActivity::count(),
            
            'activities_this_week' => \App\Models\CommunicationActivity::where('timestamp', '>=', now()->startOfWeek())
                ->count(),
            // TODO: Refactor this to be a service that calculates all this data and passes it to the dashboard controller, also the entities ought to be tied explicitly to the authenticated user
        ];

        return inertia('Dashboard/ComprehensiveDashboard', [
            'tasks' => $tasks,
            'deals' => $allDeals,
            'recentDeals' => $recentDeals,
            'poorDataQualityDeals' => $poorDataQualityDeals,
            'recentActivities' => $recentActivities,
            'pipelineStages' => $pipelineStages,
            'overviewMetrics' => $overviewMetrics,
            'stats' => $stats,
        ]);
    }

    public function widget(Request $request, $dashboardType)
    {
        $data = $request->except('_token');

        // Step 1: Reset all widgets' status to 0
        DashboardWidget::where('status', 1)
            ->where('dashboard_type', $dashboardType)
            ->update(['status' => 0]);

        // Step 2: Update the status to 1 for widgets present in the request
        if (!empty($data)) {
            DashboardWidget::where('dashboard_type', $dashboardType)
                ->whereIn('widget_name', array_keys($data))
                ->update(['status' => 1]);
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function checklist()
    {
        if (in_array('admin', user_roles())) {
            $this->isCheckScript();

            return view('dashboard.checklist', $this->data);
        }
    }

    /**
     * @return array|\Illuminate\Http\Response
     */
    public function memberDashboard()
    {
        abort_403(!in_array('employee', user_roles()));

        return $this->employeeDashboard();
    }

    public function advancedDashboard()
    {

        if (in_array('admin', user_roles()) || $this->sidebarUserPermissions['view_overview_dashboard'] == 4
            || $this->sidebarUserPermissions['view_project_dashboard'] == 4
            || $this->sidebarUserPermissions['view_client_dashboard'] == 4
            || $this->sidebarUserPermissions['view_hr_dashboard'] == 4
            || $this->sidebarUserPermissions['view_ticket_dashboard'] == 4
            || $this->sidebarUserPermissions['view_finance_dashboard'] == 4) {

            $tab = request('tab');

            switch ($tab) {
            case 'project':
                $this->projectDashboard();
                break;
            case 'client':
                $this->clientDashboard();
                break;
            case 'hr':
                $this->hrDashboard();
                break;
            case 'ticket':
                $this->ticketDashboard();
                break;
            case 'finance':
                $this->financeDashboard();
                break;
            default:
                if (in_array('admin', user_roles()) || $this->sidebarUserPermissions['view_overview_dashboard'] == 4) {
                    $this->activeTab = $tab ?: 'overview';
                    $this->overviewDashboard();

                }
                elseif ($this->sidebarUserPermissions['view_project_dashboard'] == 4) {
                    $this->activeTab = $tab ?: 'project';
                    $this->projectDashboard();

                }
                elseif ($this->sidebarUserPermissions['view_client_dashboard'] == 4) {
                    $this->activeTab = $tab ?: 'client';
                    $this->clientDashboard();

                }
                elseif ($this->sidebarUserPermissions['view_hr_dashboard'] == 4) {
                    $this->activeTab = $tab ?: 'hr';
                    $this->hrDashboard();

                }
                elseif ($this->sidebarUserPermissions['view_finance_dashboard'] == 4) {
                    $this->activeTab = $tab ?: 'finance';
                    $this->ticketDashboard();

                }
                else if ($this->sidebarUserPermissions['view_ticket_dashboard'] == 4) {
                    $this->activeTab = $tab ?: 'finance';
                    $this->financeDashboard();
                }

                break;
            }

            if (request()->ajax()) {
                return $this->returnAjax($this->view);
            }

            if (!isset($this->activeTab)) {
                $this->activeTab = $tab ?: 'overview';
            }

            return view('dashboard.admin', $this->data);
        }
    }

    public function accountUnverified()
    {
        return view('dashboard.unverified', $this->data);
    }

    public function weekTimelog()
    {
        $now = now(company()->timezone);
        $attndcSetting = attendance_setting();
        $this->timelogDate = $timelogDate = Carbon::parse(request()->date);
        $this->weekStartDate = $now->copy()->startOfWeek($attndcSetting->week_start_from);
        $this->weekEndDate = $this->weekStartDate->copy()->addDays(7);
        $this->weekPeriod = CarbonPeriod::create($this->weekStartDate, $this->weekStartDate->copy()->addDays(6)); // Get All Dates from start to end date

        $this->dateWiseTimelogs = ProjectTimeLog::dateWiseTimelogs($timelogDate->toDateString(), user()->id);
        $this->dateWiseTimelogBreak = ProjectTimeLogBreak::dateWiseTimelogBreak($timelogDate->toDateString(), user()->id);

        $this->weekWiseTimelogs = ProjectTimeLog::weekWiseTimelogs($this->weekStartDate->copy()->toDateString(), $this->weekEndDate->copy()->toDateString(), user()->id);
        $this->weekWiseTimelogBreak = ProjectTimeLogBreak::weekWiseTimelogBreak($this->weekStartDate->toDateString(), $this->weekEndDate->toDateString(), user()->id);

        $this->dayMinutes = $this->dateWiseTimelogs->sum('total_minutes');
        $this->dayBreakMinutes = $this->dateWiseTimelogBreak->sum('total_minutes');
        $loggedMinutes = $this->dayMinutes - $this->dayBreakMinutes;

        $this->totalDayMinutes = $this->formatTime($loggedMinutes);
        $this->totalDayBreakMinutes = $this->formatTime($this->dayBreakMinutes);

        $html = view('dashboard.employee.week_timelog', $this->data)->render();

        return Reply::dataOnly(['html' => $html]);
    }

    private function formatTime($totalMinutes)
    {
        $hours = intdiv($totalMinutes, 60);
        $minutes = $totalMinutes % 60;

        return $hours > 0
            ? $hours . 'h' . ($minutes > 0 ? ' ' . sprintf('%02dm', $minutes) : '')
            : ($minutes > 0 ? sprintf('%dm', $minutes) : '0s');
    }

    public function privateCalendar()
    {
        if (request()->filter) {
            $employee_details = EmployeeDetails::where('user_id', user()->id)->first();
            $employee_details->calendar_view = request()->filter ? request()->filter : null;
            $employee_details->save();
            session()->forget('user');
        }

        $startDate = Carbon::parse(request('start'));
        $endDate = Carbon::parse(request('end'));

        // get calendar view current logined user
        $calendar_filter_array = explode(',', user()->employeeDetail->calendar_view);

        $eventData = array();

        $viewEventPerm = user()->permission('view_events');

        if (!is_null($viewEventPerm) && $viewEventPerm != 'none') {

            if (in_array('events', $calendar_filter_array)) {
                // Events
                $model = Event::with('attendee', 'attendee.user');

                $model->where(function ($query) {
                    $query->whereHas('attendee', function ($query) {
                        $query->where('user_id', user()->id);
                    });
                    $query->orWhere('added_by', user()->id);
                });

                $model->whereBetween('start_date_time', [$startDate->toDateString(), $endDate->toDateString()]);

                $events = $model->get();

                foreach ($events as $event) {
                    $eventData[] = [
                        'id' => $event->id,
                        'title' => $event->event_name,
                        'start' => $event->start_date_time,
                        'end' => $event->end_date_time,
                        'event_type' => 'event',
                        'extendedProps' => ['bg_color' => $event->label_color, 'color' => '#fff', 'icon' => 'fa-calendar']
                    ];
                }
            }

        }
        $user = user();
        $viewHolidayPerm = user()->permission('view_holiday');

        if (!is_null($viewHolidayPerm) && $viewHolidayPerm != 'none') {
            if (in_array('holiday', $calendar_filter_array)) {
                // holiday
                $holidays = Holiday::whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->where(function ($query) use ($user) {
                        $query->where(function ($subquery) use ($user) {
                                $subquery->where(function ($q) use ($user) {
                                    $q->where('department_id_json', 'like', '%"' . $user->employeeDetail->department_id . '"%')
                                        ->orWhereNull('department_id_json');
                                });
                                $subquery->where(function ($q) use ($user) {
                                    $q->where('designation_id_json', 'like', '%"' . $user->employeeDetail->designation_id . '"%')
                                        ->orWhereNull('designation_id_json');
                                });
                                $subquery->where(function ($q) use ($user) {
                                    $q->where('employment_type_json', 'like', '%"' . $user->employeeDetail->employment_type . '"%')
                                        ->orWhereNull('employment_type_json');
                                });
                        });
                    });
                $holidays = $holidays->get();

                foreach ($holidays as $holiday) {
                    $eventData[] = [
                        'id' => $holiday->id,
                        'title' => $holiday->occassion,
                        'start' => $holiday->date,
                        'end' => $holiday->date,
                        'event_type' => 'holiday',
                        'extendedProps' => ['bg_color' => '#1d82f5', 'color' => '#fff', 'icon' => 'fa-star']
                    ];
                }
            }

        }

        $viewTaskPerm = user()->permission('view_tasks');

        if (!is_null($viewTaskPerm) && $viewTaskPerm != 'none') {

            if (in_array('task', $calendar_filter_array)) {
                // tasks
                $completedTaskColumn = TaskboardColumn::completeColumn();

                $tasks = Task::with('boardColumn')
                    ->where('board_column_id', '<>', $completedTaskColumn->id)
                    ->whereHas('users', function ($query) {
                        $query->where('user_id', user()->id);
                    })
                    ->where(function ($q) use ($startDate, $endDate) {
                        $q->whereBetween(DB::raw('DATE(tasks.`due_date`)'), [$startDate->toDateString(), $endDate->toDateString()]);

                        $q->orWhereBetween(DB::raw('DATE(tasks.`start_date`)'), [$startDate->toDateString(), $endDate->toDateString()]);
                    })->get();

                foreach ($tasks as $task) {
                    $eventData[] = [
                        'id' => $task->id,
                        'title' => $task->heading,
                        'start' => $task->start_date,
                        'end' => $task->due_date ?: $task->start_date,
                        'event_type' => 'task',
                        'extendedProps' => ['bg_color' => $task->boardColumn->label_color, 'color' => '#fff', 'icon' => 'fa-list']
                    ];
                }
            }
        }

        $viewTicketPerm = user()->permission('view_tickets');

        if (!is_null($viewTicketPerm) && $viewTicketPerm != 'none') {

            if (in_array('tickets', $calendar_filter_array)) {
                $userid = user()->id;

                // tickets
                $tickets = Ticket::where(function ($query) use ($userid) {
                    $query->where('tickets.user_id', '=', $userid)->orWhere('agent_id', '=', $userid);
                })->whereBetween(DB::raw('DATE(tickets.`created_at`)'), [$startDate->toDateTimeString(), $endDate->endOfDay()->toDateTimeString()])->get();

                foreach ($tickets as $ticket) {
                    $startTime = $ticket->created_at->timezone($this->company->timezone);
                    $endTime = $ticket->created_at->timezone($this->company->timezone);

                    $eventData[] = [
                        'id' => $ticket->ticket_number,
                        'title' => $ticket->subject,
                        'start' => $startTime?->toDateTimeString(),
                        'end' => $endTime?->toDateTimeString(),
                        'event_type' => 'ticket',
                        'extendedProps' => ['bg_color' => '#1d82f5', 'color' => '#fff', 'icon' => 'fa-ticket-alt']
                    ];
                }
            }

        }

        $viewleavePerm = user()->permission('view_leave');

        if (!is_null($viewleavePerm) && $viewleavePerm != 'none') {

            if (in_array('leaves', $calendar_filter_array)) {
                // approved leaves of all emoloyees with employee name
                $leaves = Leave::join('leave_types', 'leave_types.id', 'leaves.leave_type_id')
                    ->where('leaves.status', 'approved')
                    ->select('leaves.id', 'leaves.leave_date', 'leaves.status', 'leave_types.type_name', 'leave_types.color', 'leaves.leave_date', 'leaves.duration', 'leaves.status', 'leaves.user_id')
                    ->with('user')
                    ->whereBetween(DB::raw('DATE(leaves.`leave_date`)'), [$startDate->toDateString(), $endDate->toDateString()])
                    ->get();

                foreach ($leaves as $leave) {
                    $duration = ($leave->duration == 'half day') ? '( ' . __('app.halfday') . ' )' : '';

                    $eventData[] = [
                        'id' => $leave->id,
                        'title' => $duration . ' ' . $leave->user->name,
                        'start' => $leave->leave_date->toDateString(),
                        'end' => $leave->leave_date->toDateString(),
                        'event_type' => 'leave',
                        /** @phpstan-ignore-next-line */
                        'extendedProps' => ['name' => 'Leave : ' . $leave->user->name, 'bg_color' => $leave->color, 'color' => '#fff', 'icon' => 'fa-plane-departure']
                    ];
                }
            }
        }

        $viewDealPerm = user()->permission('view_deals');

        if (!is_null($viewDealPerm) && $viewDealPerm != 'none') {

            if (in_array('follow_ups', $calendar_filter_array)) {
                // follow ups
                $followUps = DealFollowUp::with('lead')->whereHas('lead.leadAgent', function ($query) {
                        $query->where('user_id', user()->id);
                })
                    ->whereBetween(DB::raw('DATE(next_follow_up_date)'), [$startDate->startOfDay()->toDateTimeString(), $endDate->endOfDay()->toDateTimeString()])
                    ->get();

                foreach ($followUps as $followUp) {
                    $eventData[] = [
                        'id' => $followUp->deal_id,
                        'title' => $followUp->lead->name,
                        'start' => $followUp->next_follow_up_date->timezone(company()->timezone),
                        'end' => $followUp->next_follow_up_date->timezone(company()->timezone),
                        'event_type' => 'follow_up',
                        'extendedProps' => ['bg_color' => '#1d82f5', 'color' => '#fff', 'icon' => 'fa-thumbs-up']
                    ];
                }
            }

        }

        return $eventData;
    }

    public function getLeadStage($pipelineId)
    {
        $this->startDate = (request('startDate') != '') ? Carbon::createFromFormat($this->company->date_format, request('startDate')) : now($this->company->timezone)->startOfMonth();
        $this->endDate = (request('endDate') != '') ? Carbon::createFromFormat($this->company->date_format, request('endDate')) : now($this->company->timezone);
        $startDate = $this->startDate->toDateString();
        $endDate = $this->endDate->toDateString();

        $this->leadPipelines = LeadPipeline::all();

        $this->leadStatusChart = $this->leadStatusChart($startDate, $endDate, $pipelineId);

        return $this->returnAjax('dashboard.ajax.lead-by-pipeline');

    }

    public function beamAuth()
    {
        $userID = 'wrkst-'.user()->id;
        $userIDInQueryParam = request()->user_id;

        if ($userID != $userIDInQueryParam) {
            return response('Inconsistent request', 401);

        } else {
            $beamsClient = new \Pusher\PushNotifications\PushNotifications([
                'instanceId' => push_setting()->instance_id,
                'secretKey' => push_setting()->beam_secret,
            ]);

            $beamsToken = $beamsClient->generateToken($userID);
            return response()->json($beamsToken);
        }

    }

    public function sendPushNotifications($usersIDs, $title, $body)
    {
        $setting = PushNotificationSetting::first();
        if ($setting->beams_push_status && count($usersIDs) > 0) {
            $beamsClient = new \Pusher\PushNotifications\PushNotifications([
            'instanceId' =>  $setting->instance_id,
            'secretKey' =>  $setting->beam_secret,
            ]);


            $pushIDs = [];

            foreach ($usersIDs[0] as $key => $uid) {
                $pushIDs[] = 'wrkst-' . $uid;
            }

            $publishResponse = $beamsClient->publishToUsers(
            $pushIDs,
            array(
              'web' => array(
                'notification' => array(
                  'title' => $title,
                  'body' => $body,
                  'icon' => companyOrGlobalSetting()->logo_url
                  )
              )
            ));
        }

        return true;
    }


}
