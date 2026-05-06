// Scaler AI Agent × Sales — Google Apps Script backend
// Handles PDF upload to Drive and record write to Supabase
//
// ── SETUP ────────────────────────────────────────────────────────────────────
// In the Apps Script editor go to:
//   Project Settings → Script Properties → Add script property
//
// Add these two properties (copy values from your .env):
//
//   SUPABASE_URL        →  (from .env)
//   SUPABASE_ANON_KEY   →  (from .env)
//
// ─────────────────────────────────────────────────────────────────────────────

var ROOT_FOLDER_ID = '196Y_ZC27tbQIDTIOS2vK9_kfX1E77OVW';

function _props() {
  return PropertiesService.getScriptProperties();
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'upload_pdf') {
      return handlePDFUpload(payload);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.toString() }, 500);
  }
}

function handlePDFUpload(payload) {
  var props        = _props();
  var rootFolderId = ROOT_FOLDER_ID;

  var filename   = payload.filename || 'lead_pdf.pdf';
  var b64        = payload.data;
  var mimeType   = payload.mimeType || 'application/pdf';
  var leadName   = payload.lead_name || 'Unknown Lead';

  // Decode base64 → blob
  var bytes = Utilities.base64Decode(b64);
  var blob  = Utilities.newBlob(bytes, mimeType, filename);

  // Root drive folder (id from Script Properties)
  var root = DriveApp.getFolderById(rootFolderId);

  // Create / reuse a subfolder named after the lead
  var leadFolder;
  var iter = root.getFoldersByName(leadName);
  leadFolder = iter.hasNext() ? iter.next() : root.createFolder(leadName);

  // Upload the PDF into that folder
  var file = leadFolder.createFile(blob);

  // Make it viewable by anyone with the link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Return a clean viewer URL (opens in browser, not force-download)
  var fileUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing';

  return jsonResponse({ fileUrl: fileUrl, fileId: file.getId() });
}

function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
