(function () {
  "use strict";

  var DATA = window.SITE_DATA || { cases: [] };
  var CONFIG = window.SITE_CONFIG || {};
  var client = null;

  var BUCKET = "photos";
  var PHOTO_TABLE = "photos";
  var LEAD_TABLE = "leads";

  function sbReady() {
    return CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey && typeof window.supabase !== "undefined";
  }

  /* ---------- Вход через Supabase Auth (пароль нигде не хранится в коде сайта) ---------- */
  function initLock() {
    if (!sbReady()) {
      document.getElementById("lock-screen").innerHTML =
        '<p style="color:#d86a5d;">Supabase не настроен. Заполни SITE_CONFIG.supabase в config.js — инструкция в README.md.</p>';
      return;
    }
    client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);

    var lockScreen = document.getElementById("lock-screen");
    var adminScreen = document.getElementById("admin-screen");
    var emailInput = document.getElementById("email");
    var pwdInput = document.getElementById("pwd");
    var pwdError = document.getElementById("pwd-error");

    function showAdmin() {
      lockScreen.style.display = "none";
      adminScreen.style.display = "block";
      initAdmin();
    }

    // Если уже входили раньше на этом устройстве — не спрашиваем пароль снова
    client.auth.getSession().then(function (res) {
      if (res.data && res.data.session) showAdmin();
    });

    function tryLogin() {
      pwdError.style.display = "none";
      client.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: pwdInput.value
      }).then(function (res) {
        if (res.error) {
          pwdError.textContent = "Неверный email или пароль";
          pwdError.style.display = "block";
          return;
        }
        showAdmin();
      });
    }

    document.getElementById("pwd-submit").addEventListener("click", tryLogin);
    pwdInput.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  }

  /* ---------- Экран админки ---------- */
  function initAdmin() {
    var select = document.getElementById("case-select");
    select.innerHTML = "";
    DATA.cases.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.title;
      select.appendChild(opt);
    });
    var galleryOpt = document.createElement("option");
    galleryOpt.value = "gallery";
    galleryOpt.textContent = "Общая галерея";
    select.appendChild(galleryOpt);

    document.getElementById("upload-btn").addEventListener("click", handleUpload);
    document.getElementById("logout-btn").addEventListener("click", function () {
      client.auth.signOut().then(function () { location.reload(); });
    });

    initTabs();
    loadPhotoList();
    loadLeadList();
  }

  /* ---------- Вкладки ---------- */
  function initTabs() {
    var tabLeads = document.getElementById("tab-leads");
    var tabPhotos = document.getElementById("tab-photos");
    var panelLeads = document.getElementById("panel-leads");
    var panelPhotos = document.getElementById("panel-photos");

    tabLeads.addEventListener("click", function () {
      tabLeads.classList.add("active");
      tabPhotos.classList.remove("active");
      panelLeads.style.display = "block";
      panelPhotos.style.display = "none";
    });
    tabPhotos.addEventListener("click", function () {
      tabPhotos.classList.add("active");
      tabLeads.classList.remove("active");
      panelPhotos.style.display = "block";
      panelLeads.style.display = "none";
    });
  }

  /* ---------- Заявки ---------- */
  function loadLeadList() {
    var mount = document.getElementById("lead-list");
    mount.innerHTML = '<p class="hint">Загружаю заявки...</p>';

    client.from(LEAD_TABLE).select("*").order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        mount.innerHTML = "";

        var unseenCount = res.data.filter(function (r) { return !r.seen; }).length;
        var badge = document.getElementById("lead-badge");
        if (unseenCount > 0) {
          badge.textContent = unseenCount;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }

        if (!res.data.length) {
          mount.innerHTML = '<p class="hint">Заявок пока нет.</p>';
          return;
        }

        res.data.forEach(function (row) {
          var el = document.createElement("div");
          el.className = "lead-row" + (row.seen ? "" : " unseen");

          var date = new Date(row.created_at);
          var dateStr = date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

          el.innerHTML =
            '<div class="body">' +
              '<div class="top"><span class="name">' + escapeHtml(row.name) + '</span>' +
              '<span class="date">' + dateStr + '</span></div>' +
              '<div class="contact">' + escapeHtml(row.contact) + '</div>' +
              (row.object_type ? '<div class="obj">' + escapeHtml(row.object_type) + '</div>' : "") +
              (row.message ? '<div class="msg">' + escapeHtml(row.message) + '</div>' : "") +
              '<div class="actions"></div>' +
            '</div>';

          var actions = el.querySelector(".actions");

          if (!row.seen) {
            var seenBtn = document.createElement("button");
            seenBtn.textContent = "Отметить прочитанным";
            seenBtn.addEventListener("click", function () { markSeen(row.id); });
            actions.appendChild(seenBtn);
          }

          var delBtn = document.createElement("button");
          delBtn.textContent = "Удалить";
          delBtn.addEventListener("click", function () { deleteLead(row.id); });
          actions.appendChild(delBtn);

          mount.appendChild(el);
        });
      })
      .catch(function (err) {
        mount.innerHTML = '<p class="hint" style="color:#d86a5d;">Не получилось загрузить заявки: ' + (err.message || "") + '</p>';
      });
  }

  function markSeen(id) {
    client.from(LEAD_TABLE).update({ seen: true }).eq("id", id).then(function (res) {
      if (res.error) { console.error(res.error); return; }
      loadLeadList();
    });
  }

  function deleteLead(id) {
    client.from(LEAD_TABLE).delete().eq("id", id).then(function (res) {
      if (res.error) { console.error(res.error); return; }
      loadLeadList();
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  /* ---------- Загрузка фото ---------- */
  function handleUpload() {
    var fileInput = document.getElementById("file");
    var caseId = document.getElementById("case-select").value;
    var caption = document.getElementById("caption").value.trim();
    var status = document.getElementById("upload-status");

    var file = fileInput.files[0];
    if (!file) {
      status.textContent = "Выбери файл фото.";
      status.className = "form-status err";
      return;
    }

    status.textContent = "Загружаю...";
    status.className = "form-status";

    var ext = file.name.split(".").pop();
    var path = caseId + "-" + Date.now() + "." + ext;

    client.storage.from(BUCKET).upload(path, file)
      .then(function (res) {
        if (res.error) throw res.error;
        var pub = client.storage.from(BUCKET).getPublicUrl(path);
        var url = pub.data.publicUrl;
        return client.from(PHOTO_TABLE).insert({
          case_id: caseId,
          url: url,
          caption: caption,
          sort_order: Date.now()
        });
      })
      .then(function (res) {
        if (res.error) throw res.error;
        status.textContent = "Фото загружено и уже на сайте.";
        status.className = "form-status ok";
        fileInput.value = "";
        document.getElementById("caption").value = "";
        loadPhotoList();
      })
      .catch(function (err) {
        console.error(err);
        status.textContent = "Ошибка загрузки: " + (err.message || "проверь настройки Supabase");
        status.className = "form-status err";
      });
  }

  /* ---------- Список загруженных фото ---------- */
  function loadPhotoList() {
    var mount = document.getElementById("photo-list");
    mount.innerHTML = '<p class="hint">Загружаю список...</p>';

    client.from(PHOTO_TABLE).select("*").order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        mount.innerHTML = "";
        if (!res.data.length) {
          mount.innerHTML = '<p class="hint">Пока ничего не загружено.</p>';
          return;
        }
        res.data.forEach(function (row) {
          var caseLabel = row.case_id === "gallery" ? "Общая галерея" :
            ((DATA.cases.find(function (c) { return c.id === row.case_id; }) || {}).title || row.case_id);

          var el = document.createElement("div");
          el.className = "photo-row";
          el.innerHTML =
            '<img src="' + row.url + '" alt="">' +
            '<div class="meta"><div class="t">' + (row.caption || "без подписи") + '</div>' +
            '<div class="s">' + caseLabel + '</div></div>' +
            '<button data-id="' + row.id + '">Удалить</button>';
          el.querySelector("button").addEventListener("click", function () {
            deletePhoto(row.id);
          });
          mount.appendChild(el);
        });
      })
      .catch(function (err) {
        mount.innerHTML = '<p class="hint" style="color:#d86a5d;">Не получилось загрузить список: ' + (err.message || "") + '</p>';
      });
  }

  function deletePhoto(id) {
    client.from(PHOTO_TABLE).delete().eq("id", id).then(function (res) {
      if (res.error) { console.error(res.error); return; }
      loadPhotoList();
    });
  }

  document.addEventListener("DOMContentLoaded", initLock);
})();
