let db;

// Open (or create) the IndexedDB
const request = indexedDB.open('ARFitnessDB', 1);

request.onupgradeneeded = function(event) {
  db = event.target.result;
  const objectStore = db.createObjectStore('members', { keyPath: 'phone' });
  objectStore.createIndex('end', 'end', { unique: false });
};

request.onsuccess = function(event) {
  db = event.target.result;
  updateCounters();
  showNotifications();
};

request.onerror = function(event) {
  console.error("IndexedDB error:", event.target.errorCode);
};

// Add a new member
async function addMember() {
  const name = document.getElementById('name').value;
  const phone = document.getElementById('phone').value;
  const plan = document.getElementById('plan').value;
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  const photo = localStorage.getItem('capturedPhoto');

  if (!name || !phone || !plan || !start || !end) {
    alert("Please fill in all fields.");
    return;
  }

  const exists = await getMemberByPhone(phone);
  if (exists) {
    alert("A member with this phone number already exists.");
    return;
  }

  const transaction = db.transaction(['members'], 'readwrite');
  const store = transaction.objectStore('members');
  store.add({ name, phone, plan, start, end, photo });

  transaction.oncomplete = () => {
    document.getElementById('addForm').style.display = 'none';
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('plan').value = '';
    document.getElementById('start').value = '';
    document.getElementById('end').value = '';
    document.getElementById('photoStatus').innerText = '';
    localStorage.removeItem('capturedPhoto');
    updateCounters();
    showNotifications();
  };
}

// Get member by phone
function getMemberByPhone(phone) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['members'], 'readonly');
    const store = transaction.objectStore('members');
    const request = store.get(phone);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

// Count members by plan
function updateCounters() {
  const transaction = db.transaction(['members'], 'readonly');
  const store = transaction.objectStore('members');

  const now = new Date();
  let total = 0, active = 0, expired = 0;
  let oneMonth = 0, threeMonth = 0, sixMonth = 0, sevenMonth = 0, oneYear = 0;
  let male = 0, female =  0;

  const request = store.openCursor();
  request.onsuccess = function (event) {
    const cursor = event.target.result;
    if (cursor) {
      total++;
      const member = cursor.value;
      const endDate = new Date(member.end);
      const startDate = new Date(member.start);
      const durationMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());

      if (endDate >= now) active++;
      else expired++;

      switch (durationMonths) {
        case 1: oneMonth++; break;
        case 3: threeMonth++; break;
        case 6: sixMonth++; break;
        case 7: sevenMonth++; break;
        
        case 12: oneYear++; break;
      }
      if (member.sex === "Male") male++;
  else if (member.sex === "Female") female++;

      cursor.continue();
    } else {
      document.getElementById('totalCount').textContent = total;
      document.getElementById('activeCount').textContent = active;
      document.getElementById('expiredCount').textContent = expired;
      document.getElementById('oneMonthCount').textContent = oneMonth;
      document.getElementById('threeMonthCount').textContent = threeMonth;
      document.getElementById('sixMonthCount').textContent = sixMonth;
      document.getElementById('sevenMonthCount').textContent = sevenMonth;
      
      document.getElementById('oneYearCount').textContent = oneYear;
      document.getElementById('maleCount').textContent = male;
      document.getElementById('femaleCount').textContent = female;
    }
  };
}

function showNotifications() {
  const now = new Date();
  const container = document.getElementById('upcomingExpirationsList');
  container.innerHTML = '';

  db.transaction("members").objectStore("members").getAll().onsuccess = function (event) {
    const members = event.target.result;

    const expiringSoon = members.filter(member => {
      const endDate = new Date(member.end);
      const timeDiff = endDate - now;
      const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      return dayDiff <= 5 && dayDiff >= 0;
    });

    expiringSoon.forEach(member => {
      const card = document.createElement('div');
      card.className = 'upcoming-card';

      const photo = document.createElement('img');
      photo.src = member.photo || '';
      photo.alt = member.name;
      photo.onclick = () => viewPhotoFullscreen(member.photo);

      card.appendChild(photo);
      card.innerHTML += `
        <strong>${member.name}</strong>
        <p>Phone: ${member.phone}</p>
        <p>Plan: ${member.plan}</p>
        <p>Start: ${member.start}</p>
        <p>End: ${member.end}</p>
        <p style="color: #ff0000ff;">Expires on ${member.end}</p>
      `;

      container.appendChild(card);
    });
  };
}

function viewPhotoFullscreen(photoUrl) {
  const modal = document.getElementById("photoModal");
  const modalImg = document.getElementById("modalPhoto");
  modalImg.src = photoUrl;
  modal.style.display = "flex";
}

function closePhotoModal() {
  document.getElementById("photoModal").style.display = "none";
}

// Expose to global scope
window.viewPhotoFullscreen = viewPhotoFullscreen;
window.closePhotoModal = closePhotoModal;



function forceClosePhotoModal(event) {
  event.stopPropagation();
  document.getElementById('photoModal').style.display = 'none';
}

// Handle photo input
document.getElementById('photo').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    localStorage.setItem('capturedPhoto', e.target.result);
    document.getElementById('photoStatus').innerText = 'Photo attached ✅';
  };
  reader.readAsDataURL(file);
});

// CSV Backup (including photo)
function backupToCSV() {
  const tx = db.transaction("members", "readonly");
  const store = tx.objectStore("members");
  const allData = store.getAll();

  allData.onsuccess = function () {
    const members = allData.result;
    if (!members.length) return alert("No data to export.");

    const csvHeader = ["Name", "Phone", "Plan", "Start", "End", "Photo"];
    const rows = members.map(m => [m.name, m.phone, m.plan, m.start, m.end, m.photo || ""]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + csvHeader.join(",") + "\n"
      + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "members_backup.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

// CSV Upload & Restore
document.getElementById('csvUpload').addEventListener('change', function (e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (event) {
    const lines = event.target.result.split("\n").slice(1); // skip header
    const tx = db.transaction("members", "readwrite");
    const store = tx.objectStore("members");

    lines.forEach(line => {
      const [name, phone, plan, start, end, photo] = line.split(",").map(cell => cell?.replace(/^"|"$/g, "").trim());
      if (name && phone && plan && start && end) {
        const member = { name, phone, plan, start, end, photo };
        store.put(member);
      }
    });

    tx.oncomplete = () => {
      alert("CSV imported to IndexedDB successfully!");
      updateCounters();
      showNotifications();
    };
  };

  reader.readAsText(file);
});

// Utility
function logout() {
  localStorage.removeItem("loggedIn");
  window.location.href = "login.html";
}

function toggleAddForm() {
  const form = document.getElementById('addForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function setPlanDuration(months) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);
  document.getElementById('start').valueAsDate = startDate;
  document.getElementById('end').valueAsDate = endDate;
}