// ============================================================
// VIRTUALEAF FINANCE — Google Apps Script
// Paste ini di Google Sheets > Extensions > Apps Script
// Lalu Deploy > New Deployment > Web App
//   - Execute as: Me
//   - Who has access: Anyone
// Salin URL deployment → paste di HTML dashboard
// ============================================================

const SHEET_NAME_TX   = "Transaksi";
const SHEET_NAME_KAT  = "Kategori";
const SHEET_NAME_ASET = "Aset";

// Header columns
const TX_HEADERS   = ["ID","Tanggal","Keterangan","Kategori ID","Sumber/Tujuan","Tipe","Jumlah","Mata Uang","Catatan","Channel","Created At"];
const KAT_HEADERS  = ["ID","Nama","Tipe"];
const ASET_HEADERS = ["ID","Jenis","Nama","Nilai","Nilai Awal","Klien","Tanggal","Catatan","Tgl Mulai","Tgl Akhir","Masa (bln)","Created At"];

// ── CORS Helper ──
function cors(output) {
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET handler ──
function doGet(e) {
  try {
    var action = e.parameter.action || "ping";
    if (action === "ping")         return cors({ok:true, msg:"VirtualEaf API live"});
    if (action === "getAll")       return cors(getAllData());
    if (action === "getTransaksi") return cors(getSheet(SHEET_NAME_TX));
    if (action === "getKategori")  return cors(getSheet(SHEET_NAME_KAT));
    if (action === "getAset")      return cors(getSheet(SHEET_NAME_ASET));
    return cors({ok:false, error:"Unknown action"});
  } catch(err) {
    return cors({ok:false, error:err.toString()});
  }
}

// ── POST handler ──
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;

    if (action === "initSheets")       return cors(initSheets());
    if (action === "addTransaksi")     return cors(addRow(SHEET_NAME_TX,   payload.data, TX_HEADERS));
    if (action === "deleteTransaksi")  return cors(deleteRow(SHEET_NAME_TX, payload.id));
    if (action === "updateTransaksi")  return cors(updateRow(SHEET_NAME_TX, payload.id, payload.data));
    if (action === "addKategori")      return cors(addRow(SHEET_NAME_KAT,  payload.data, KAT_HEADERS));
    if (action === "deleteKategori")   return cors(deleteRow(SHEET_NAME_KAT, payload.id));
    if (action === "addAset")          return cors(addRow(SHEET_NAME_ASET, payload.data, ASET_HEADERS));
    if (action === "deleteAset")       return cors(deleteRow(SHEET_NAME_ASET, payload.id));
    if (action === "updateAset")       return cors(updateRow(SHEET_NAME_ASET, payload.id, payload.data));
    if (action === "seedKategori")     return cors(seedKategori());

    return cors({ok:false, error:"Unknown action: " + action});
  } catch(err) {
    return cors({ok:false, error:err.toString()});
  }
}

// ── Init Sheets ──
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, SHEET_NAME_TX,   TX_HEADERS);
  ensureSheet(ss, SHEET_NAME_KAT,  KAT_HEADERS);
  ensureSheet(ss, SHEET_NAME_ASET, ASET_HEADERS);
  return {ok:true, msg:"Sheets initialized"};
}

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setBackground("#1a2e25")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

// ── Seed default kategori ──
function seedKategori() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, SHEET_NAME_KAT, KAT_HEADERS);
  var data = sh.getDataRange().getValues();
  if (data.length > 1) return {ok:true, msg:"Already seeded"};

  var defaults = [
    ["k1","Project Fee","income"],
    ["k2","Retainer","income"],
    ["k3","Bonus / Komisi","income"],
    ["k4","Refund","income"],
    ["k5","Lain-lain (in)","income"],
    ["k6","Gaji / Honor","expense"],
    ["k7","Tools & Software","expense"],
    ["k8","Marketing & Ads","expense"],
    ["k9","Operasional","expense"],
    ["k10","Admin & Bank","expense"],
    ["k11","Lain-lain (out)","expense"],
    ["k12","Platform Fee (Upwork/Fiverr)","expense"],
    ["k13","Connects / Bidding Cost","expense"]
  ];
  defaults.forEach(function(row) { sh.appendRow(row); });
  return {ok:true, msg:"Kategori seeded"};
}

// ── Generic read ──
function getSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return {ok:false, error:"Sheet not found: " + sheetName};
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return {ok:true, data:[]};
  var headers = rows[0];
  var data = rows.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  return {ok:true, data:data};
}

function getAllData() {
  return {
    ok: true,
    transaksi: getSheet(SHEET_NAME_TX).data   || [],
    kategori:  getSheet(SHEET_NAME_KAT).data  || [],
    aset:      getSheet(SHEET_NAME_ASET).data || []
  };
}

// ── Generic add row ──
function addRow(sheetName, data, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, sheetName, headers);
  var row = headers.map(function(h) {
    if (h === "Created At") return new Date().toISOString();
    return data[h] !== undefined ? data[h] : "";
  });
  sh.appendRow(row);
  // Format Jumlah column as currency if applicable
  if (sheetName === SHEET_NAME_TX) {
    var lastRow = sh.getLastRow();
    var jumlahCol = headers.indexOf("Jumlah") + 1;
    if (jumlahCol > 0) {
      sh.getRange(lastRow, jumlahCol).setNumberFormat('"Rp "#,##0');
    }
  }
  return {ok:true, msg:"Row added"};
}

// ── Generic delete (by ID column) ──
function deleteRow(sheetName, id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return {ok:false, error:"Sheet not found"};
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      return {ok:true, msg:"Deleted row " + (i+1)};
    }
  }
  return {ok:false, error:"ID not found: " + id};
}

// ── Generic update ──
function updateRow(sheetName, id, newData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return {ok:false, error:"Sheet not found"};
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      var row = headers.map(function(h) {
        if (h === "Created At") return data[i][headers.indexOf(h)];
        return newData[h] !== undefined ? newData[h] : data[i][headers.indexOf(h)];
      });
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return {ok:true, msg:"Updated row " + (i+1)};
    }
  }
  return {ok:false, error:"ID not found: " + id};
}
