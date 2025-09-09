@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush
@push('styles')
<style>
    .jsDatatable .dataTables_filter {
        display: flex !important;
        flex-direction: row-reverse;
        margin-right: 20px;
    }
</style>
@endpush

@php
$viewProjectMemberPermission = user()->permission('view_project_members');
$viewProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('view_project_milestones');
$viewTasksPermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('view_project_tasks');
$viewGanttPermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('view_project_gantt_chart');
$viewInvoicePermission = user()->permission('view_project_invoices');
$viewDiscussionPermission = user()->permission('view_project_discussions');
$viewNotePermission = user()->permission('view_project_note');
$viewFilesPermission = user()->permission('view_project_files');
$viewRatingPermission = user()->permission('view_project_rating');
$projectArchived = $project->trashed();
@endphp


@section('filter-section')
    <!-- FILTER START -->
    <!-- PROJECT HEADER START -->

    <div class="bg-white d-flex d-lg-block filter-box project-header">
        <div class="mobile-close-overlay w-100 h-100" id="close-client-overlay"></div>

        <div class="project-menu" id="mob-client-detail">
            <a class="d-none close-it" href="javascript:;" id="close-client-detail">
                <i class="fa fa-times"></i>
            </a>
        </div>

        <a class="mb-0 ml-auto mr-2 d-block d-lg-none text-dark-grey border-left-grey" onclick="openClientDetailSidebar()"><i class="fa fa-ellipsis-v "></i></a>
    </div>



    <!-- PROJECT HEADER END -->

@endsection

@section('content')

    <div class="pt-0 content-wrapper border-top-0 client-detail-wrapper">
        @include('projectroadmap::ajax.overview')
        <div class="d-lg-flex">
            <div class="py-0 w-100 py-lg-3 py-md-0 ">
                <div class="row">
                    <div class="mb-4 col-md-12">
                        <x-cards.data :title="__('modules.module.tasks')"
                            >
                            @include($view)
                        </x-cards.data>
                    </div>
                </div>
            </div>
        </div>
    </div>

@endsection

@push('scripts')

    <script>
        $("body").on("click", ".project-menu .ajax-tab", function(event) {
            event.preventDefault();

            $('.project-menu .p-sub-menu').removeClass('active');
            $(this).addClass('active');


            const requestUrl = this.href;

            $.easyAjax({
                url: requestUrl,
                blockUI: true,
                container: ".content-wrapper",
                historyPush: true,
                success: function(response) {
                    if (response.status == "success") {
                        $('.content-wrapper').html(response.html);
                        init('.content-wrapper');
                    }
                }
            });
        });

    </script>

    <script>
        /*******************************************************
                 More btn in projects menu Start
        *******************************************************/

        const container = document.querySelector('.tabs');
        const primary = container.querySelector('.-primary');
        const primaryItems = container.querySelectorAll('.-primary > li:not(.-more)');
        container.classList.add('--jsfied'); // insert "more" button and duplicate the list

        primary.insertAdjacentHTML('beforeend', `
        <li class="-more">
            <button type="button" class="px-4 h-100 bg-grey d-none d-lg-flex align-items-center" aria-haspopup="true" aria-expanded="false">
            {{__('app.more')}} <span>&darr;</span>
            </button>
            <ul class="-secondary" id="hide-project-menues">
            ${primary.innerHTML}
            </ul>
        </li>
        `);
        const secondary = container.querySelector('.-secondary');
        const secondaryItems = secondary.querySelectorAll('li');
        const allItems = container.querySelectorAll('li');
        const moreLi = primary.querySelector('.-more');
        const moreBtn = moreLi.querySelector('button');
        moreBtn.addEventListener('click', e => {
            e.preventDefault();
            container.classList.toggle('--show-secondary');
            moreBtn.setAttribute('aria-expanded', container.classList.contains('--show-secondary'));
        }); // adapt tabs

        const doAdapt = () => {
            // reveal all items for the calculation
            allItems.forEach(item => {
                item.classList.remove('--hidden');
            }); // hide items that won't fit in the Primary

            let stopWidth = moreBtn.offsetWidth;
            let hiddenItems = [];
            const primaryWidth = primary.offsetWidth;
            primaryItems.forEach((item, i) => {
                if (primaryWidth >= stopWidth + item.offsetWidth) {
                    stopWidth += item.offsetWidth;
                } else {
                    item.classList.add('--hidden');
                    hiddenItems.push(i);
                }
            }); // toggle the visibility of More button and items in Secondary

            if (!hiddenItems.length) {
                moreLi.classList.add('--hidden');
                container.classList.remove('--show-secondary');
                moreBtn.setAttribute('aria-expanded', false);
            } else {
                secondaryItems.forEach((item, i) => {
                    if (!hiddenItems.includes(i)) {
                        item.classList.add('--hidden');
                    }
                });
            }
        };

        doAdapt(); // adapt immediately on load

        window.addEventListener('resize', doAdapt); // adapt on window resize
        // hide Secondary on the outside click

        document.addEventListener('click', e => {
            let el = e.target;

            while (el) {
                if (el === secondary || el === moreBtn) {
                    return;
                }

                el = el.parentNode;
            }

            container.classList.remove('--show-secondary');
            moreBtn.setAttribute('aria-expanded', false);
        });
        /*******************************************************
                 More btn in projects menu End
        *******************************************************/
    </script>
@endpush
