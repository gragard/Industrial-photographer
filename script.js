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
    mount.innerHTML = ""; // на случай повторного рендера после подгрузки Supabase

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

    initReveal();
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
    mount.innerHTML = ""; // на случай повторного рендера после подгрузки Supabase

    DATA.gallery.forEach(function (item) {
      var cell = document.createElement("div");
      cell.className = "gallery-item";
      cell.appendChild(mediaEl(item));
      cell.addEventListener("click", function () { openLightbox(item); });
      mount.appendChild(cell);
    });

    initReveal();
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
    var els = document.querySelectorAll(".reveal:not(.in)");
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

  /* ---------- Яндекс Метрика: безопасная отправка целей ---------- */
  // Если номер счётчика не определяется сам, впишите его сюда, например: 12345678
  var YM_ID = 0;

  function ymCounterId() {
    if (YM_ID) return YM_ID;
    try {
      if (window.ym && window.ym.a) {
        for (var i = 0; i < window.ym.a.length; i++) {
          var args = window.ym.a[i];
          if (args && args[1] === "init") return args[0];
        }
      }
    } catch (e) {}
    try {
      if (window.Ya && window.Ya._metrika && window.Ya._metrika.getCounters) {
        var list = window.Ya._metrika.getCounters();
        if (list && list[0] && list[0].id) return list[0].id;
      }
    } catch (e) {}
    return 0;
  }

  function track(goal, params) {
    try {
      var id = ymCounterId();
      if (id && typeof window.ym === "function") window.ym(id, "reachGoal", goal, params || {});
    } catch (e) {}
  }

  /* ---------- Форма заявки ---------- */
  function initForm() {
    var form = document.getElementById("lead-form");
    if (!form) return;
    var status = document.getElementById("form-status");
    if (form.dataset.bound === "1") return; // защита от повторной привязки
    form.dataset.bound = "1";

    var submitBtn = form.querySelector('button[type="submit"]');
    var sending = false;

    function setStatus(text, cls) {
      status.textContent = text;
      status.className = "form-status" + (cls ? " " + cls : "");
    }

    // Один запрос к функции send-lead. Никогда не бросает исключение,
    // всегда возвращает объект с результатом и причиной.
    function attempt(payload, timeoutMs) {
      var sb = CONFIG.supabase;
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

      var opts = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + sb.anonKey,
          "apikey": sb.anonKey
        },
        body: JSON.stringify(payload)
      };
      if (controller) opts.signal = controller.signal;

      return fetch(sb.url + "/functions/v1/send-lead", opts).then(
        function (r) {
          return r.json().catch(function () { return null; }).then(function (data) {
            if (timer) clearTimeout(timer);
            if (r.ok && data && data.ok) return { ok: true };
            return {
              ok: false,
              reason: r.ok ? "bad_response" : "http_" + r.status,
              status: r.status,
              retry: r.status >= 500 || r.status === 429
            };
          });
        },
        function (err) {
          if (timer) clearTimeout(timer);
          var isTimeout = err && err.name === "AbortError";
          return {
            ok: false,
            reason: isTimeout ? "timeout" : "network",
            message: String((err && err.message) || err).slice(0, 120),
            retry: true
          };
        }
      );
    }

    // Если автоматическая отправка не удалась, не показываем тупиковую ошибку,
    // а даём человеку готовый текст заявки и кнопки связи.
    function showFallback(p) {
      var text = "Здравствуйте! Заявка с сайта.\nИмя: " + p.name +
        "\nКонтакт: " + p.contact +
        (p.objectType ? "\nОбъект: " + p.objectType : "") +
        (p.message ? "\nЗадача: " + p.message : "");

      status.className = "form-status err";
      status.textContent = "";

      var msg = document.createElement("div");
      msg.textContent = "Заявка не ушла автоматически. Нажмите кнопку ниже, текст уже подготовлен.";
      msg.style.marginBottom = "12px";

      var row = document.createElement("div");
      row.style.display = "flex";
      row.style.flexWrap = "wrap";
      row.style.gap = "10px";

      var tg = document.createElement("a");
      tg.className = "btn btn-signal";
      tg.href = "https://t.me/gabdulatukai?text=" + encodeURIComponent(text);
      tg.target = "_blank";
      tg.rel = "noopener";
      tg.textContent = "Написать в Telegram";
      tg.addEventListener("click", function () { track("form_fallback_tg"); });

      var call = document.createElement("a");
      call.className = "btn btn-ghost";
      call.href = "tel:+79111192091";
      call.textContent = "Позвонить";
      call.addEventListener("click", function () { track("form_fallback_call"); });

      row.appendChild(tg);
      row.appendChild(call);
      status.appendChild(msg);
      status.appendChild(row);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;

      var fd = new FormData(form);
      var name = (fd.get("name") || "").toString().trim();
      var contact = (fd.get("contact") || "").toString().trim();
      var objectType = (fd.get("objectType") || "").toString().trim();
      var message = (fd.get("message") || "").toString().trim();

      if (!name || !contact) {
        setStatus("Заполните имя и контакт для связи.", "err");
        return;
      }

      var payload = { name: name, contact: contact, objectType: objectType, message: message };

      var sb = CONFIG.supabase;
      if (!sb || !sb.url || !sb.anonKey) {
        track("form_fail", { reason: "no_config" });
        showFallback(payload);
        return;
      }

      sending = true;
      if (submitBtn) submitBtn.disabled = true;
      setStatus("Отправляю...");
      track("form_submit");

      var started = Date.now();

      attempt(payload, 10000)
        .then(function (res) {
          res.attempts = 1;
          if (!res.ok && res.retry) {
            // Одна повторная попытка через 1,5 секунды
            return new Promise(function (resolve) { setTimeout(resolve, 1500); })
              .then(function () { return attempt(payload, 10000); })
              .then(function (res2) { res2.attempts = 2; return res2; });
          }
          return res;
        })
        .then(function (res) {
          sending = false;
          if (submitBtn) submitBtn.disabled = false;
          var ms = Date.now() - started;

          if (res.ok) {
            setStatus("Заявка отправлена. Отвечу в ближайшее время.", "ok");
            form.reset();
            track("form_ok", { ms: ms, attempts: res.attempts });
          } else {
            console.error("send-lead: не удалось отправить", res);
            track("form_fail", {
              reason: res.reason,
              status: res.status || 0,
              message: res.message || "",
              ms: ms,
              attempts: res.attempts,
              ua: (navigator.userAgent || "").slice(0, 150)
            });
            showFallback(payload);
          }
        });
    });
  }

  function renderAbout() {
    var mount = document.getElementById("about-media");
    if (!mount || !DATA.about) return;
    mount.innerHTML = "";
    var el = mediaEl(DATA.about);
    if (el.tagName === "IMG") { el.style.width = "100%"; el.style.height = "100%"; el.style.objectFit = "cover"; }
    mount.appendChild(el);
  }

  /* ---------- Подтягиваем фото, загруженные через /admin.html ---------- */
  function loadRemotePhotos() {
    var sb = CONFIG.supabase;
    if (!sb || !sb.url || !sb.anonKey || typeof window.supabase === "undefined") {
      return Promise.resolve(false);
    }
    var client = window.supabase.createClient(sb.url, sb.anonKey);
    return client
      .from("photos")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(function (res) {
        if (!res.data || !res.data.length) return false;
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
        return true;
      })
      .catch(function (err) {
        console.warn("Не удалось загрузить фото из Supabase:", err);
        return false;
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
    // 1) Рисуем сайт СРАЗУ на запасных данных из data.js — без ожидания сети.
    renderHero();
    renderAbout();
    renderCases();
    renderGallery();
    initLightbox();
    initMobileMenu();
    initForm();

    // 2) Параллельно, в фоне, подтягиваем реальные фото из Supabase.
    //    Если что-то пришло — перерисовываем только затронутые блоки.
    loadRemotePhotos().then(function (updated) {
      if (!updated) return;
      renderHero();
      renderAbout();
      renderCases();
      renderGallery();
    });
  });
})();
