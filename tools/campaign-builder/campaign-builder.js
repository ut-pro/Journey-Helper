function pad2(n) {
  return String(n).padStart(2, "0");
}
function pad4(n) {
  const raw = (n ?? "").toString().trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw.padStart(4, "0");
  const m = raw.match(/^(\d+)([A-Za-z].*)$/);
  if (m)
    return (
      m[1].padStart(4, "0") + m[2].toUpperCase().replace(/[^A-Z0-9_\-]/g, "")
    );
  return raw.toUpperCase().replace(/[^A-Z0-9_\-]/g, "");
}
function formatDateDDMMYYYY(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return pad2(d.getDate()) + pad2(d.getMonth() + 1) + d.getFullYear();
}
function sanitizeCore(s, upcase = true) {
  if (!s) return "";
  let out = s.trim().replace(/\s+/g, "_");
  out = out.replace(/[^A-Za-z0-9_\-]/g, "");
  return upcase ? out.toUpperCase() : out;
}

const filetypeEl = document.getElementById("filetype");
const specialtyRow = document.getElementById("specialtyRow");
const ffJoinRow = document.getElementById("ffJoinRow");
const marketInput = document.getElementById("market");

function refreshRows() {
  const flatfileNameCap = document.getElementById("flatfileNameCap");
  if (filetypeEl.value === "SP") {
    specialtyRow.style.display = "";
    ffJoinRow.style.display = "none";
    flatfileNameCap.style.display = "none";
  } else {
    specialtyRow.style.display = "none";
    ffJoinRow.style.display = "";
    flatfileNameCap.style.display = "";
  }
}
filetypeEl.addEventListener("change", refreshRows);
document.addEventListener("DOMContentLoaded", initializeCampaignBuilder);

function initializeCampaignBuilder() {
  refreshRows();
  setText("specialtyCheckSql", specialtyCheckSqlDefault());
}

marketInput.addEventListener("input", function () {
  const market = this.value.trim();
  if (market) {
    setText("specialtyCheckSql", specialtyCheckSql(market));
  } else {
    setText("specialtyCheckSql", specialtyCheckSqlDefault());
  }
});

