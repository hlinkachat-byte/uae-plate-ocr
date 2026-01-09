// app.js
const {
  initializeApp, getFirestore, collection, addDoc, getDocs, query, orderBy, limit,
  serverTimestamp, doc, updateDoc, deleteDoc,
  getStorage, sRef, uploadBytes, getDownloadURL, deleteObject,
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut
} = window.firebaseImports;
} = window.firebaseImports;

// 1) DOPLŇ FIREBASE CONFIG (z Firebase Console → Project settings → Web app)
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

// DOPLŇ SEM TVOJ ADMIN UID z Firebase Authentication (riadok hlinka.chat@gmail.com)
const ADMIN_UIDS = [
  "3oY3fJdjGzbOIAdfcfBwzb60NHk2"
];

let currentUser = null;
let isAdmin = false;

function getAnonNickForUid(uid){
  const key = `anonNick_${uid}`;
  let nick = localStorage.getItem(key);
  if(!nick){
    nick = `Anon#${Math.floor(1000 + Math.random()*9000)}`;
    localStorage.setItem(key, nick);
  }
  return nick;
}

function refreshUserPill(){
  const nameEl = document.getElementById("userName");
  const roleEl = document.querySelector("#userPill .muted");
  if(!nameEl || !roleEl || !currentUser) return;

  if(currentUser.isAnonymous){
    nameEl.textContent = getAnonNickForUid(currentUser.uid);
    roleEl.textContent = "(Anonym)";
  } else {
    nameEl.textContent = currentUser.email || "Admin";
    roleEl.textContent = "(Admin)";
  }
}


const auth = getAuth(app);

let currentUser = null;
let displayName = "";
let displayRoleLabel = "";

function getAnonNickForUid(uid){
  const key = `anonNick_${uid}`;
  let nick = localStorage.getItem(key);
  if(!nick){
    const n = String(Math.floor(1000 + Math.random()*9000));
    nick = `Anon#${n}`;
    localStorage.setItem(key, nick);
  }
  return nick;
}

function setUserPill(user){
  const nameEl = document.getElementById("userName");
  const roleEl = document.querySelector("#userPill .muted");
  if(!nameEl || !roleEl) return;

  if(user.isAnonymous){
    displayName = getAnonNickForUid(user.uid);
    displayRoleLabel = "(Anonym)";
  }else{
    displayName = user.email || "Admin";
    displayRoleLabel = "(Admin)";
  }

  nameEl.textContent = displayName;
  roleEl.textContent = displayRoleLabel;
}


// ===== UI refs
const gallery = document.getElementById("gallery");
const qEl = document.getElementById("q");
const sortEl = document.getElementById("sort");
const btnGrid = document.getElementById("btnGrid");
const btnList = document.getElementById("btnList");
const countText = document.getElementById("countText");

const chipsEmirates = document.getElementById("chipsEmirates");
const chipsDigits = document.getElementById("chipsDigits");

const addModal = document.getElementById("addModal");
const btnOpenAdd = document.getElementById("btnOpenAdd");
const btnCloseAdd = document.getElementById("btnCloseAdd");
const navItems = [...document.querySelectorAll(".navItem")];

const addEmirate = document.getElementById("addEmirate");
const addFile = document.getElementById("addFile");
const addPreview = document.getElementById("addPreview");
const addStatus = document.getElementById("addStatus");
const addPlate = document.getElementById("addPlate");
const addCode = document.getElementById("addCode");
const addDigits = document.getElementById("addDigits");
const addNeedsReview = document.getElementById("addNeedsReview");
const btnDoOcr = document.getElementById("btnDoOcr");
const btnSave = document.getElementById("btnSave");
const addCandidates = document.getElementById("addCandidates");

// ===== Filters (ako na local)
const EMIRATES = ["UAE","Dubai","Abu Dhabi","Sharjah","Ajman","Ras Al Khaimah","Fujairah","Umm Al Quwain"];
const DIGIT_FILTERS = [
  { key:"all", label:"All digits" },
  { key:"1", label:"1-digit" },
  { key:"2", label:"2-digit" },
  { key:"3", label:"3-digit" },
  { key:"45", label:"4–5" },
  { key:"review", label:"Inspection required" },
];

