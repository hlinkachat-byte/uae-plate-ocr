// PlateVault DXB - app.js (English, no build tools)

// Firebase imports are injected in index.html into window.firebaseImports
const {
  initializeApp,
  getFirestore, collection, addDoc, getDocs, getDoc, setDoc,
  query, orderBy, limit, doc, updateDoc, deleteDoc,
  getStorage, sRef, uploadBytes, getDownloadURL,
  getAuth, signInAnonymously, onAuthStateChanged
} = window.firebaseImports;

// 1) PUT YOUR FIREBASE WEB CONFIG HERE
const firebaseConfig = {
   apiKey: "AIzaSyCMR1qchPIQZUHBaM5M-6Q9-rLb-4Xw108",
  authDomain: "plate-hunter-19a0c.firebaseapp.com",
  projectId: "plate-hunter-19a0c",
  storageBucket: "plate-hunter-19a0c.firebasestorage.app",
  messagingSenderId: "750670305068",
  appId: "1:750670305068:web:0e3813fe946b57f69cbe89"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// ---------- UI refs ----------
const gallery = document.getElementById("gallery");
const countInfo = document.getElementById("countInfo");

const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const viewGrid = document.getElementById("viewGrid");
const viewList = document.getElementById("viewList");

const userBadge = document.getElementById("userBadge");
const btnAddTop = document.getElementById("btnAddTop");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalClose = document.getElementById("modalClose");

const fileInput = document.getElementById("fileInput");
const previewImg = document.getElementById("previewImg");

const plateTextInput = document.getElementById("plateTextInput");
const codeInput = document.getElementById("codeInput");
const numberInput = document.getElementById("numberInput");
const emirateSelect = document.getElementById("emirateSelect");
const needsReview = document.getElementById("needsReview");

const btnOCR = document.getElementById("btnOCR");
const btnSave = document.getElementById("btnSave");
const uploadStatus = document.getElementById("uploadStatus");
const ocrCandidates = document.getElementById("ocrCandidates");

const profilePanel = document.getElementById("profilePanel");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const profileInfo = document.getElementById("profileInfo");

const statsPanel = document.getElementById("statsPanel");
const statsBox = document.getElementById("statsBox");

const navBtns = [...document.querySelectorAll(".navbtn")];
const emirateChips = [...document.querySelectorAll("[data-emirate]")];
const digitsChips = [...document.querySelectorAll("[data-digits]")];

// ---------- state ----------
let currentUser = null;
let isAdmin = false;
let myProfileName = "Anonymous";

let allPlates = [];
let activeEmirate = "ALL";
let activeDigits = "ALL";
let viewMode = "grid";

let editingId = null;
let editingData = null;

let selectedFile = null;
let selectedFileObjectUrl = null;

// ---------- helpers ----------
const now = () => Date.now();

function toast(msg) {
  alert(msg);
}

function setActiveChip(chips, predicate) {
  chips.forEach(b => b.classList.toggle("active", predicate(b)));
}

function normalizePlateText(text) {
  return (text || "").toUpperCase().replace(/\s+/g, " ").trim();
}

function computeDigitsBucket(numStr) {
  const n = (numStr || "").replace(/\D/g, "");
  if (!n) return "ALL";
  if (n.length === 1) return "1";
  if (n.length === 2) return "2";
  if (n.length === 3) return "3";
  return "4-5";
}

function extractPlateParts(text) {
  const t = normalizePlateText(text);

  // Find patterns like "N 55"
  const m = t.match(/([A-Z])\s*([0-9]{1,5})/);
  if (m) return { code: m[1], number: m[2] };

  // else first number
  const n = t.match(/([0-9]{1,5})/);
  return { code: "", number: n ? n[1] : "" };
}

function rarityScore(numberStr) {
  const n = (numberStr || "").replace(/\D/g, "");
  if (!n) return 50;
  if (n.length === 1) return 99;
  if (n.length === 2) return 95;
  if (n.length === 3) return 80;
  return 55;
}

async function isAdminUid(uid) {
  // admins/{uid} exists -> admin
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists();
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "profiles", uid));
  if (snap.exists()) {
    myProfileName = (snap.data().displayName || "Anonymous").toString();
  } else {
    myProfileName = "Anonymous";
  }
}