function buildQ1InListLines(csv) {
  const items = (csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => "'" + s.replace(/'/g, "''") + "'");
  const list = items.length ? items : ["'Specialty1'", "'Specialty2'"];
  const lines = list.map((val, i) => val + (i === list.length - 1 ? "" : ","));
  return "(\n" + lines.join("\n") + "\n)";
}

function q1SqlSP(market, csv) {
  const inList = buildQ1InListLines(csv);
  return (
    "Select\n" +
    "B.MDMID, B.Email, B.EmailToken, B.Title, B.FirstName, B.MiddleName, B.LastName, B.Gender, B.Profession, B.Specialty, B.OptOutURL, B.SourceID, B.VeevaID, B.ConsentCaptureDateUTC, B.Status, B.CrmStatus\n" +
    "FROM ENT." +
    market +
    "_P_ProfilesAndEmailsOptIn B\n" +
    "WHERE Specialty in " +
    inList +
    "\n" +
    "AND B.CrmStatus = 'Active'\n" +
    "AND B.MDMID LIKE 'HCP%'\n"
  );
}
function q1SqlFF(market, deName, flatfileName, joinKey) {
  const key =
    { VeevaID: "VeevaID", MDMID: "MDMID", Email: "Email" }[joinKey] ||
    "VeevaID";
  return (
    "Select B.MDMID, B.Email, B.EmailToken, B.Title, B.FirstName, B.MiddleName, B.LastName, B.Gender,B.Profession, B.Specialty, B.OptOutURL, B.SourceID, B.VeevaID, B.ConsentCaptureDateUTC, B.Status\n" +
    "From ENT." +
    market +
    "_P_ProfilesAndEmailsOptIn B inner join " +
    flatfileName +
    " A on B." +
    key +
    " = A." +
    key +
    "\n" +
    "Where B.Crmstatus = 'Active' AND B.MDMID LIKE 'HCP%'\n"
  );
}
function q2SqlSP(deName) {
  return (
    "Select MDMID, Email, EmailToken, Title, FirstName, MiddleName, LastName, Gender, Profession, Specialty, OptOutURL, SourceID, VeevaID, ConsentCaptureDateUTC, 'Latest' AS Status\n" +
    "From\n" +
    "(Select MDMID, Email, EmailToken, Title, FirstName, MiddleName, LastName, Gender, Profession, Specialty, OptOutURL, SourceID, VeevaID, ConsentCaptureDateUTC, Status, ROW_NUMBER() OVER \n" +
    "\t(\n" +
    "\t\tPARTITION BY MDMID\n" +
    "\t    Order by ConsentCaptureDateUTC DESC\n" +
    "\t) AS RN\n" +
    "  From " +
    deName +
    ") A\n" +
    "Where RN = 1"
  );
}
function q3SqlSP(deName) {
  return (
    "Select MDMID, Email, EmailToken, Title, FirstName, MiddleName, LastName, Gender, Profession, Specialty, OptOutURL, SourceID, VeevaID, ConsentCaptureDateUTC, 'Eligible' AS Status\n" +
    "From\n" +
    "(Select MDMID, Email, EmailToken, Title, FirstName, MiddleName, LastName, Gender, Profession, Specialty, OptOutURL, SourceID, VeevaID, ConsentCaptureDateUTC, Status, ROW_NUMBER() OVER \n" +
    "\t(\n" +
    "\t\tPARTITION BY Email\n" +
    "\t   Order by ConsentCaptureDateUTC DESC\n" +
    "\t) AS RN\n" +
    "From " +
    deName +
    "\n" +
    "Where Status = 'Latest') A\n" +
    "Where RN = 1"
  );
}
function q2SqlFF(deName) {
  return (
    "Select MDMID, Email, EmailToken, Title, FirstName, MiddleName, LastName, Gender, Profession, Specialty, OptOutURL, SourceID, VeevaID, ConsentCaptureDateUTC, 'Latest' AS Status \n" +
    "From \n" +
    "( \n" +
    "Select MDMID, Email,  EmailToken,   Title,   FirstName,  MiddleName,   LastName,   Gender,  Profession,   Specialty, OptOutURL,   SourceID,   VeevaID,  ConsentCaptureDateUTC, Status, ROW_NUMBER() OVER  \n" +
    "     ( \n" +
    "\t\tPARTITION BY MDMID \n" +
    "\t\tOrder by ConsentCaptureDateUTC DESC \n" +
    "      ) AS RN  \n" +
    "From " +
    deName +
    " ) A \n" +
    "Where RN = 1"
  );
}
function q3SqlFF(deName) {
  return (
    "Select MDMID,   Email,  EmailToken,   Title,   FirstName,  MiddleName,   LastName,   Gender,  Profession,   Specialty, OptOutURL,   SourceID,   VeevaID,  ConsentCaptureDateUTC, 'Eligible' AS Status\n" +
    "From\n" +
    "(\n" +
    "Select MDMID, Email, EmailToken, Title, FirstName, MiddleName, LastName, Gender,  Profession,   Specialty, OptOutURL, SourceID, VeevaID, ConsentCaptureDateUTC,   Status,    ROW_NUMBER () OVER \n" +
    "     (\n" +
    "\t\tPARTITION BY Email \n" +
    "\t\tOrder by ConsentCaptureDateUTC DESC\n" +
    "      ) AS RN \n" +
    "From " +
    deName +
    "\n" +
    "Where Status = 'Latest') A \n" +
    "Where RN = 1"
  );
}

function eligibleCountSql(deName) {
  return (
    "SELECT\n" +
    "COUNT(ISNULL(Status,'NoSpecialtyUsers')) as Count,\n" +
    "Status\n" +
    "FROM " +
    deName +
    "\n" +
    "GROUP BY Status"
  );
}

function finalCountBySpecialtySql(deName) {
  return (
    "SELECT\n" +
    "COUNT(ISNULL(Specialty,'NoSpecialtyUsers')) as Count,\n" +
    "Specialty\n" +
    "FROM " +
    deName +
    "\n" +
    "WHERE Status='Eligible'\n" +
    "GROUP BY Specialty"
  );
}

function specialtyCheckSqlDefault() {
  return (
    "SELECT\n" +
    "COUNT(ISNULL(Status,'NoSpecialtyUsers')) as Count,\n" +
    "Specialty\n" +
    "FROM\n" +
    "ENT.{{Market}}_P_ProfilesAndEmailsOptIn\n" +
    "GROUP BY Specialty"
  );
}

function specialtyCheckSql(market) {
  return (
    "SELECT\n" +
    "COUNT(ISNULL(Status,'NoSpecialtyUsers')) as Count,\n" +
    "Specialty\n" +
    "FROM\n" +
    "ENT." +
    market +
    "_P_ProfilesAndEmailsOptIn\n" +
    "GROUP BY Specialty"
  );
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "—";
}

function buildAll() {
  const run = pad4(document.getElementById("run").value);
  const market = document.getElementById("market").value.trim();
  const brand = sanitizeCore(document.getElementById("brand").value);
  const clid = sanitizeCore(document.getElementById("clid").value.trim(), true);
  const filetype = document.getElementById("filetype").value;
  const sendDate = formatDateDDMMYYYY(document.getElementById("date").value);
  const ss = sanitizeCore(document.getElementById("ss").value, true);

  const missing = [];
  if (!run) missing.push("Run Number");
  if (!market) missing.push("Market");
  if (!sendDate) missing.push("Send-out Date");
  if (!brand) missing.push("Brand");
  if (!filetype) missing.push("File Type");
  if (!clid) missing.push("CLID");
  if (missing.length) {
    alert("Please fill: " + missing.join(", "));
    return;
  }

  const ssSuffix = ss ? `_SS${ss}` : "";

  const base = `HS_SS_${run}_P_${market}_${sendDate}_${brand}`;
  const emailTemplate = `HS_SS_P_${market}_${sendDate}_${brand}_${clid}${ssSuffix}_Launch`;
  const deName = `${base}_${filetype}${ssSuffix}`;
  const journey = `${base}_${clid}${ssSuffix}`;
  const q1Name = `${base}_Q1`;
  const q2Name = `${base}_Q2`;
  const q3Name = `${base}_Q3`;
  let flatfileNameValue = "";
  const flatfileNameCap = document.getElementById("flatfileNameCap");
  if (filetype === "FF") {
    let rawFlatfileName = `${clid}_${sendDate}_FF`;
    flatfileNameValue = rawFlatfileName.replace(/-/g, "_");
    setText("flatfileName", flatfileNameValue);
    flatfileNameCap.style.display = "";
  } else {
    setText("flatfileName", "—");
    flatfileNameCap.style.display = "none";
  }

  setText("emailName", emailTemplate);
  setText("deName", deName);
  setText("autoName", base);
  setText("journeyName", journey);

  setText("q1name", q1Name);
  setText("q2name", q2Name);
  setText("q3name", q3Name);

  let q1Sql = "",
    q2Sql = "",
    q3Sql = "";
  if (filetype === "SP") {
    const specialtiesCsv = (
      document.getElementById("specialty").value || ""
    ).trim();
    q1Sql = q1SqlSP(market, specialtiesCsv);
    q2Sql = q2SqlSP(deName);
    q3Sql = q3SqlSP(deName);
  } else {
    const joinKey = document.getElementById("ffJoinKey").value;
    q1Sql = q1SqlFF(market, deName, flatfileNameValue, joinKey);
    q2Sql = q2SqlFF(deName);
    q3Sql = q3SqlFF(deName);
  }

  setText("q1sql", q1Sql);
  setText("q2sql", q2Sql);
  setText("q3sql", q3Sql);

  setText("eligibleCountSql", eligibleCountSql(deName));
  setText("finalCountSql", finalCountBySpecialtySql(deName));
  setText("specialtyCheckSql", specialtyCheckSql(market));
}

function clearAll() {
  ["run", "market", "date", "brand", "clid", "ss"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("filetype").value = "SP";
  refreshRows();
  const spec = document.getElementById("specialty");
  if (spec) spec.value = "";
  const join = document.getElementById("ffJoinKey");
  if (join) join.value = "VeevaID";

  [
    "flatfileName",
    "emailName",
    "deName",
    "autoName",
    "journeyName",
    "q1name",
    "q2name",
    "q3name",
  ].forEach((id) => setText(id, "—"));
  ["q1sql", "q2sql", "q3sql", "eligibleCountSql", "finalCountSql"].forEach(
    (id) => setText(id, "—"),
  );
  document.getElementById("flatfileNameCap").style.display = "none";

  setText("specialtyCheckSql", specialtyCheckSqlDefault());
}

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".copy");
  if (!btn) return;
  const id = btn.getAttribute("data-target");
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.textContent;
  if (!text || text.trim() === "—") return;
  copyText(text, btn);
});

async function copyText(text, btn) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  } finally {
    btn.classList.add("copied");
    setTimeout(() => btn.classList.remove("copied"), 2000);
  }
}

document.getElementById("build").addEventListener("click", buildAll);
document.getElementById("clear").addEventListener("click", clearAll);

document.getElementById("copyAll").addEventListener("click", function () {
  const emailName = document.getElementById("emailName").textContent.trim();
  if (!emailName || emailName === "—") return;

  const deName = document.getElementById("deName").textContent.trim();
  const journeyName = document.getElementById("journeyName").textContent.trim();
  const autoName = document.getElementById("autoName").textContent.trim();
  const q1name = document.getElementById("q1name").textContent.trim();
  const q2name = document.getElementById("q2name").textContent.trim();
  const q3name = document.getElementById("q3name").textContent.trim();

  const payloadItems = [
    "Email template name: " + emailName,
    "DE Name: " + deName,
    "Journey Name: " + journeyName,
    "Automation Name: " + autoName,
    "Query Names: " + q1name + ", " + q2name + ", " + q3name,
  ];

  const flatfileName = document
    .getElementById("flatfileName")
    .textContent.trim();
  if (flatfileName && flatfileName !== "—") {
    payloadItems.unshift("FlatFile Name: " + flatfileName);
  }

  const payload = payloadItems.join("\n");
  copyText(payload, this);
});

function showSeedPage() {
  document.getElementById("mainPage").classList.remove("active");
  document.getElementById("seedPage").classList.add("active");
  window.scrollTo(0, 0);
}

function showMainPage() {
  document.getElementById("seedPage").classList.remove("active");
  document.getElementById("mainPage").classList.add("active");
  window.scrollTo(0, 0);
}

function cleanSeedName(name) {
  return name.replace(/[^a-zA-Z]/g, "-");
}

function capitalizeSeed(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function generateSeedCSV() {
  const country = document.getElementById("seedCountry").value;
  const domainMap = {
    SA: "https://gskpro.com/en-sa/",
    TH: "https://gskpro.com/th-th/",
    IN: "https://gskpro.com/en-in/",
    XG: "https://gskpro.com/en-xg/",
    ID: "https://gskpro.com/id-id/",
    MY: "https://gskpro.com/en-my/",
    PK: "https://gskpro.com/en-pk/",
    PE: "https://gskpro.com/es-pe/",
    PH: "https://gskpro.com/en-ph/",
    DZ: "https://gskpro.com/fr-dz",
    EG: "https://gskpro.com/en-eg/",
    TR: "https://gskpro.com/tr-tr/",
    KE: "https://gskpro.com/en-ke/",
  };
  const optOutURL = domainMap[country] || "https://gskpro.com/";
  const emailInput = document.getElementById("seedEmails").value?.trim();
  if (!emailInput) {
    alert("Please enter at least one email address");
    return;
  }
  const rawEmails = emailInput
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter((e) => e);
  const header = [
    "MDMID",
    "VeevaID",
    "Email",
    "EmailToken",
    "GskOrg",
    "MarketID",
    "DcfCode",
    "CrmStatus",
    "Title",
    "FirstName",
    "MiddleName",
    "LastName",
    "Gender",
    "Profession",
    "Specialty",
    "Specialty2",
    "PreferredLanguage",
    "SourceModifiedDateUTC",
    "SourceCreatedDateUTC",
    "CreatedDate",
    "UpdatedDate",
    "SourceID",
    "AccountType",
    "IsVerified",
    "OptOutURL",
    "Status",
    "ExpiryDateUTC",
    "ConsentCaptureDateUTC",
    "ChannelValueRank",
    "EncodedEmailToken",
    "Brand",
  ];
  let csvContent = header.join(",") + "\n";
  rawEmails.forEach((email, index) => {
    const localPart = email.split("@")[0];
    const parts = localPart.split(/[_\.]/);
    const cleanedParts = parts.map((p) => cleanSeedName(p)).filter((p) => p);
    let firstName = "",
      middleName = "",
      lastName = "";
    if (cleanedParts.length === 1) {
      firstName = capitalizeSeed(cleanedParts[0]);
    } else if (cleanedParts.length === 2) {
      firstName = capitalizeSeed(cleanedParts[0]);
      lastName = cleanedParts[1].toLowerCase();
    } else if (cleanedParts.length >= 3) {
      firstName = capitalizeSeed(cleanedParts[0]);
      lastName = cleanedParts[cleanedParts.length - 1].toLowerCase();
      for (let i = 1; i < cleanedParts.length - 1; i++) {
        if (
          cleanedParts[i].length >= 3 &&
          /^[A-Za-z]+$/.test(cleanedParts[i])
        ) {
          middleName = capitalizeSeed(cleanedParts[i]);
          break;
        }
      }
    }
    const id = String(index + 1).padStart(2, "0");
    const baseId = `SL_Seed_Digital_${id}`;
    const row = [
      baseId,
      "",
      email,
      baseId,
      "",
      country,
      "",
      "",
      "",
      firstName,
      middleName,
      lastName,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      optOutURL,
      "seed",
      "",
      "",
      "",
      "",
      "",
    ];
    csvContent += row.join(",") + "\n";
  });
  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.getElementById("seedDownloadLink");
  link.href = URL.createObjectURL(blob);
  link.download = "Seed_List.csv";
  link.style.display = "inline-block";
  link.textContent = "Download CSV";
}