let state = {
  emirate: "UAE",
  digitsKey: "All",
  view: "grid",
  sort: "new",
  q: "",
  items: [],
  filtered: []
};

// ===== Helpers
const norm = (s) => (s || "").toString().trim();
const onlyDigits = (s) => norm(s).replace(/\D+/g,"");
const upper = (s) => norm(s).toUpperCase();

function digitsBucket(n){
  if(!n) return 0;
  if(n.length===1) return 1;
  if(n.length===2) return 2;
  if(n.length===3) return 3;
  if(n.length===4 || n.length===5) return 45;
  return 99;
}

// jednoduché rarity skóre ako v local (približne)
function rarityScore(digits){
  const n = onlyDigits(digits);
  if(!n) return { label:"Inspection required", score:0 };
  if(n.length===1) return { label:"Extremely rare", score:99 };
  if(n.length===2) return { label:"Very rare", score:95 };
  if(n.length===3) return { label:"Rare", score:70 };
  if(n.length===4) return { label:"Uncommon", score:55 };
  if(n.length===5) return { label:"More common", score:40 };
  return { label:"Neznáme", score:0 };
}

function buildPlateText(code, digits){
  const c = upper(code);
  const d = onlyDigits(digits);
  if(c && d) return `${c} ${d}`;
  if(d) return d;
  if(c) return c;
  return "";
}

function setView(view){
  state.view = view;
  if(view==="grid"){
    gallery.classList.remove("list");
    gallery.classList.add("grid");
    btnGrid.classList.add("on"); btnList.classList.remove("on");
  } else {
    gallery.classList.remove("grid");
    gallery.classList.add("list");
    btnList.classList.add("on"); btnGrid.classList.remove("on");
  }
}

function openAdd(){
  addModal.classList.add("show");
  addModal.setAttribute("aria-hidden","false");
}
function closeAdd(){
  addModal.classList.remove("show");
  addModal.setAttribute("aria-hidden","true");
}

function setStatus(text){
  addStatus.textContent = text;
}

// ===== Chips UI
function renderChips(){
  chipsEmirates.innerHTML = "";
  EMIRATES.forEach(e=>{
    const b = document.createElement("button");
    b.className = "chip" + (state.emirate===e ? " on":"");
    b.textContent = e;
    b.onclick = () => { state.emirate=e; renderChips(); applyFilters(); };
    chipsEmirates.appendChild(b);
  });

  chipsDigits.innerHTML = "";
  DIGIT_FILTERS.forEach(f=>{
    const b = document.createElement("button");
    b.className = "chip" + (state.digitsKey===f.key ? " on":"");
    b.textContent = f.label;
    b.onclick = () => { state.digitsKey=f.key; renderChips(); applyFilters(); };
    chipsDigits.appendChild(b);
  });
}

// ===== Firestore load
async function loadLatest(){
  // 200 posledných (môžeme zvýšiť)
  const col = collection(db, "plates");
  const qy = query(col, orderBy("createdAt","desc"), limit(200));
  const snap = await getDocs(qy);
  const out = [];
  snap.forEach(d=>{
    out.push({ id: d.id, ...d.data() });
  });
  state.items = out;
  applyFilters();
}

// ===== Filters
function matchesEmirate(item){
  if(state.emirate==="UAE") return true;
  return norm(item.emirate) === state.emirate;
}
function matchesDigits(item){
  const needReview = !!item.needsReview;
  const d = onlyDigits(item.digits || item.plateDigits || "");
  const b = digitsBucket(d);

  if(state.digitsKey==="all") return true;
  if(state.digitsKey==="review") return needReview || !d;
  if(state.digitsKey==="45") return b===45;
  return String(b)===state.digitsKey;
}
function matchesQuery(item){
  const q = upper(state.q);
  if(!q) return true;

  const plate = upper(item.plateText || "");
  const code = upper(item.code || "");
  const digits = onlyDigits(item.digits || "");
  const emir = upper(item.emirate || "");

  return plate.includes(q) || code.includes(q) || digits.includes(onlyDigits(q)) || emir.includes(q);
}