function renderUserBadge() {
  const uidShort = currentUser?.uid ? currentUser.uid.slice(0, 6) + "…" : "—";
  userBadge.textContent = `${myProfileName} • ${isAdmin ? "ADMIN" : "ANON"} • ${uidShort}`;
  profileInfo.textContent = `UID: ${currentUser?.uid || "-"} • Role: ${isAdmin ? "ADMIN" : "ANON"}`;
  if (nameInput) nameInput.value = myProfileName === "Anonymous" ? "" : myProfileName;
}

function canEditPlate(p) {
  const uid = currentUser?.uid;
  if (!uid) return false;
  return isAdmin || p.ownerUid === uid;
}

// ---------- modal ----------
function openModal(title) {
  modalTitle.textContent = title;
  modal.classList.remove("hidden");
}

function resetModalFields() {
  uploadStatus.textContent = "";
  ocrCandidates.innerHTML = "";

  plateTextInput.value = "";
  codeInput.value = "";
  numberInput.value = "";
  needsReview.checked = false;
  emirateSelect.value = "Dubai";

  fileInput.value = "";
  selectedFile = null;

  previewImg.removeAttribute("src");
  delete previewImg.dataset.imageUrl;

  if (selectedFileObjectUrl) URL.revokeObjectURL(selectedFileObjectUrl);
  selectedFileObjectUrl = null;
}

function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
  editingData = null;
  resetModalFields();
}

function openAdd() {
  editingId = null;
  editingData = null;
  resetModalFields();
  openModal("Add plate");
}

function openEdit(p) {
  if (!canEditPlate(p)) return toast("No permission.");
  editingId = p.id;
  editingData = p;

  resetModalFields();
  openModal("Edit plate");

  emirateSelect.value = p.emirate || "Dubai";
  needsReview.checked = !!p.needsReview;
  plateTextInput.value = p.plateText || "";
  codeInput.value = p.code || "";
  numberInput.value = p.number || "";

  previewImg.src = p.imageUrl || "";
}

// ---------- tabs ----------
function showTab(tab) {
  navBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  profilePanel.classList.toggle("hidden", tab !== "profile");
  statsPanel.classList.toggle("hidden", tab !== "stats");

  if (tab === "add") openAdd();
  if (tab === "stats") renderStats();
  if (tab === "profile") renderUserBadge();
}

// ---------- Firestore IO ----------
async function loadPlates() {
  const q = query(collection(db, "plates"), orderBy("createdAt", "desc"), limit(300));
  const snap = await getDocs(q);

  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...d.data() }));

  allPlates = arr;
  renderGallery();
  renderStats();
}

async function savePlate({ imageUrl, plateText, code, number, emirate, needsReviewFlag }) {
  const uid = currentUser?.uid;
  if (!uid) return toast("Not signed in.");

  const cleanText = normalizePlateText(plateText);
  const cleanCode = (code || "").toUpperCase().trim();
  const cleanNumber = (number || "").replace(/\D/g, "");

  if (!cleanNumber) return toast("Number is required (digits only).");

  if (editingId) {
    // Update
    const patch = {
      plateText: cleanText,
      code: cleanCode,
      number: cleanNumber,
      emirate,
      needsReview: !!needsReviewFlag,
      rarity: rarityScore(cleanNumber),
      updatedAt: now()
    };
    if (imageUrl) patch.imageUrl = imageUrl;

    await updateDoc(doc(db, "plates", editingId), patch);
    toast("Updated");
  } else {
    // Create
    const data = {
      imageUrl: imageUrl || "",
      plateText: cleanText,
      code: cleanCode,
      number: cleanNumber,
      emirate,
      needsReview: !!needsReviewFlag,
      rarity: rarityScore(cleanNumber),

      ownerUid: uid,
      ownerName: myProfileName,

      createdAt: now(),
      updatedAt: now()
    };

    await addDoc(collection(db, "plates"), data);
    toast("Saved");
  }

  await loadPlates();
  closeModal();
}

