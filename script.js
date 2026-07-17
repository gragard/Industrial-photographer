(function () {
  "use strict";

  var DATA = window.SITE_DATA || { cases: [], gallery: [] };
  var CONFIG = window.SITE_CONFIG || {};

  /* ---------- Плейсхолдер / картинка ---------- */
  function mediaEl(item, extraClass) {
    if (item && item.src) {
      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || "";
      img.loading = "lazy";
      if (extraClass) img.className = extraClass;
      return img;
    }
    var ph = document.createElement("div");
    ph.className = "ph";
    var label = document.createElement("span");
    label.className = "ph-label";
    label.textContent = (item && item.alt) || "фото";
    ph.appendChild(label);
    return ph;
  }

  /* ---------- Рендер кейсов ---------- */
  function renderCases() {
    var mount = document.getElementById("cases-mount");
    if (!mount) return;

    DATA.cases.forEach(function (c, i) {
      var block = document.createElement("div");
      block.className = "case-block reveal" + (i % 2 === 1 ? " reverse" : "");

      var photos = document.createElement("div");
      photos.className = "case-photos";
      (c.photos || []).slice(0, 4).forEach(function (p) {
        var wrap = document.createElement("div");
        wrap.style.overflow = "hidden";
        wrap.style.cursor = "pointer";
        wrap.appendChild(mediaEl(p));
        var img = wrap.querySelector("img");
        if (img) { img.style.width = "100%"; img.style.height = "100%"; img.style.objectFit = "cover"; }
        wrap.addEventListener("click", function () { openLightbox(p); });
        photos.appendChild(wrap);
      });

      var info = document.createElement("div");
      info.className = "case-info";
      info.innerHTML =
        '<span class="case-code">' + c.code + '</span>' +
        "<h3>" + c.title + "</h3>" +
        '<span class="case-location">' + c.location + "</span>" +
        "<p>" + c.description + "</p>";

      block.appendChild(photos);
      block.appendChild(info);
      mount.appendChild(block);
    });
  }

  /* ---------- Лайтбокс (общий для кейсов и галереи) ---------- */
  function openLightbox(item) {
    var lightbox = document.getElementById("lightbox");
    var lightboxInner = document.getElementById("lightbox-inner");
    lightboxInner.innerHTML = "";
    lightboxInner.appendChild(mediaEl(item));
    lightbox.classList.add("open");
  }

  function initLightbox() {
    var lightbox = document.getElementById("lightbox");
    document.getElementById("lightbox-close").addEventListener("click", function () {
      lightbox.classList.remove("open");
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) lightbox.classList.remove("open");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") lightbox.classList.remove("open");
    });
  }

  /* ---------- Рендер галереи ---------- */
  function renderGallery() {
    var mount = document.getElementById("gallery-mount");
    if (!mount) return;

    DATA.gallery.forEach(function (item) {
      var cell = document.createElement("div");
      cell.className = "gallery-item";
      cell.appendChild(mediaEl(item));
      cell.addEventListener("click", function () { openLightbox(item); });
      mount.appendChild(cell);
    });
  }

  /* ---------- Мобильное меню ---------- */
  function initMobileMenu() {
    var toggle = document.getElementById("nav-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;
    toggle.addEventListener("click", function () {
      menu.classList.toggle("open");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { menu.classList.remove("open"); });
    });
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Форма заявки ---------- */
  function initForm() {
    var form = document.getElementById("lead-form");
    if (!form) return;
    var status = document.getElementById("form-status");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var name = (fd.get("name") || "").toString().trim();
      var contact = (fd.get("contact") || "").toString().trim();
      var objectType = (fd.get("objectType") || "").toString().trim();
      var message = (fd.get("message") || "").toString().trim();

      if (!name || !contact) {
        status.textContent = "Заполните имя и контакт для связи.";
        status.className = "form-status err";
        return;
      }

      var text =
        "Новая заявка с сайта\n" +
        "Имя: " + name + "\n" +
        "Контакт: " + contact + "\n" +
        "Тип объекта: " + (objectType || "не указан") + "\n" +
        "Комментарий: " + (message || "—");

      var botToken = CONFIG.telegram && CONFIG.telegram.botToken;
      var chatId = CONFIG.telegram && CONFIG.telegram.chatId;

      if (!botToken || !chatId) {
        status.textContent = "Форма пока не подключена. Свяжитесь напрямую по контактам ниже.";
        status.className = "form-status err";
        return;
      }

      status.textContent = "Отправляю...";
      status.className = "form-status";

      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 8000);

      fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text }),
        signal: controller.signal
      })
        .then(function (r) { clearTimeout(timeoutId); return r.json(); })
        .then(function (r) {
          if (r.ok) {
            status.textContent = "Заявка отправлена. Отвечу в ближайшее время.";
            status.className = "form-status ok";
            form.reset();
          } else {
            throw new Error("telegram error");
          }
        })
        .catch(function () {
          clearTimeout(timeoutId);
          status.textContent = "Не получилось отправить (проблема со связью). Напишите напрямую в Telegram по контактам ниже.";
          status.className = "form-status err";
        });
    });
  }

  function renderAbout() {
    var mount = document.getElementById("about-media");
    if (!mount || !DATA.about) return;
    var el = mediaEl(DATA.about);
    if (el.tagName === "IMG") { el.style.width = "100%"; el.style.height = "100%"; el.style.objectFit = "cover"; }
    mount.appendChild(el);
  }

  /* ---------- Подтягиваем фото, загруженные через /admin.html ---------- */
  function loadRemotePhotos() {
    var sb = CONFIG.supabase;
    if (!sb || !sb.url || !sb.anonKey || typeof window.supabase === "undefined") {
      return Promise.resolve();
    }
    var client = window.supabase.createClient(sb.url, sb.anonKey);
    return client
      .from("photos")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(function (res) {
        if (!res.data || !res.data.length) return;
        var byCase = {};
        var gallery = [];
        res.data.forEach(function (row) {
          var photo = { src: row.url, alt: row.caption || "" };
          if (row.case_id === "gallery" || !row.case_id) {
            gallery.push(photo);
          } else {
            byCase[row.case_id] = byCase[row.case_id] || [];
            byCase[row.case_id].push(photo);
          }
        });
        DATA.cases.forEach(function (c) {
          if (byCase[c.id] && byCase[c.id].length) c.photos = byCase[c.id];
        });
        if (gallery.length) DATA.gallery = gallery;
      })
      .catch(function (err) {
        console.warn("Не удалось загрузить фото из Supabase:", err);
      });
  }

  function renderHero() {
    var el = document.querySelector(".hero-media");
    var note = document.querySelector(".hero-placeholder-note");
    if (!el || !DATA.hero) return;
    if (DATA.hero.src) {
      el.style.backgroundImage = "url('" + DATA.hero.src + "')";
      el.classList.add("has-photo");
      if (note) note.remove();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadRemotePhotos().then(function () {
      renderHero();
      renderAbout();
      renderCases();
      renderGallery();
      initLightbox();
      initMobileMenu();
      initReveal();
      initForm();
    });
  });
})();
