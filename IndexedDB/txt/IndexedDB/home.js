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
  let oneMonth = 0, threeMonth = 0, sixMonth = 0, oneYear = 0;

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
        case 12: oneYear++; break;
      }

      cursor.continue();
    } else {
      document.getElementById('totalCount').textContent = total;
      document.getElementById('activeCount').textContent = active;
      document.getElementById('expiredCount').textContent = expired;
      document.getElementById('oneMonthCount').textContent = oneMonth;
      document.getElementById('threeMonthCount').textContent = threeMonth;
      document.getElementById('sixMonthCount').textContent = sixMonth;
      document.getElementById('oneYearCount').textContent = oneYear;
    }
  };
}

function showNotifications() {
  const now = new Date();
  const notifications = [];

  db.transaction("members").objectStore("members").getAll().onsuccess = function (event) {
    const members = event.target.result;

    members.forEach((m, index) => {
      const endDate = new Date(m.end);
      const timeDiff = endDate - now;
      const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      if (dayDiff <= 5 && dayDiff >= 0) {
        notifications.push({ ...m, index });
      }
    });

    const notificationBar = document.getElementById('notificationBar');
    const notificationList = document.getElementById('notifications');
    notificationList.innerHTML = '';

    if (notifications.length > 0) {
      notifications.forEach(n => {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.innerHTML = `
          <strong>${n.name}</strong><br>
          Phone: ${n.phone}, Plan: ${n.plan} expires on <strong>${n.end}</strong><br>
          ${n.photo ? `<img src="${n.photo}" style="width:60px; height:auto; margin-top:5px; cursor:pointer; border-radius: 6px;" onclick="viewPhotoFullscreen('${n.photo}')" />` : ''}
        `;
        notificationList.appendChild(div);
      });
      notificationBar.style.display = 'block';
    } else {
      notificationBar.style.display = 'none';
    }
  };
}
function viewPhotoFullscreen(photoDataUrl) {
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('modalPhoto');
  img.src = photoDataUrl;
  modal.style.display = 'flex';
}

function closePhotoModal(event) {
  const modal = document.getElementById('photoModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
}

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