async function deletePlate(p) {
  if (!canEditPlate(p)) return toast("No permission.");
  if (!confirm("Delete this plate record?")) return;

  await deleteDoc(doc(db, "plates", p.id));
  await loadPlates();
}

// ---------- gallery render ----------
function renderGallery() {
  const search = (searchInput.value || "").toLowerCase().trim();
  let arr = [...allPlates];

  // emirate filter
  if (activeEmirate !== "ALL") {
    arr = arr.filter(p => (p.emirate || "") === activeEmirate);
  }

  // digits filter
  if (activeDigits === "REVIEW") {
    arr = arr.filter(p => !!p.needsReview);
  } else if (activeDigits !== "ALL") {
    arr = arr.filter(p => computeDigitsBucket(p.number) === activeDigits);
  }

  // search
  if (search) {
    arr = arr.filter(p => {
      const t = `${p.plateText || ""} ${p.code || ""} ${p.number || ""} ${p.emirate || ""}`.toLowerCase();
      return t.includes(search);
    });
  }

  // sort
  const sort = sortSelect.value;
  if (sort === "old") arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (sort === "new") arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (sort === "rarity_desc") arr.sort((a, b) => (b.rarity || 0) - (a.rarity || 0));
  if (sort === "rarity_asc") arr.sort((a, b) => (a.rarity || 0) - (b.rarity || 0));

  countInfo.textContent = `${arr.length} item(s)`;

  gallery.className = `gallery ${viewMode}`;
  gallery.innerHTML = "";

  arr.forEach(p => gallery.appendChild(renderCard(p)));
}

