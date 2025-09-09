<script src="{{ asset('vendor/jquery/frappe-charts.min.iife.js') }}"></script>
<script src="{{ asset('vendor/jquery/Chart.min.js') }}"></script>
<script src="{{ asset('vendor/jquery/gauge.js') }}"></script>

@php
$editProjectPermission = user()->permission('edit_projects');
$addPaymentPermission = user()->permission('add_payments');
$projectBudgetPermission = user()->permission('view_project_budget');
$memberIds = $project->members->pluck('user_id')->toArray();
@endphp


<div class="d-lg-flex">
    <div class="py-0 w-100 py-lg-3 py-md-0 ">
        <!-- PROJECT OVERVIEW AND MILESTONE STATUS START -->
        <div class="row">
            <!-- PROJECT PROGRESS START -->
            <div class="mb-4 col-md-7">
                <x-cards.data :title="__('modules.projects.overview')"
                    otherClasses="d-flex d-xl-flex d-lg-block d-md-flex justify-content-between align-items-center">
                    <div class="w-70 mx-50">
                        <table class="table no-margin project-overview-table w-100">
                            <tbody>
                                <tr>
                                    <th class="align-middle mb-0 text-lightest f-14 w-30 ">@lang('app.projectName')</th>
                                    <td class="shadow-none">
                                        <p class="mb-0 text-dark-grey f-14 text-wrap">{{ $project->project_name }}</p>
                                    </td>
                                </tr>
                                @if (!is_null($project->client))
                                    <tr>
                                        <th class="align-middle mb-0 text-lightest f-14 w-30 ">@lang('app.client')</th>
                                        <td class="shadow-none">
                                            <x-client :user="$project->client"></x-client>
                                        </td>
                                    </tr>
                                @endif
                                <tr>
                                    <th class="align-middle mb-0 text-lightest f-14 w-30 ">@lang('app.status')</th>
                                    <td class="shadow-none"><p class="mb-0 text-dark-grey f-14 w-70 text-wrap"><i class="fa fa-circle mr-1 text-yellow"
                                        style="color: {{ $projectStatusColor->color }}"></i>{{ $project->status }}</p></td>
                                </tr>
                                <tr>
                                    <th class="align-middle mb-0 text-lightest f-14 w-30 ">@lang('app.startDate')</th>
                                    <td class="shadow-none">
                                        <p class="mb-0 text-dark-grey f-14 w-70 text-wrap">{{ $project->start_date->translatedFormat(company()->date_format) }}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th class="align-middle mb-0 text-lightest f-14 w-30 ">@lang('app.deadline')</th>
                                    <td class="shadow-none">
                                        <p class="mb-0 text-dark-grey f-14 w-70 text-wrap">{{ !is_null($project->deadline) ? $project->deadline->translatedFormat(company()->date_format) : '--' }}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th class="align-middle mb-0 text-lightest f-14 w-30 ">@lang('modules.projects.projectMembers')</th>
                                    <td class="align-middle shadow-none"><p class="mb-0 text-dark-grey f-14 w-70 text-wrap">{{ count($project->members) }}</p></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="mb-auto d-flex flex-column align-items-center">
                        <p class="font-weight-bold">@lang('modules.projects.projectProgress')</p>
                        <x-gauge-chart id="progressGauge" width="170" :value="$project->completion_percent" />
                    </div>

                </x-cards.data>
            </div>
            <!-- PROJECT PROGRESS END -->
            <!-- Statistics By Milestone Status START -->
            <div class="mb-4 col-md-5">
                    <x-cards.data :title="__('projectroadmap::app.statisticsByMilestoneStatus')"
                        otherClasses="d-block d-xl-flex d-lg-block d-md-flex  justify-content-between align-items-center">
                        <x-pie-chart id="task-chart" :labels="$milestoneChart['labels']" :values="$milestoneChart['values']"
                        :colors="$milestoneChart['colors']" height="220" width="250" />
                </x-cards.data>
            </div>
            <!-- Statistics By Milestone Status END -->
        </div>
        <!-- PROJECT OVERVIEW AND MILESTONE STATUS END -->

        <!-- TASK STATUS, HOURS ESTIMATION AND TASK PRIORITY START -->
        <div class="mb-4 row">
            <!-- STATISTICS BY TASK STATUS START -->
            <div class="col-lg-4 col-md-6 ">
                <x-cards.data :title="__('projectroadmap::app.statisticsByTaskStatus')" padding="false">
                    <x-projectroadmap::doughnut-chart id="task-chart1" :labels="$taskChart['labels']" :values="$taskChart['values']"
                        :colors="$taskChart['colors']" height="250" width="250"/>
                </x-cards.data>
            </div>
            <!-- STATISTICS BY TASK STATUS END -->

            <!-- STATISTICS BY HOURS ESTIMATION START -->
            <div class="col-lg-4 col-md-6">
                <x-cards.data :title="__('projectroadmap::app.statisticsByHoursEstimation')" padding="false">
                    @if ($viewProjectTimelogPermission == 'all')
                        <x-stacked-chart id="task-chart2" :chartData="$hoursBudgetChart" height="250" />
                    @endif
                </x-cards.data>
            </div>
            <!-- STATISTICS BY HOURS ESTIMATION END -->

            <!-- STATISTICS BY TASK PRIORITY START -->
            <div class="col-lg-4 col-md-6">
                <x-cards.data :title="__('projectroadmap::app.statisticsByTaskPriority')" padding="false">
                    <x-bar-chart id="task-chart3" :chartData="$taskPriorityChart" height="250"/>
                </x-cards.data>
            </div>
            <!-- STATISTICS BY TASK PRIORITY START -->

        </div>
        <!-- TASK STATUS, HOURS ESTIMATION AND TASK PRIORITY END -->

        <!-- LIST OF MEMBERS AND LIST OF MILESTONES START -->
        <div class="mb-4 row">
            <!-- LIST OF MEMBERS START -->
            <div class="col-md-6">
                <x-cards.data :title="__('modules.projects.members')" padding="false">
                    <div class="d-block overflow-auto">
                        @include('projectroadmap::table.members-list')
                    </div>
                </x-cards.data>
            </div>
            <!-- LIST OF MEMBERS END -->

            <!-- LIST OF MILESTONES START -->
            <div class="col-md-6">
                <x-cards.data :title="__('modules.projects.milestones')" padding="false">
                    <div class="d-block overflow-auto">
                        @include('projectroadmap::table.milestones-list')
                    </div>
                </x-cards.data>
            </div>
            <!-- LIST OF MILESTONES END -->
        </div>
        <!-- LIST OF MEMBERS AND LIST OF MILESTONES END -->

    </div>
</div>
