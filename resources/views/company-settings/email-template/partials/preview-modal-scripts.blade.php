{{--
  Shared preview-modal opener — included on the index page, the full-page
  edit view, and loaded after the create wizard ajax fragment so the iframe
  preview works even when opened from inside MODAL_XL (nested modals).
--}}
<script>
    (function () {
        window.openEmailTemplatePreviewModal = function (subjectText, html) {
            var $modal = $('#template-preview-modal');

            if (!$modal.length) {
                alert('Preview modal is not available on this page.');
                return;
            }

            // Move to body so Bootstrap stacking works when we're inside MODAL_XL.
            if (!$modal.parent().is('body')) {
                $modal.appendTo('body');
            }

            $('#preview-modal-subject').text(subjectText || '(no subject)');

            var frame = document.getElementById('preview-modal-frame');
            frame.removeAttribute('src');
            frame.srcdoc = html || '';

            frame.onload = function () {
                try {
                    var doc = frame.contentDocument || frame.contentWindow.document;
                    var height = Math.max(
                        doc.documentElement ? doc.documentElement.scrollHeight : 0,
                        doc.body ? doc.body.scrollHeight : 0
                    );
                    frame.style.height = Math.max(520, height + 24) + 'px';
                } catch (e) {
                    frame.style.height = '520px';
                }
            };

            $modal.modal('show');
        };
    })();
</script>