function renderCard(p) {
  const card = document.createElement("div");
  card.className = "card" + (viewMode === "list" ? " list" : "");

  const img = document.createElement("img");
  img.src = p.imageUrl || "";
  img.alt = p.plateText || "plate";

  const body = document.createElement("div");
  body.className = "card-body";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span class="dot"></span><span>${p.emirate || "-"}</span>`;

  const line = document.createElement("div");
  line.className = "plateLine";
  line.textContent = `${p.code ? p.code + " " : ""}${p.number || ""}`.trim() || (p.plateText || "");

  const rarity = document.createElement("div");
  rarity.className = "rarity";
  rarity.textContent = `Rarity: ${p.rarity || 0}/100`;

  const tags = document.createElement("div");
  tags.className = "meta";
  tags.style.marginTop = "8px";
  tags.innerHTML = `
    <span class="tag">${(p.ownerName || "Anonymous")}</span>
    ${p.needsReview ? `<span class="tag review">Needs review</span>` : ""}
  `;

  const actions = document.createElement("div");
  actions.className = "actions";

  const btnOpen = document.createElement("button");
  btnOpen.className = "btn";
  btnOpen.textContent = "Open";
  btnOpen.onclick = () => window.open(p.imageUrl, "_blank");

  actions.appendChild(btnOpen);

  if (canEditPlate(p)) {
    const btnEdit = document.createElement("button");
    btnEdit.className = "btn";
    btnEdit.textContent = "Edit";
    btnEdit.onclick = () => openEdit(p);

    const btnDel = document.createElement("button");
    btnDel.className = "btn danger";
    btnDel.textContent = "Delete";
    btnDel.onclick = () => deletePlate(p);

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
  }

  body.appendChild(meta);
  body.appendChild(line);
  body.appendChild(rarity);
  body.appendChild(tags);
  body.appendChild(actions);

  card.appendChild(img);
  card.appendChild(body);
  return card;
}

// ---------- stats ----------
function renderStats() {
  if (statsPanel.classList.contains("hidden")) return;

  const total = allPlates.length;
  const byEmirate = {};
  const byDigits = { "1": 0, "2": 0, "3": 0, "4-5": 0 };
  let needs = 0;

  allPlates.forEach(p => {
    const e = p.emirate || "Unknown";
    byEmirate[e] = (byEmirate[e] || 0) + 1;

    const d = computeDigitsBucket(p.number);
    if (byDigits[d] !== undefined) byDigits[d] += 1;

    if (p.needsReview) needs += 1;
  });

  const emirateLines = Object.entries(byEmirate)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join("<br>");

  statsBox.innerHTML = `
    <div class="box"><b>Total plates:</b> ${total}</div>
    <div class="box"><b>Needs review:</b> ${needs}</div>
    <div class="box"><b>Digits:</b><br>
      1-digit: ${byDigits["1"]}<br>
      2-digit: ${byDigits["2"]}<br>
      3-digit: ${byDigits["3"]}<br>
      4–5: ${byDigits["4-5"]}
    </div>
    <div class="box"><b>By emirate:</b><br>${emirateLines || "-"}</div>
  `;
}

// ---------- OCR ----------
async function runOCR(imageUrl) {
  uploadStatus.textContent = "OCR running…";

  const r = await fetch("/.netlify/functions/ocr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageUrl })
  });

  const j = await r.json();
  const raw = (j?.raw || "").toString();

  const cleaned = normalizePlateText(raw)
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // candidates
  const candidates = [];
  const first = extractPlateParts(cleaned);
  if (first.number) candidates.push(`${first.code ? first.code + " " : ""}${first.number}`.trim());

  const matches = cleaned.match(/[A-Z]\s*[0-9]{1,5}/g) || [];
  matches.slice(0, 10).forEach(m => candidates.push(normalizePlateText(m)));

  const uniq = [...new Set(candidates)].slice(0, 10);

  // Fill fields
  if (uniq[0]) {
    plateTextInput.value = uniq[0];
    const parts = extractPlateParts(uniq[0]);
    codeInput.value = parts.code || "";
    numberInput.value = parts.number || "";
  } else {
    plateTextInput.value = cleaned.slice(0, 30);
    const parts = extractPlateParts(cleaned);
    codeInput.value = parts.code || "";
    numberInput.value = parts.number || "";
  }

  // Render tags
  ocrCandidates.innerHTML = "";
  uniq.forEach(c => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = c;
    tag.onclick = () => {
      plateTextInput.value = c;
      const parts = extractPlateParts(c);
      codeInput.value = parts.code || "";
      numberInput.value = parts.number || "";
    };
    ocrCandidates.appendChild(tag);
  });

  uploadStatus.textContent = raw ? "OCR done (editable)." : "OCR returned empty text. Type manually.";
}

// ---------- events ----------
btnAddTop.addEventListener("click", openAdd);
modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

viewGrid.addEventListener("click", () => {
  viewMode = "grid";
  setActiveChip([viewGrid, viewList], b => b === viewGrid);
  renderGallery();
});
viewList.addEventListener("click", () => {
  viewMode = "list";
  setActiveChip([viewGrid, viewList], b => b === viewList);
  renderGallery();
});

searchInput.addEventListener("input", renderGallery);
sortSelect.addEventListener("change", renderGallery);

emirateChips.forEach(b => b.addEventListener("click", () => {
  activeEmirate = b.dataset.emirate;
  setActiveChip(emirateChips, x => x.dataset.emirate === activeEmirate);
  renderGallery();
}));

digitsChips.forEach(b => b.addEventListener("click", () => {
  activeDigits = b.dataset.digits;
  setActiveChip(digitsChips, x => x.dataset.digits === activeDigits);
  renderGallery();
}));

navBtns.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  selectedFile = f || null;
  if (!selectedFile) return;

  if (selectedFileObjectUrl) URL.revokeObjectURL(selectedFileObjectUrl);
  selectedFileObjectUrl = URL.createObjectURL(selectedFile);
  previewImg.src = selectedFileObjectUrl;

  uploadStatus.textContent = "";
  ocrCandidates.innerHTML = "";
  delete previewImg.dataset.imageUrl;
});

btnOCR.addEventListener("click", async () => {
  try {
    const uid = currentUser?.uid;
    if (!uid) return toast("Not signed in.");

    // If editing and no new file: OCR existing image URL
    if (editingId && !selectedFile) {
      const url = editingData?.imageUrl;
      if (!url) return toast("No image URL.");
      await runOCR(url);
      return;
    }

    if (!selectedFile) return toast("Choose a file first.");

    uploadStatus.textContent = "Uploading for OCR…";

    // Upload under user folder so Storage rules can allow write
    const storageRef = sRef(storage, `plates/${uid}/${now()}_${selectedFile.name}`);
    await uploadBytes(storageRef, selectedFile);
    const imageUrl = await getDownloadURL(storageRef);

    previewImg.src = imageUrl;
    previewImg.dataset.imageUrl = imageUrl;

    await runOCR(imageUrl);
  } catch (e) {
    console.error(e);
    toast("OCR failed. Open DevTools Console.");
  }
});

btnSave.addEventListener("click", async () => {
  try {
    const uid = currentUser?.uid;
    if (!uid) return toast("Not signed in.");

    uploadStatus.textContent = "Saving…";

    let imageUrl = previewImg.dataset.imageUrl || "";

    // If editing and no new uploaded file, keep old image
    if (editingId && !imageUrl) {
      imageUrl = editingData?.imageUrl || "";
    }

    // If adding new and user selected file but never ran OCR -> upload now
    if (!editingId && selectedFile && !imageUrl) {
      const storageRef = sRef(storage, `plates/${uid}/${now()}_${selectedFile.name}`);
      await uploadBytes(storageRef, selectedFile);
      imageUrl = await getDownloadURL(storageRef);
    }

    const plateText = plateTextInput.value;
    const parts = extractPlateParts(plateText);

    const code = (codeInput.value || parts.code || "").toUpperCase().trim();
    const number = (numberInput.value || parts.number || "").replace(/\D/g, "");

    await savePlate({
      imageUrl,
      plateText,
      code,
      number,
      emirate: emirateSelect.value,
      needsReviewFlag: needsReview.checked
    });

  } catch (e) {
    console.error(e);
    toast("Save failed. Open DevTools Console.");
  }
});

saveNameBtn.addEventListener("click", async () => {
  try {
    const uid = currentUser?.uid;
    if (!uid) return toast("Not signed in.");

    const displayName = (nameInput.value || "").trim();
    if (!displayName) return toast("Enter a name.");

    await setDoc(doc(db, "profiles", uid), { displayName, updatedAt: now() }, { merge: true });
    myProfileName = displayName;
    renderUserBadge();
    toast("Saved.");
  } catch (e) {
    console.error(e);
    toast("Profile save failed.");
  }
});

// ---------- auth bootstrap ----------
async function boot() {
  // Sign in anonymously
  await signInAnonymously(auth);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    currentUser = user;

    // role
    isAdmin = await isAdminUid(user.uid);

    // profile
    await loadProfile(user.uid);

    renderUserBadge();

    // initial chip state
    setActiveChip(emirateChips, b => b.dataset.emirate === activeEmirate);
    setActiveChip(digitsChips, b => b.dataset.digits === activeDigits);
    setActiveChip([viewGrid, viewList], b => b === viewGrid);

    // default tab
    showTab("home");

    // load data
    await loadPlates();
  });
}

boot();
