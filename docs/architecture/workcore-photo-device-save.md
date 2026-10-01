# Local photo saving in WorkCore

The tenant-scoped `companySettings.jobPhotoDeviceSave` setting uses the existing
revisioned relational setting mutation. No schema migration or legacy write path
is introduced. Values are `never` (default), `ask`, and `always`.

- Never: no device-save prompt.
- Ask: after camera capture, offer save/share or skip.
- Always: prepare the explicit save/share controls after every camera capture.
- Library selection supports multiple files and never prompts to save them again.
- Capture uses the browser's `capture=environment` hint; camera availability and
  the number of captures per picker session remain browser/device dependent.

Safari/PWA has no general background photo-library write API. Web Share requires
a fresh user gesture and an available file-sharing target. WorkCore calls it only
from the user's save/share button. A cancelled share does not trigger a download.
A separate download button is available where file sharing is unsupported. The
browser chooses the download destination; it may be Files/Downloads, not Photos.
WorkCore never claims that opening the share sheet saved the file to Photos.

Reference: https://webkit.org/blog/13862/the-user-activation-api/
Reference: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share

Device saving is separate from authenticated private uploads and cannot mark a
server upload as completed. Original selected File objects are used for device
saving; existing field-photo preparation, offline persistence and private upload
continue independently. Temporary device-save choices are cleared when changing
the active job/day. No production conflict or photo is deleted by this UX change.

Conflict retries retain their original expected revision and payload. Accepting
server state removes only explicitly selected conflict mutation IDs, persists the
queue and reloads relational state. Bulk selection is explicit, never automatic.