function applyFilters(){
  let arr = [...state.items];

  // sort
  if(state.sort==="old") {
    arr.reverse();
  }

  arr = arr.filter(it => matchesEmirate(it) && matchesDigits(it) && matchesQuery(it));
  state.filtered = arr;

  countText.textContent = `${arr.length} položky`;
  renderGallery();
}

// ===== Render cards
function renderGallery(){
  gallery.innerHTML = "";
  state.filtered.forEach(item=>{
    const a = document.createElement("a");
    a.className = "card";
    a.href = item.imageUrl || "#";
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = item.imageUrl || "";
    img.alt = "car";

    const body = document.createElement("div");
    body.className = "cardBody";

    const line1 = document.createElement("div");
    line1.className = "line1";

    const dot = document.createElement("span");
    dot.className = "greenDot";

    const plate = document.createElement("div");
    plate.className = "plateText";
    plate.textContent = `${item.emirate || "—"} · ${item.plateText || "—"}`;

    const badge = document.createElement("div");
    badge.className = "badge" + (item.needsReview ? " review":"");
    badge.textContent = item.needsReview ? "Vyžaduje kontrolu" : "OK";

    line1.append(dot, plate, badge);

    const rs = rarityScore(item.digits || "");
    const rar = document.createElement("div");
    rar.className = "rarity";
    rar.textContent = `${rs.label} · ${rs.score}/100`;

    const meta = document.createElement("div");
    meta.className = "meta muted small";
    const by = item.ownerName || "Anon";
    const dt = item.createdAt?.toDate ? item.createdAt.toDate() : null;
    const dateStr = dt ? dt.toLocaleDateString("sk-SK") : "";
    meta.textContent = `Pridal(a) ${by}${dateStr ? " · " + dateStr : ""}`;

    body.append(line1, rar, meta);

// ACTIONS
const canEdit = isAdmin || (currentUser && item.ownerUid === currentUser.uid);
if(canEdit){
  const actions = document.createElement("div");
  actions.className = "actions";

  const bEdit = document.createElement("button");
  bEdit.className = "btnTiny";
  bEdit.textContent = "Edit";
  bEdit.onclick = async (e)=>{
    e.preventDefault(); e.stopPropagation();

    const newEmirate = prompt("Emirate:", item.emirate || "");
    if(newEmirate === null) return;

    const newCode = prompt("Code (letter):", item.code || "");
    if(newCode === null) return;

    const newDigits = prompt("Digits:", item.digits || "");
    if(newDigits === null) return;

    const newNeedsReview = confirm("Inspection required? (OK = Yes, Cancel = No)");

    const plateText = `${(newEmirate||"").trim()} ${(newCode||"").trim()} ${(newDigits||"").trim()}`.trim();
    const rs = rarityScore(newDigits || "");

    await updateDoc(doc(db, "plates", item.id), {
      emirate: (newEmirate||"").trim(),
      code: (newCode||"").trim(),
      digits: (newDigits||"").trim(),
      plateText,
      rarityLabel: rs.label,
      rarityScore: rs.score,
      needsReview: !!newNeedsReview
    });

    await loadLatest();
  };

  const bDel = document.createElement("button");
  bDel.className = "btnTiny danger";
  bDel.textContent = "Delete";
  bDel.onclick = async (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(!confirm("Zmazať tento záznam?")) return;

    // delete storage file if exists
    if(item.imagePath){
      try{ await deleteObject(sRef(storage, item.imagePath)); }catch(_){}
    }
    await deleteDoc(doc(db, "plates", item.id));
    await loadLatest();
  };

  actions.append(bEdit, bDel);
  body.appendChild(actions);
}

a.append(img, body);

    // Right-click / alt-click quick edit
    a.addEventListener("click", (e) => {
      // normálne otvorí obrázok v novej karte
    });

    gallery.appendChild(a);
  });
}

// ===== ADD FLOW
addFile.addEventListener("change", () => {
  const f = addFile.files?.[0];
  if(!f) return;
  addPreview.src = URL.createObjectURL(f);
  setStatus("Photo ready");
});

btnOpenAdd.onclick = openAdd;
btnCloseAdd.onclick = closeAdd;
addModal.addEventListener("click", (e) => {
  if(e.target === addModal) closeAdd();
});

// bottom nav -> otvor add
navItems.forEach(btn=>{
  btn.onclick = () => {
    navItems.forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const page = btn.dataset.page;
    if(page==="add") openAdd();
  };
});

qEl.addEventListener("input", () => { state.q = qEl.value; applyFilters(); });
sortEl.addEventListener("change", () => { state.sort = sortEl.value; applyFilters(); });

btnGrid.onclick = () => setView("grid");
btnList.onclick = () => setView("list");

// OCR (cez Netlify function /api/ocr)
async function doOcr(file){
  const fd = new FormData();
  fd.append("file", file);
  fd.append("emirate", addEmirate.value);

  // Netlify automaticky mapuje functions cez /.netlify/functions/...
  // Ak máš redirect na /api/*, nechaj /api/ocr. Inak použi /.netlify/functions/ocr
  const res = await fetch("/.netlify/functions/ocr", {
    method: "POST",
    body: fd
  });

  if(!res.ok) throw new Error("OCR failed");
  return await res.json();
}

// veľmi jednoduché “upratanie” OCR textu
function pickBestPlate(result){
  const candidates = result?.candidates || [];
  // očakávame niečo ako "H 6403" alebo aspoň digits
  let best = { plateText:"", code:"", digits:"", confidence:0 };

  for(const c of candidates){
    const t = upper(c.text || "");
    const conf = Number(c.confidence || 0);

    // extrahuj "LETTER + digits"
    const m = t.match(/\b([A-Z])\s*[- ]?\s*(\d{1,5})\b/);
    if(m){
      const code = m[1];
      const digits = m[2];
      const plateText = `${code} ${digits}`;
      const score = conf + (digits.length===1?20:digits.length===2?15:digits.length===3?8:0);
      if(score > best.confidence){
        best = { plateText, code, digits, confidence: score };
      }
      continue;
    }

    // fallback: len čísla
    const d = (t.match(/\b\d{1,5}\b/)||[])[0];
    if(d){
      const score = conf - 5;
      if(score > best.confidence){
        best = { plateText: d, code:"", digits:d, confidence: score };
      }
    }
  }

  return { best, candidates };
}

btnDoOcr.onclick = async () => {
  const f = addFile.files?.[0];
  if(!f) return alert("Vyber fotku.");
  try{
    setStatus("OCR…");
    const r = await doOcr(f);
    const { best, candidates } = pickBestPlate(r);
    addCandidates.textContent = JSON.stringify(candidates, null, 2);

    addPlate.value = best.plateText || "";
    addCode.value = best.code || "";
    addDigits.value = best.digits || "";

    // ak to vyzerá divne → needs review
    const d = onlyDigits(addDigits.value);
    const suspicious = !d || d.length > 5;
    addNeedsReview.checked = suspicious || !!r.needsReview;
    setStatus(best.plateText ? "OCR done" : "OCR weak (review)");
  }catch(err){
    console.error(err);
    setStatus("OCR error");
    alert("OCR failed. Try another photo or fix it manually.");
  }
};

btnSave.onclick = async () => {
  const f = addFile.files?.[0];
  if(!f) return alert("Select a photo.");

  const emirate = addEmirate.value;
  const code = upper(addCode.value);
  const digits = onlyDigits(addDigits.value);
  const plateText = norm(addPlate.value) || buildPlateText(code, digits);

  if(!plateText) return alert("Fill in the registration number.");

  try{
    setStatus("Uploading…");

    // upload to Storage
    if(!currentUser){
  alert("Auth not ready yet. Skús o chvíľu.");
  return;
}

const ownerUid = currentUser.uid;
const path = `plates/${ownerUid}/${Date.now()}_${Math.random().toString(16).slice(2)}_${f.name}`;
    const storageRef = sRef(storage, path);
    await uploadBytes(storageRef, f);
    const imageUrl = await getDownloadURL(storageRef);

    const rs = rarityScore(digits);

    // save to Firestore
    await addDoc(collection(db, "plates"), {
      emirate,
      code: code || "",
      digits: digits || "",
      plateText,
      rarityLabel: rs.label,
      rarityScore: rs.score,
      needsReview: !!addNeedsReview.checked,
      imageUrl,
      imagePath: path,
     ownerUid: currentUser.uid,
ownerName: currentUser.isAnonymous
  ? getAnonNickForUid(currentUser.uid)
  : (currentUser.email || "Admin"),
ownerType: currentUser.isAnonymous ? "anonymous" : "admin",
      createdAt: serverTimestamp()
    });

    setStatus("Saved ✅");
    closeAdd();

    // reset form
    addFile.value = "";
    addPreview.src = "";
    addPlate.value = "";
    addCode.value = "";
    addDigits.value = "";
    addNeedsReview.checked = false;
    addCandidates.textContent = "[]";

    await loadLatest();
  }catch(err){
    console.error(err);
    setStatus("Save error");
    alert("Uloženie zlyhalo (Firebase config/Storage/Rules).");
  }
};

onAuthStateChanged(auth, async (u)=>{
  currentUser = u;

  if(!currentUser){
    await signInAnonymously(auth);
    return;
  }

  isAdmin = !currentUser.isAnonymous && ADMIN_UIDS.includes(currentUser.uid);
  refreshUserPill();

  // pre istotu reload listu, nech sa zobrazia Edit/Delete tlačidlá
  applyFilters();
});

const userPill = document.getElementById("userPill");
if(userPill){
  userPill.addEventListener("click", async ()=>{
    if(!currentUser) return;

    if(currentUser.isAnonymous){
      if(!confirm("Prihlásiť sa ako ADMIN?")) return;
      const email = prompt("Admin email:");
      if(!email) return;
      const pass = prompt("Admin password:");
      if(!pass) return;

      try{
        await signInWithEmailAndPassword(auth, email.trim(), pass);
        alert("Admin prihlásený.");
      }catch(e){
        console.error(e);
        alert("Admin login failed: " + (e?.message || ""));
      }
    } else {
      if(!confirm("Odhlásiť ADMINa a prejsť späť na anonym?")) return;
      await signOut(auth);
      await signInAnonymously(auth);
    }
  });
}

// ===== Auth init
onAuthStateChanged(auth, async (u)=>{
  currentUser = u;

  if(!currentUser){
    try{ await signInAnonymously(auth); }
    catch(e){
      console.error(e);
      alert("Auth error (Anonymous sign-in). Skontroluj Firebase Auth provider v Firebase Console.");
    }
    return;
  }

  setUserPill(currentUser);
});

// User pill actions (Admin login / Sign out)
const userPill = document.getElementById("userPill");
if(userPill){
  userPill.addEventListener("click", async ()=>{
    if(!currentUser) return;

    if(currentUser.isAnonymous){
      if(!confirm("Prihlásiť sa ako ADMIN?")) return;
      const email = prompt("Admin email:");
      if(!email) return;
      const pass = prompt("Admin password:");
      if(!pass) return;

      try{
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      }catch(e){
        console.error(e);
        alert("Admin login failed.");
      }
    }else{
      if(!confirm("Odhlásiť ADMINa a prejsť späť na anonym?")) return;
      try{
        await signOut(auth);
        await signInAnonymously(auth);
      }catch(e){
        console.error(e);
        alert("Sign out failed.");
      }
    }
  });
}

// ===== Init
renderChips();
setView("grid");
loadLatest().catch(e=>{
  console.error(e);
  alert("Nepodarilo sa načítať dáta z Firestore. Skontroluj Firebase config + Firestore rules.");
});
