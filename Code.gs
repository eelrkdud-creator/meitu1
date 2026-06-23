const SHEET_NAME = 'submissions';
const FOLDER_NAME = 'meitu-team-b-screenshots';

function doPost(e) {
  const sheet = getSheet();
  const payload = JSON.parse(e.postData.contents);
  const screenshotUrl = payload.screenshotData
    ? saveScreenshot(payload.screenshotData, payload.screenshotName)
    : '';

  sheet.appendRow([
    new Date(),
    payload.id || '',
    payload.type || '',
    payload.period || '',
    payload.supporterName || '',
    payload.platform || '',
    payload.link || '',
    payload.description || '',
    payload.screenshotName || '',
    screenshotUrl
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'receivedAt',
      'id',
      'type',
      'period',
      'supporterName',
      'platform',
      'link',
      'description',
      'screenshotName',
      'screenshotUrl'
    ]);
  }

  return sheet;
}

function saveScreenshot(dataUrl, filename) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return '';

  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = filename || `screenshot-${Date.now()}.png`;
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const folder = getScreenshotFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

function getScreenshotFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}
