@php
    $isModal = $isModal ?? false;
@endphp
<script>
    $(document).ready(function() {
        // Namespaced so a re-opened Create modal (loaded fresh each time via
        // $.ajaxModal, without a full page reload) replaces these
        // document/body-delegated handlers instead of stacking duplicates
        // on top of the previous open's — element-bound handlers (.click()
        // on #save-email-template etc.) don't need this since the modal
        // shell tears those elements down on close.
        $(document).off('.emailTemplateWizard');
        $('body').off('.emailTemplateWizard');

        quillImageLoad('#body-editor');

        // Body edit mode: Visual (Quill) vs HTML Source (plain textarea).
        // Quill has no <table>/<style> blots — pasting or even just
        // reloading a fully custom HTML email through it silently
        // mangles it, since Quill parses its own starting innerHTML
        // through the same sanitizing pipeline as a paste. HTML Source
        // is a plain textarea, so paste lands verbatim with no
        // sanitization at all — that's the one to use for a complete,
        // self-designed email. getCurrentBodyHtml() is the single place
        // Preview/Save/Detect-Variables read the body from, so they
        // always see whichever mode is actually active.
        let bodyMode = $('#body-mode-html-btn').hasClass('active') ? 'html' : 'visual';
        if (bodyMode === 'html') {
            $('#body-editor').addClass('d-none');
            $('#body-editor').siblings('.ql-toolbar').addClass('d-none');
            $('#body-html-source-help').removeClass('d-none');
        }

        function htmlSourceHasFullEmailMarkup(html) {
            return /<(table|style)\b/i.test(html || '');
        }

        function bodyLooksStripped(html) {
            const trimmed = (html || '').trim();
            if (!trimmed) {
                return false;
            }
            if (/<(table|style|div|td|tr|p|a|img)\b/i.test(trimmed)) {
                return false;
            }
            return /\.hm\b|@media\s/i.test(trimmed) || /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/.test(trimmed);
        }

        function getCurrentBodyHtml() {
            const htmlSource = ($('#body-html-source').val() || '').trim();
            // Always prefer the HTML-source textarea when it holds a full email layout,
            // even if bodyMode drifted back to visual — Quill cannot represent this markup.
            if (bodyMode === 'html' || htmlSourceHasFullEmailMarkup(htmlSource)) {
                return htmlSource;
            }
            const bodyEditor = document.getElementById('body-editor');
            return bodyEditor && bodyEditor.children[0] ? bodyEditor.children[0].innerHTML : '';
        }

        function syncBodyFieldForSubmit() {
            $('#body-html-source').val(getCurrentBodyHtml());
        }

        function setBodyMode(mode) {
            if (mode === bodyMode) {
                return;
            }

            if (mode === 'visual') {
                const htmlSource = ($('#body-html-source').val() || '').trim();
                if (htmlSourceHasFullEmailMarkup(htmlSource)) {
                    const proceed = window.confirm(
                        'Visual mode cannot preserve <table> or <style> blocks. Switching will strip your email layout. Stay on HTML Source instead?'
                    );
                    if (proceed) {
                        return;
                    }
                }
            }

            if (mode === 'html') {
                if (!htmlSourceHasFullEmailMarkup($('#body-html-source').val() || '')) {
                    $('#body-html-source').val(getCurrentBodyHtml());
                }
                $('#body-editor').addClass('d-none');
                $('#body-editor').siblings('.ql-toolbar').addClass('d-none');
                $('#body-html-source').removeClass('d-none');
                $('#body-html-source-help').removeClass('d-none');
            } else {
                const quill = quillArray['#body-editor'];
                if (quill) {
                    quill.setContents([]);
                    quill.clipboard.dangerouslyPasteHTML(0, $('#body-html-source').val() || '', 'silent');
                }
                $('#body-html-source').addClass('d-none');
                $('#body-html-source-help').addClass('d-none');
                $('#body-editor').removeClass('d-none');
                $('#body-editor').siblings('.ql-toolbar').removeClass('d-none');
            }

            bodyMode = mode;
            $('#body-mode-visual-btn').toggleClass('active', mode === 'visual');
            $('#body-mode-html-btn').toggleClass('active', mode === 'html');
        }

        $('#body-mode-visual-btn').click(function() { setBodyMode('visual'); });
        $('#body-mode-html-btn').click(function() { setBodyMode('html'); });

        // Safety net: if something that looks like a full HTML email
        // (its own <table>/<style> layout) gets pasted straight into the
        // Visual editor — easy to do by habit, since Visual is the
        // default — Quill's paste handler keeps only the parts it has a
        // format for and silently drops the rest (a <style> block's
        // rules, a <table>'s structure), with no error or warning. Catch
        // it at the raw clipboard level, before Quill ever sees it, and
        // reroute straight into HTML Source instead — the one mode
        // that's guaranteed not to touch it.
        const bodyEditorEl = document.getElementById('body-editor');
        if (bodyEditorEl) {
            const looksLikeFullHtml = (raw) => /<(table|style)\b/i.test(raw || '');

            bodyEditorEl.addEventListener('paste', function(e) {
                if (bodyMode !== 'visual') {
                    return;
                }
                const clipboard = e.clipboardData || window.clipboardData;
                if (!clipboard) {
                    return;
                }
                const html = clipboard.getData('text/html') || '';
                const text = clipboard.getData('text/plain') || '';
                if (!looksLikeFullHtml(html) && !looksLikeFullHtml(text)) {
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                setBodyMode('html');
                // Prefer whichever clipboard flavor actually contains real
                // tags — a source that syntax-highlights its HTML (rather
                // than showing raw text) can put "<table"/"<style" in one
                // flavor but not the other.
                $('#body-html-source').val(looksLikeFullHtml(html) ? html : text);
            }, true);

            // Same trap via drag-and-drop: Quill's drop handling mangles a
            // full email layout exactly like a paste would, and nothing
            // else catches it.
            bodyEditorEl.addEventListener('drop', function(e) {
                if (bodyMode !== 'visual') {
                    return;
                }
                const dt = e.dataTransfer;
                if (!dt || !dt.getData) {
                    return;
                }
                let html = '';
                let text = '';
                try {
                    html = dt.getData('text/html') || '';
                    text = dt.getData('text/plain') || '';
                } catch (err) {
                    return;
                }
                if (!looksLikeFullHtml(html) && !looksLikeFullHtml(text)) {
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                setBodyMode('html');
                $('#body-html-source').val(looksLikeFullHtml(html) ? html : text);
            }, true);
        }

        let detectDebounceHtml;
        $('#body-html-source').on('input', function() {
            clearTimeout(detectDebounceHtml);
            detectDebounceHtml = setTimeout(detectAndPrefillVariables, 700);
        });

        // Wizard: 4 steps, one visible at a time. Navigation never blocks
        // on validation — the real required-field checks still run
        // server-side (and via the browser's native validation) when
        // Save actually submits on the last step, so you're always free
        // to move around and review before committing.
        const totalSteps = 4;
        let currentStep = 1;
        const saveButtonLabel = @json(__('app.save'));

        function goToStep(step) {
            currentStep = Math.min(Math.max(step, 1), totalSteps);

            $('.wizard-step').addClass('d-none');
            $('.wizard-step[data-step="' + currentStep + '"]').removeClass('d-none');

            $('.wizard-stepper .stepper-step').each(function() {
                const s = parseInt($(this).data('step-target'), 10);
                const $circle = $(this).find('.stepper-circle');
                const $label = $(this).find('.stepper-label');

                $circle.removeClass('bg-primary text-white bg-light text-muted border-primary bg-white').empty();
                $label.removeClass('text-primary font-weight-bold text-muted');

                if (s < currentStep) {
                    $circle.addClass('bg-white border-primary text-primary').html('<i class="fa fa-check"></i>');
                    $label.addClass('text-primary');
                } else if (s === currentStep) {
                    $circle.addClass('bg-primary text-white').text(s);
                    $label.addClass('text-primary font-weight-bold');
                } else {
                    $circle.addClass('bg-light text-muted').text(s);
                    $label.addClass('text-muted');
                }
            });

            $('.wizard-stepper .stepper-line').each(function(i) {
                $(this).toggleClass('bg-primary', (i + 1) < currentStep);
                $(this).toggleClass('bg-light', !((i + 1) < currentStep));
            });

            $('#wizard-back-btn').toggleClass('d-none', currentStep === 1);

            const $saveBtn = $('#save-email-template');
            if (currentStep === totalSteps) {
                $saveBtn.html('<i class="fa fa-check mr-1"></i>' + saveButtonLabel);
                $saveBtn.data('wizard-action', 'save');
            } else {
                $saveBtn.html('Next<i class="fa fa-arrow-right ml-1"></i>');
                $saveBtn.data('wizard-action', 'next');
            }
        }

        $('#wizard-back-btn').click(function() {
            goToStep(currentStep - 1);
        });

        $('.wizard-stepper .stepper-step').click(function() {
            goToStep(parseInt($(this).data('step-target'), 10));
        });

        goToStep(1);

        // Merge tag reference collapse: flip the chevron to match open/closed state.
        $('#merge-tag-help').on('shown.bs.collapse', function() {
            $('[data-target="#merge-tag-help"] i.fa-chevron-down').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        }).on('hidden.bs.collapse', function() {
            $('[data-target="#merge-tag-help"] i.fa-chevron-up').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });

        // Template Type (mode): adjusts Plunk Template ID's required-ness/
        // help text and the Body help text — mode itself doesn't change
        // which fields are visible, both modes always show Subject/Preheader/Body.
        const modeCopy = {
            custom: {
                plunkLabel: 'Plunk Template ID (optional)',
                plunkHelp: 'If set, this email is sent through Plunk using that template — the merge tag values below are still passed as Plunk template variables. Falls back to the local Subject/Body automatically if the Plunk send fails.',
                bodyHelp: 'This is the whole email as recipients see it.'
            },
            plunk_body: {
                plunkLabel: 'Plunk Template ID (required)',
                plunkHelp: 'Required in this mode. Body below is sent as this Plunk template\'s "body" variable — the template\'s own design/wrapper (header, footer, branding) lives in Plunk, not here.',
                bodyHelp: 'This is injected into your Plunk template\'s body variable — light HTML for styling is fine, but there\'s no separate header/footer here (that lives in the Plunk template itself).'
            }
        };

        function applyModeCopy() {
            const mode = $('.template-mode-radio:checked').val() || 'custom';
            const copy = modeCopy[mode] || modeCopy.custom;
            $('#plunk-template-id-label').text(copy.plunkLabel);
            $('#plunk-template-id-help').text(copy.plunkHelp);
            $('#body-mode-help').text(copy.bodyHelp);
            $('.template-mode-card').removeClass('border-primary');
            $('.template-mode-radio:checked').closest('.template-mode-card').addClass('border-primary');
        }

        $('body').on('change.emailTemplateWizard', '.template-mode-radio', applyModeCopy);
        $('body').on('click.emailTemplateWizard', '.template-mode-card', function (event) {
            if ($(event.target).is('input, label, a, button')) {
                return;
            }
            $(this).find('.template-mode-radio').prop('checked', true).trigger('change');
        });
        applyModeCopy();

        // Plunk template picker: lazy-loads from UNS (v1/email/templates)
        // the first time it's opened; selecting an option fills the raw
        // ID input. If the fetch fails/returns nothing, it says so and the
        // ID input still works exactly as manual entry.
        let plunkTemplatesLoaded = false;
        $('#plunk-template-picker').on('focus click', function() {
            if (plunkTemplatesLoaded) {
                return;
            }
            plunkTemplatesLoaded = true;
            const $picker = $(this);
            const $status = $('#plunk-template-picker-status');

            $.ajax({
                url: '{{ route('email-templates.plunk-templates') }}',
                type: 'GET',
                dataType: 'json'
            }).done(function(response) {
                const templates = (response && response.templates) || [];
                if (!templates.length) {
                    $status.removeClass('text-danger').addClass('text-lightest')
                        .text('No Plunk templates found — enter the ID manually.').show();
                    return;
                }
                templates.forEach(function(t) {
                    $picker.append($('<option></option>').attr('value', t.id).text(t.name));
                });
            }).fail(function() {
                $status.removeClass('text-lightest').addClass('text-danger')
                    .text('Could not load Plunk templates — enter the ID manually below.').show();
            });
        });

        $('#plunk-template-picker').on('change', function() {
            const val = $(this).val();
            if (val) {
                $('#plunk_template_id').val(val);
            }
        });

        // Preview: renders the actual mail view server-side (so it matches
        // a real send exactly) with the currently-typed, unsaved content.
        $('#preview-template').click(function() {
            syncBodyFieldForSubmit();
            const bodyHtml = getCurrentBodyHtml();
            const subjectText = $('#subject').val() || '';

            if (bodyLooksStripped(bodyHtml)) {
                alert('This body looks like plain text — paste your full HTML in HTML Source mode first, then preview again.');
                setBodyMode('html');
                goToStep(2);
                return;
            }

            if (!bodyHtml.trim()) {
                alert('Nothing to preview yet — add body content in HTML Source or Visual mode first.');
                return;
            }

            $.ajax({
                url: '{{ route('email-templates.preview') }}',
                type: 'POST',
                dataType: 'json',
                data: {
                    _token: '{{ csrf_token() }}',
                    subject: subjectText,
                    preheader: $('#preheader').val() || '',
                    body: bodyHtml,
                    mode: $('.template-mode-radio:checked').val() || 'custom'
                }
            }).done(function(response) {
                if (window.openEmailTemplatePreviewModal) {
                    window.openEmailTemplatePreviewModal(response.subject || subjectText, response.html || '');
                }
            }).fail(function(xhr) {
                let message = 'Could not build the preview.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                } else if (xhr.status === 419) {
                    message = 'Your session expired — refresh the page and try again.';
                } else if (xhr.status === 422 && xhr.responseJSON && xhr.responseJSON.errors) {
                    message = Object.values(xhr.responseJSON.errors).flat().join('\n');
                }
                alert(message);
            });
        });

        let variableMappingIndex = {{ isset($template) && !empty($template->variable_mappings) ? count($template->variable_mappings) : 0 }};

        $('#add-variable-mapping').click(function() {
            let template = $('#variable-mapping-template').html();
            template = template.replace(/INDEX/g, variableMappingIndex);
            const $row = $(template);
            $('#variable-mappings-container').append($row);
            toggleVariableMappingRow($row);
            variableMappingIndex++;
        });

        $('body').on('click.emailTemplateWizard', '.variable-mapping-row .remove-row', function() {
            $(this).closest('.variable-mapping-row').remove();
        });

        // Variable Mapping type toggle: CRM Field vs CTA URL (and, within
        // CTA URL, the Custom URL input only when "Custom URL" is picked).
        function toggleVariableMappingRow(row) {
            const isCta = row.find('.variable-mapping-type-switch').is(':checked');
            row.find('.variable-mapping-type-switch-label').text(isCta ? 'CTA URL' : 'CRM Field');
            row.find('.variable-mapping-field-container').toggle(!isCta);
            row.find('.variable-mapping-cta-container').toggle(isCta);

            const ctaTarget = row.find('.variable-mapping-cta-target-select').val();
            row.find('.variable-mapping-cta-custom-container').toggle(isCta && ctaTarget === 'custom');
        }

        $('body').on('change.emailTemplateWizard', '.variable-mapping-type-switch, .variable-mapping-cta-target-select', function() {
            toggleVariableMappingRow($(this).closest('.variable-mapping-row'));
        });

        $('.variable-mapping-row').each(function() {
            toggleVariableMappingRow($(this));
        });

        // Detect Variables: scan Subject + Body for merge tag occurrences and
        // add an (unmapped) row for any not already in the mappings list —
        // fires on paste/typing in Body, on leaving Subject, and manually.
        function detectVariableNames(text) {
            const found = [];
            const seen = {};
            const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (!seen[match[1]]) {
                    seen[match[1]] = true;
                    found.push(match[1]);
                }
            }
            return found;
        }

        function existingMappingVariableNames() {
            const names = {};
            $('#variable-mappings-container .variable-mapping-row input[name*="[variable]"]').each(function() {
                const val = $(this).val().trim();
                if (val) names[val] = true;
            });
            return names;
        }

        function addVariableMappingRow(variableName) {
            let template = $('#variable-mapping-template').html();
            template = template.replace(/INDEX/g, variableMappingIndex);
            const $row = $(template);
            $row.find('input[name*="[variable]"]').val(variableName);
            $('#variable-mappings-container').append($row);
            toggleVariableMappingRow($row);
            variableMappingIndex++;
        }

        function showDetectStatus(message) {
            $('#detect-variables-status').stop(true, true).text(message).fadeIn(150).delay(2500).fadeOut(400);
        }

        function detectAndPrefillVariables() {
            const subjectText = $('#subject').val() || '';
            const bodyText = getCurrentBodyHtml();

            const found = detectVariableNames(subjectText + ' ' + bodyText);
            const existing = existingMappingVariableNames();

            let added = 0;
            found.forEach(function(name) {
                if (!existing[name]) {
                    addVariableMappingRow(name);
                    existing[name] = true;
                    added++;
                }
            });

            if (added > 0) {
                showDetectStatus(added + ' new variable' + (added > 1 ? 's' : '') + ' added below — pick a CRM field for each.');
            } else if (found.length > 0) {
                showDetectStatus('No new variables — all tags already have a mapping row.');
            } else {
                showDetectStatus('No merge tags found in Subject/Body.');
            }
        }

        $('#detect-variables').click(function() {
            detectAndPrefillVariables();
        });

        $('#subject').on('blur', function() {
            detectAndPrefillVariables();
        });

        if (typeof quillArray !== 'undefined' && quillArray['#body-editor']) {
            let detectDebounce;
            quillArray['#body-editor'].on('text-change', function(delta, oldDelta, source) {
                if (source !== 'user') {
                    return;
                }
                clearTimeout(detectDebounce);
                detectDebounce = setTimeout(detectAndPrefillVariables, 700);
            });
        }

        function getWizardForm() {
            return $('#save-email-template').closest('form');
        }

        $('#save-email-template').click(function() {
            if ($(this).data('wizard-action') !== 'save') {
                goToStep(currentStep + 1);
                return;
            }

            const $form = getWizardForm();

            syncBodyFieldForSubmit();
            const bodyHtml = getCurrentBodyHtml();

            if (bodyLooksStripped(bodyHtml)) {
                alert('This body lost its HTML tags. Open HTML Source, paste your full email HTML again, then save.');
                setBodyMode('html');
                goToStep(2);
                return;
            }

            $form.find('#body-html-source').val(bodyHtml);

            var formData = $form.serializeArray();

            formData = formData.filter(function(item) {
                return item.name !== '_method';
            });

            var method = $form.find('#form-method').val();
            if (method === 'PUT') {
                formData.push({ name: '_method', value: 'PUT' });
            }

            const submitUrl = $form.find('#form-action-url').val();

            $.easyAjax({
                url: submitUrl,
                container: $form,
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-email-template",
                data: $.param(formData),
                @if($isModal)
                redirect: false,
                success: function(response) {
                    if (response.status === 'success') {
                        $(MODAL_XL).modal('hide');
                        window.location.reload();
                    }
                }
                @else
                redirect: true
                @endif
            })
        });

        // A 422 validation failure still renders its .is-invalid /
        // .invalid-feedback onto the right field via easyAjax's built-in
        // handling — but if that field lives on a step we've navigated
        // away from (d-none), the error is invisible and Save looks like
        // it silently did nothing. Jump to whichever step holds the
        // first invalid field so the message is actually seen.
        $(document).on('ajaxComplete.emailTemplateWizard', function(event, jqXHR, ajaxSettings) {
            const submitUrl = getWizardForm().find('#form-action-url').val();
            if (!submitUrl || ajaxSettings.url !== submitUrl || jqXHR.status !== 422) {
                return;
            }
            const $form = getWizardForm();
            const $firstInvalid = $form.find('.is-invalid').first();
            if ($firstInvalid.length) {
                const step = parseInt($firstInvalid.closest('.wizard-step').data('step'), 10);
                if (step) {
                    goToStep(step);
                }
            }
        });
    });
</script>
