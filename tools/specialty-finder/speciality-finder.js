const fileInput = document.getElementById("csvFile");
const table = document.getElementById("tableData");
const boxOne = document.querySelector(".boxOne");
const boxTwo = document.querySelector(".boxTwo");
const submitButton = document.getElementById("submitButton");
const findCommon = document.getElementById("findCommon");
const outputContainer = document.querySelector(".outputContainer");
const infoPara = document.querySelector(".infoPara");
const commonSpecialties = document.querySelector(".commonSpecialties");
const unCommonSpecialties = document.querySelector(".unCommonSpecialties");
const resetApp = document.getElementById("resetApp");

/* ── Drop-zone refs (upload upgrade) ── */
const zoneCsv = document.getElementById("zoneCsv");
const nameCsv = document.getElementById("nameCsv");
const errCsv = document.getElementById("errCsv");
const filePill = document.getElementById("filePill");
const filePillName = document.getElementById("filePillName");

let searchTimeout;
let data;
let givenSpecialties;
let onlySpecialties = [];

fileInput.addEventListener("change", function (event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  nameCsv.textContent = file.name;
  filePillName.textContent = file.name; // pill text = current file, every upload
  filePillName.title = file.name; // full name on hover (pill may show …)
  errCsv.textContent = "";

  const reader = new FileReader();

  reader.onload = function (e) {
    const csvText = e.target.result;

    // console.log(csvText)

    data = csvToObjects(csvText);

    console.log(data);

    onlySpecialties = data.map((row, index) => ({
      specialty: row.Specialty,
      rowIndex: index,
    }));

    console.log(onlySpecialties);

    displayTable(data);

    // upload succeeded -> hide the drop zone, reveal the filename pill
    // (zone returns only via Reset / refresh — pill mirrors the loaded file)
    zoneCsv.style.display = "none";
    filePill.style.display = "flex";

    initializeSearch();

    slowScrollTo(250, 800);
  };

  reader.readAsText(file);
});

function resetZoneCsv() {
  zoneCsv.style.display = "block"; // zone returns
  filePill.style.display = "none"; // pill hides
  nameCsv.textContent = "";
  errCsv.textContent = "";
  zoneCsv.classList.remove("drag-over");
}

// stop the browser's default "open the dropped file" navigation
["dragover", "drop"].forEach((evt) =>
  window.addEventListener(evt, (e) => e.preventDefault()),
);

zoneCsv.addEventListener("dragover", (e) => {
  e.preventDefault();
  zoneCsv.classList.add("drag-over");
});
zoneCsv.addEventListener("dragleave", () =>
  zoneCsv.classList.remove("drag-over"),
);
zoneCsv.addEventListener("drop", (e) => {
  e.preventDefault();
  zoneCsv.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    errCsv.textContent = "Only CSV files are allowed.";
    return;
  }
  // hand the dropped file to the SAME input, then fire a normal change
  // event — the existing parsing pipeline runs untouched
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
});

// smooth scrolling function
function slowScrollTo(target, duration = 2000) {
  const startPosition = window.scrollY;
  let targetPosition = target - startPosition;
  let startTime = null;

  // Simple linear animation function
  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;

    // Calculate progress (0 to 1)
    const progress = Math.min(timeElapsed / duration, 1);

    // Calculate position based on linear progress
    const run = startPosition + targetPosition * progress;

    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }
  requestAnimationFrame(animation);
}

// Convert CSV → JS Objects
function csvToObjects(csvText) {
  const rows = csvText.trim().split("\n");

  const headers = parseCSVRow(rows[0]);

  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseCSVRow(rows[i]);

    const obj = {};

    headers.forEach((header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim() : "";
    });

    result.push(obj);
  }

  return result;
}

// Function to parse a single CSV row
function parseCSVRow(row) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);

  return values;
}

//input array
function processString(str) {
  const lines = str
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const uniqueLines = [...new Set(lines)];

  return {
    count: uniqueLines.length,
    specialty: uniqueLines,
  };
}

submitButton.addEventListener("click", function () {
  commonSpecialties.innerHTML = "";
  unCommonSpecialties.innerHTML = "";
  submitButton.style.display = "none";

  let inputSpecialty = document.getElementById("specialty").value;

  if (inputSpecialty.trim() !== "") {
    document.querySelector(".result").style.display = "block";

    givenSpecialties = processString(inputSpecialty);

    // console.log(givenSpecialties);
  } else {
    alert("Please enter specialties");
    submitButton.style.display = "block";
  }
});

