@extends('layouts.app')

@section('content')
<div class="tw-container tw-mx-auto tw-px-4 tw-py-8">
    <div class="tw-max-w-4xl tw-mx-auto">
        <!-- Header -->
        <div class="tw-text-center tw-mb-8">
            <h1 class="tw-text-4xl tw-font-bold tw-text-gray-900 tw-mb-4">Tailwind CSS Test Page</h1>
            <p class="tw-text-lg tw-text-gray-600">This page demonstrates Tailwind CSS integration with the <code class="tw-bg-gray-100 tw-px-2 tw-py-1 tw-rounded">tw-</code> prefix to avoid conflicts with Bootstrap.</p>
        </div>

        <!-- Cards Section -->
        <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6 tw-mb-8">
            <!-- Card 1 -->
            <div class="tw-card">
                <div class="tw-flex tw-items-center tw-mb-4">
                    <div class="tw-w-12 tw-h-12 tw-bg-primary-100 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-mr-4">
                        <i class="fas fa-users tw-text-primary-600 tw-text-xl"></i>
                    </div>
                    <div>
                        <h3 class="tw-text-xl tw-font-semibold tw-text-gray-900">Client Management</h3>
                        <p class="tw-text-sm tw-text-gray-500">Manage your clients</p>
                    </div>
                </div>
                <p class="tw-text-gray-600 tw-mb-4">Comprehensive client management with detailed profiles, GDPR compliance, and contact management.</p>
                <button class="tw-btn-primary">Learn More</button>
            </div>

            <!-- Card 2 -->
            <div class="tw-card">
                <div class="tw-flex tw-items-center tw-mb-4">
                    <div class="tw-w-12 tw-h-12 tw-bg-secondary-100 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-mr-4">
                        <i class="fas fa-project-diagram tw-text-secondary-600 tw-text-xl"></i>
                    </div>
                    <div>
                        <h3 class="tw-text-xl tw-font-semibold tw-text-gray-900">Project Management</h3>
                        <p class="tw-text-sm tw-text-gray-500">Track your projects</p>
                    </div>
                </div>
                <p class="tw-text-gray-600 tw-mb-4">Project creation, tracking, milestones, team assignment, and Gantt chart functionality.</p>
                <button class="tw-btn-secondary">Learn More</button>
            </div>

            <!-- Card 3 -->
            <div class="tw-card">
                <div class="tw-flex tw-items-center tw-mb-4">
                    <div class="tw-w-12 tw-h-12 tw-bg-green-100 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-mr-4">
                        <i class="fas fa-tasks tw-text-green-600 tw-text-xl"></i>
                    </div>
                    <div>
                        <h3 class="tw-text-xl tw-font-semibold tw-text-gray-900">Task Management</h3>
                        <p class="tw-text-sm tw-text-gray-500">Organize your tasks</p>
                    </div>
                </div>
                <p class="tw-text-gray-600 tw-mb-4">Task creation, Kanban boards, time tracking, and team collaboration features.</p>
                <button class="tw-btn-primary">Learn More</button>
            </div>
        </div>

        <!-- Form Section -->
        <div class="tw-card tw-mb-8">
            <h2 class="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-6">Contact Form</h2>
            <form class="tw-space-y-4">
                <div class="tw-form-group">
                    <label class="tw-form-label">Name</label>
                    <input type="text" class="tw-input" placeholder="Enter your name">
                </div>
                
                <div class="tw-form-group">
                    <label class="tw-form-label">Email</label>
                    <input type="email" class="tw-input" placeholder="Enter your email">
                </div>
                
                <div class="tw-form-group">
                    <label class="tw-form-label">Message</label>
                    <textarea class="tw-input tw-h-32" placeholder="Enter your message"></textarea>
                </div>
                
                <div class="tw-flex tw-space-x-4">
                    <button type="submit" class="tw-btn-primary">Send Message</button>
                    <button type="button" class="tw-btn-secondary">Cancel</button>
                </div>
            </form>
        </div>

        <!-- Stats Section -->
        <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-4 tw-mb-8">
            <div class="tw-bg-white tw-rounded-lg tw-shadow-card tw-p-6 tw-text-center">
                <div class="tw-text-3xl tw-font-bold tw-text-primary-600 tw-mb-2">150+</div>
                <div class="tw-text-sm tw-text-gray-500">Active Clients</div>
            </div>
            <div class="tw-bg-white tw-rounded-lg tw-shadow-card tw-p-6 tw-text-center">
                <div class="tw-text-3xl tw-font-bold tw-text-secondary-600 tw-mb-2">25</div>
                <div class="tw-text-sm tw-text-gray-500">Ongoing Projects</div>
            </div>
            <div class="tw-bg-white tw-rounded-lg tw-shadow-card tw-p-6 tw-text-center">
                <div class="tw-text-3xl tw-font-bold tw-text-green-600 tw-mb-2">89%</div>
                <div class="tw-text-sm tw-text-gray-500">Task Completion</div>
            </div>
            <div class="tw-bg-white tw-rounded-lg tw-shadow-card tw-p-6 tw-text-center">
                <div class="tw-text-3xl tw-font-bold tw-text-purple-600 tw-mb-2">$45K</div>
                <div class="tw-text-sm tw-text-gray-500">Revenue This Month</div>
            </div>
        </div>

        <!-- Alert Section -->
        <div class="tw-space-y-4">
            <div class="tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded-lg tw-p-4">
                <div class="tw-flex">
                    <div class="tw-flex-shrink-0">
                        <i class="fas fa-info-circle tw-text-blue-400"></i>
                    </div>
                    <div class="tw-ml-3">
                        <h3 class="tw-text-sm tw-font-medium tw-text-blue-800">Information</h3>
                        <div class="tw-mt-2 tw-text-sm tw-text-blue-700">
                            <p>This is an informational alert using Tailwind CSS classes with the <code class="tw-bg-blue-100 tw-px-1 tw-py-0.5 tw-rounded">tw-</code> prefix.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tw-bg-green-50 tw-border tw-border-green-200 tw-rounded-lg tw-p-4">
                <div class="tw-flex">
                    <div class="tw-flex-shrink-0">
                        <i class="fas fa-check-circle tw-text-green-400"></i>
                    </div>
                    <div class="tw-ml-3">
                        <h3 class="tw-text-sm tw-font-medium tw-text-green-800">Success</h3>
                        <div class="tw-mt-2 tw-text-sm tw-text-green-700">
                            <p>Tailwind CSS has been successfully integrated with the Hibarr Worksuite CRM!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection 