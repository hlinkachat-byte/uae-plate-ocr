// ===== Tabs =====
const tabUpload = document.getElementById("tabUpload");
const tabCatalog = document.getElementById("tabCatalog");
const uploadSection = document.getElementById("uploadSection");
const catalogSection = document.getElementById("catalogSection");

tabUpload.onclick = () => {
  tabUpload.classList.add("active");
  tabCatalog.classList.remove("active");
  uploadSection.style.display = "block";
  catalogSection.style.display = "none";
};

tabCatalog.onclick = () => {
  tabCatalog.classList.add("active");
  tabUpload.classList.remove("active");
  catalogSection.style.display = "block";
  uploadSection.style.display = "none";
  renderCatalog();
};

// ===== Upload preview =====
const photoInput = document.getElementById("photo");
const preview = document.getElementById("preview");

photoInput.onchange = () => {
  const file = photoInput.files[0];
  if (!file) return;
  preview.src = URL.createObjectURL(file);
};

// ===== Fake data store (LOCAL only for now) =====
// Neskôr sa toto nahradí Firestore
let records = [];

// ===== Scan & Save (mock) =====
document.getElementById("scanBtn").onclick = () => {
  const file = photoInput.files[0];
  if (!file) {
    alert("Select a photo");
    return;
  }

  const emirate = document.getElementById("emirate").value;

  // fake OCR result (teraz len simulácia)
  const fakePlate =
    emirate.charAt(0).toUpperCase() + " " +
    Math.floor(10000 + Math.random() * 89999);

  document.getElementById("plateText").innerText = fakePlate;

  records.unshift({
    plate: fakePlate,
    emirate,
    image: preview.src,
    createdAt: new Date()
  });

  alert("Saved to catalog (local demo)");
};

// ===== Catalog =====
const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const filterEmirate = document.getElementById("filterEmirate");

searchInput.oninput = renderCatalog;
filterEmirate.onchange = renderCatalog;

function renderCatalog() {
  gallery.innerHTML = "";

  const q = searchInput.value.toLowerCase();
  const emirateFilter = filterEmirate.value;

  records
    .filter(r =>
      (!q || r.plate.toLowerCase().includes(q)) &&
      (!emirateFilter || r.emirate === emirateFilter)
    )
    .forEach(r => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${r.image}">
        <div class="info">
          <strong>${r.plate}</strong><br>
          ${r.emirate}<br>
          <small>${r.createdAt.toLocaleString()}</small>
        </div>
      `;

      gallery.appendChild(card);
    });
}