// if text there is some modification in text area then this part of code will run
document.getElementById("specialty").addEventListener("input", function () {
  infoPara.innerHTML = "";
  outputContainer.style.display = "none";
  submitButton.style.display = "block";
  findCommon.style.display = "block";
  document.querySelector(".result").style.display = "none";
  commonSpecialties.innerHTML = "";
  unCommonSpecialties.innerHTML = "";

  // remove table highlights
  const rows = document.querySelectorAll("#tableData tr");

  rows.forEach((row) => {
    row.classList.remove("matchRow");
  });
});

findCommon.addEventListener("click", function () {
  outputContainer.style.display = "block";
  findCommon.style.display = "none";

  let commonElements = [];
  let unCommonElements = [];
  let inputArr = givenSpecialties.specialty;

  for (let i = 0; i < inputArr.length; i++) {
    for (let j = 0; j < data.length; j++) {
      if (inputArr[i] === data[j].Specialty) {
        commonElements.push(inputArr[i]);
        break;
      }
    }
  }

  for (let i = 0; i < inputArr.length; i++) {
    if (!commonElements.includes(inputArr[i])) {
      unCommonElements.push(inputArr[i]);
    }
  }

  infoPara.innerHTML = `
<span class="found">✓ <span class="foundCount">${commonElements.length}</span> Found</span>
&nbsp;&nbsp;|&nbsp;&nbsp;
<span class="missing">✗ <span class="missingCount">${unCommonElements.length}</span> Missing</span>
&nbsp;&nbsp;|&nbsp;&nbsp;
Total <span class="totalCount">${givenSpecialties.count}</span>
`;

  const commonOne = document.createElement("p");
  let commonStr = "";

  for (let i = 0; i < commonElements.length; i++) {
    if (commonStr !== "") {
      commonStr = commonStr + "," + " " + commonElements[i];
    } else {
      commonStr = commonElements[i];
    }
  }

  commonOne.textContent = commonStr;
  commonSpecialties.appendChild(commonOne);

  const unCommonOne = document.createElement("p");
  let unCommonStr = "";

  for (let i = 0; i < unCommonElements.length; i++) {
    if (unCommonStr !== "") {
      unCommonStr = unCommonStr + "," + " " + unCommonElements[i];
    } else {
      unCommonStr = unCommonElements[i];
    }
  }

  unCommonOne.textContent = unCommonStr;
  unCommonSpecialties.appendChild(unCommonOne);

  // tabel content highlighting
  const tableRows = document.querySelectorAll("#tableData tbody tr");

  tableRows.forEach((row) => {
    // specialty column
    const specialtyText = row.cells[row.cells.length - 1].textContent.trim();

    if (commonElements.includes(specialtyText)) {
      row.classList.add("matchRow");
    } else {
      row.classList.remove("matchRow");
    }
  });

  // copy button
  document.getElementById("commonText").addEventListener("click", function () {
    const text = commonStr;
    navigator.clipboard.writeText(text);

    document.getElementById("commonText").innerText = "Copied!";

    setTimeout(() => {
      document.getElementById("commonText").innerText = "Copy";
    }, 2000);
  });

  document
    .getElementById("unCommonText")
    .addEventListener("click", function () {
      const text = unCommonStr;
      navigator.clipboard.writeText(text);

      document.getElementById("unCommonText").innerText = "Copied!";

      setTimeout(() => {
        document.getElementById("unCommonText").innerText = "Copy";
      }, 2000);
    });

  console.log(
    `There are ${givenSpecialties.count} specialities given and out of them ${commonElements.length} are available in our database and ${unCommonElements.length} are not available.`,
  );

  console.log(commonElements);
  console.log(unCommonElements);
});

// reset button
resetApp.addEventListener("click", reset);

function reset() {
  fileInput.value = "";
  infoPara.innerHTML = "";
  document.getElementById("specialty").value = "";
  boxOne.style.display = "none";
  boxTwo.style.display = "none";
  outputContainer.style.display = "none";
  submitButton.style.display = "block";
  findCommon.style.display = "block";
  document.querySelector(".result").style.display = "none";
  table.innerHTML = "";
  commonSpecialties.innerHTML = "";
  unCommonSpecialties.innerHTML = "";
  data = [];

  // restore the drop zone to its empty/expanded state
  resetZoneCsv();

  document.getElementById("resetApp").style.display = "none";

  console.log("Every thing is removed");
}

