(function () {
  "use strict";

  var root = document.documentElement;
  var header = document.querySelector(".site-header");

  // Header state on scroll
  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var toggle = document.getElementById("menuToggle");
  if (toggle) {
    function setMenu(open) {
      root.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
      document.body.style.overflow = open ? "hidden" : "";
    }
    toggle.addEventListener("click", function () {
      setMenu(!root.classList.contains("menu-open"));
    });
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  }

  // Reveal on scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Hero readiness card: bars + counter
  var visual = document.querySelector(".hero-visual");
  if (visual) {
    setTimeout(function () {
      visual.querySelectorAll(".hv-fill").forEach(function (bar) {
        bar.style.width = bar.dataset.w + "%";
      });
      var counter = visual.querySelector("[data-count]");
      var target = Number(counter.dataset.count);
      var start = null;
      function tick(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / 1600, 1);
        counter.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, 500);
  }

  // Service tabs
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.focus(); selectTab(next); }
    });
  });

  // Format buttons preselect the matching topic in the form
  document.querySelectorAll("[data-topic]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = document.querySelector('.topics input[value="' + btn.dataset.topic + '"]');
      if (box) box.checked = true;
    });
  });

  // Active nav link
  var links = document.querySelectorAll('.nav a[href^="#"]:not(.btn)');
  var sections = Array.prototype.map.call(links, function (a) {
    return document.querySelector(a.getAttribute("href"));
  });
  if ("IntersectionObserver" in window) {
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a, i) { a.classList.toggle("active", sections[i] === entry.target); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { if (s) navIo.observe(s); });
  }

  // Contact form -> /api/contact
  var form = document.getElementById("contactForm");
  if (form) {
    var status = document.getElementById("formStatus");
    var submit = form.querySelector('button[type="submit"]');
    var fallback = ' Bitte schreiben Sie direkt an <a href="mailto:michael@wagner-consult.net">michael@wagner-consult.net</a> oder rufen Sie an: <a href="tel:+491705599111">+49 170 5599111</a>.';

    function setStatus(text, kind) {
      status.className = "form-status" + (kind ? " is-" + kind : "");
      status.innerHTML = text;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.querySelectorAll(".has-error").forEach(function (el) { el.classList.remove("has-error"); });
      var invalid = Array.prototype.filter.call(form.querySelectorAll("[required]"), function (el) { return !el.checkValidity(); });
      if (invalid.length) {
        invalid.forEach(function (el) { var f = el.closest(".field"); if (f) f.classList.add("has-error"); });
        setStatus("Bitte füllen Sie alle Pflichtfelder aus und bestätigen Sie den Datenschutzhinweis.", "error");
        invalid[0].focus();
        return;
      }

      var data = {
        name: form.name.value,
        company: form.unternehmen.value,
        email: form.email.value,
        phone: form.telefon.value,
        message: form.nachricht.value,
        topics: Array.prototype.map.call(form.querySelectorAll('input[name="thema"]:checked'), function (b) { return b.value; }),
        consent: form.datenschutz.checked,
        website: form.website.value
      };

      submit.disabled = true;
      setStatus("Wird gesendet …");
      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok && body.ok }; }); })
        .then(function (r) {
          if (r.ok) {
            window.location.href = "danke.html";
          } else {
            setStatus("Ihre Nachricht konnte leider nicht übermittelt werden." + fallback, "error");
            submit.disabled = false;
          }
        })
        .catch(function () {
          setStatus("Keine Verbindung zum Server." + fallback, "error");
          submit.disabled = false;
        });
    });
  }

  // AI chat widget -> /api/chat (only shown when the assistant is configured)
  var chat = document.getElementById("chat");
  if (chat && window.fetch) {
    fetch("/api/chat")
      .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
      .then(function (d) { if (d.enabled) initChat(); })
      .catch(function () {});
  }

  function initChat() {
    var fab = document.getElementById("chatFab");
    var panel = document.getElementById("chatPanel");
    var closeBtn = document.getElementById("chatClose");
    var messages = document.getElementById("chatMessages");
    var chatForm = document.getElementById("chatForm");
    var input = document.getElementById("chatInput");
    var history = [];
    var greeted = false;

    chat.hidden = false;

    function addMessage(role, text) {
      var div = document.createElement("div");
      div.className = "chat-msg chat-msg--" + role;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return div;
    }

    function setOpen(open) {
      panel.hidden = !open;
      fab.setAttribute("aria-expanded", String(open));
      if (open) {
        if (!greeted) {
          greeted = true;
          addMessage("bot", "Guten Tag! Ich bin der KI-Assistent von Wagner Consult. Wobei kann ich Ihnen helfen – KI-Strategie, Prozesse oder IT-Sourcing?");
        }
        input.focus();
      }
    }

    fab.addEventListener("click", function () { setOpen(panel.hidden); });
    closeBtn.addEventListener("click", function () { setOpen(false); fab.focus(); });

    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      addMessage("user", text);
      history.push({ role: "user", content: text });
      input.value = "";

      var typing = addMessage("bot", "");
      typing.classList.add("chat-msg--typing");
      typing.innerHTML = "<span></span><span></span><span></span>";

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history })
      })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .then(function (r) {
          typing.remove();
          if (r.ok && r.d.reply) {
            addMessage("bot", r.d.reply);
            history.push({ role: "assistant", content: r.d.reply });
          } else {
            history.pop();
            addMessage("bot", "Entschuldigung, gerade gibt es ein technisches Problem. Nutzen Sie gern das Kontaktformular oder rufen Sie an: +49 170 5599111.");
          }
        })
        .catch(function () {
          typing.remove();
          history.pop();
          addMessage("bot", "Keine Verbindung. Bitte versuchen Sie es später erneut oder nutzen Sie das Kontaktformular.");
        });
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