// Display Data in Table
function displayTable(data) {
  boxOne.style.display = "flex";
  boxTwo.style.display = "block";
  document.getElementById("resetApp").style.display = "inline-block";

  table.innerHTML = "";

  if (data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  headers.forEach((header) => {
    const th = document.createElement("th");
    if (header === "Specialty") {
      th.innerHTML = `
            <div class="searchHeader">

                <span>${header.toUpperCase()}</span>

                <div class="searchContainer">

                    <input
                        type="text"
                        id="tableSearch"
                        placeholder="🔍 Search specialty..."
                        autocomplete="off"
                    >

                    <div class="searchResults"></div>

                </div>

            </div>
        `;
    } else {
      th.textContent = header.toUpperCase();
    }
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  data.forEach((row, index) => {
    const tr = document.createElement("tr");

    tr.dataset.rowIndex = index;

    headers.forEach((header) => {
      const td = document.createElement("td");
      td.textContent = row[header];
      if (header === "Specialty") {
        td.classList.add("specialtyCell");
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

// funcitons for search specialties feature
function initializeSearch() {
  const searchBox = document.getElementById("tableSearch");
  searchBox.addEventListener("input", handleSearchInput);
  searchBox.addEventListener("focus", showSearchResults);
  document.addEventListener("click", hideSearchResults);
}

function handleSearchInput(event) {
  const keyword = event.target.value.trim();

  // If input is empty, hide dropdown immediately
  if (keyword === "") {
    clearTimeout(searchTimeout);
    renderSearchResults([], keyword);
    return;
  }

  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const matches = performSearch(keyword);
    renderSearchResults(matches, keyword);
  }, 1000);
}

function scrollToMatchedRow(rowIndex) {
  const row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);

  if (!row) return;

  row.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
        flashSpecialtyCell(row);
        observer.disconnect();
      }
    },
    {
      threshold: 0.8,
    },
  );

  observer.observe(row);
}

function flashSpecialtyCell(row) {
  const specialtyCell = row.querySelector(".specialtyCell");

  if (!specialtyCell) return;

  specialtyCell.classList.add("flashSearch");

  specialtyCell.addEventListener(
    "animationend",
    function () {
      specialtyCell.classList.remove("flashSearch");
    },
    { once: true },
  );
}

function performSearch(keyword) {
  if (keyword === "") {
    return [];
  }

  const uniqueSpecialties = new Set();

  return onlySpecialties.filter((item) => {
    const isMatch = item.specialty
      .toLowerCase()
      .includes(keyword.toLowerCase());

    if (!isMatch || uniqueSpecialties.has(item.specialty)) {
      return false;
    }

    uniqueSpecialties.add(item.specialty);
    return true;
  });
}

function highlightMatch(text, keyword) {
  if (keyword === "") {
    return text;
  }

  const regex = new RegExp(`(${keyword})`, "gi");

  return text.replace(regex, `<span class="matchedText">$1</span>`);
}

function renderSearchResults(matches, keyword) {
  const searchResults = document.querySelector(".searchResults");

  searchResults.innerHTML = "";

  if (keyword === "") {
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
    return;
  }

  if (matches.length === 0) {
    searchResults.style.display = "block";
    searchResults.innerHTML = `
      <div class="noResults">
          No matching specialties found.
      </div>
    `;
    return;
  }

  searchResults.style.display = "block";

  matches.forEach((match) => {
    const div = document.createElement("div");

    div.innerHTML = highlightMatch(
      match.specialty,
      document.getElementById("tableSearch").value.trim(),
    );

    div.classList.add("searchItem");

    div.dataset.rowIndex = match.rowIndex;
    div.dataset.specialty = match.specialty;

    div.addEventListener("click", handleSearchSelection);

    searchResults.appendChild(div);
  });
}

function handleSearchSelection(event) {
  const searchBox = document.getElementById("tableSearch");

  const searchResults = document.querySelector(".searchResults");

  const item = event.target.closest(".searchItem");
  searchBox.value = item.dataset.specialty;

  searchResults.style.display = "none";

  const rowIndex = item.dataset.rowIndex;

  scrollToMatchedRow(rowIndex);
}

function hideSearchResults(event) {
  const searchContainer = document.querySelector(".searchContainer");

  const searchResults = document.querySelector(".searchResults");

  if (!searchContainer.contains(event.target)) {
    searchResults.style.display = "none";
  }
}

function showSearchResults() {
  const searchBox = document.getElementById("tableSearch");

  const keyword = searchBox.value.trim();

  if (keyword === "") {
    return;
  }

  const matches = performSearch(keyword);

  renderSearchResults(matches, keyword);
}

/* Back to top */
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  backToTop.style.display = window.scrollY > 350 ? "block" : "none";
});
backToTop.onclick = () => slowScrollTo(50, 500);

// clear once reload
window.onload = reset;
