/* =========================================================================
   АЛЬФА-ХОЛОД — логика интерфейса
   -------------------------------------------------------------------------
   Без зависимостей. Каждый блок запускается только если на странице есть
   нужные элементы, поэтому один файл обслуживает все страницы.
   ========================================================================= */

(function () {
  "use strict";

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };

  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var nf = new Intl.NumberFormat("ru-RU");
  var money = function (value) {
    return nf.format(value) + " ₽";
  };
  var esc = function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  /* ---------- Шапка и мобильное меню ---------- */
  function initHeader() {
    var header = $("#siteHeader");
    if (!header) return;

    var burger = $("#burger");
    var nav = $("#primaryNav");

    var setScrolled = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 6);
    };
    setScrolled();
    window.addEventListener("scroll", setScrolled, { passive: true });

    if (!burger || !nav) return;

    var close = function () {
      header.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      burger.setAttribute("aria-expanded", "false");
    };

    burger.addEventListener("click", function () {
      var open = !header.classList.contains("is-open");
      header.classList.toggle("is-open", open);
      document.body.classList.toggle("is-locked", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) close();
    });
  }

  /* ---------- Появление блоков при скролле ---------- */
  var revealObserver = null;

  function initReveal(scope) {
    var items = $$("[data-reveal]", scope || document).filter(function (el) {
      return !el.classList.contains("is-visible");
    });
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
    }

    items.forEach(function (el, i) {
      if (!el.style.getPropertyValue("--reveal-delay")) {
        var delay = Math.min(i, 5) * 0.06;
        el.style.setProperty("--reveal-delay", delay + "s");
      }
      revealObserver.observe(el);
    });
  }

  /* ---------- Счётчики цифр ---------- */
  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    var run = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      if (isNaN(target)) return;

      if (reduceMotion) {
        el.textContent = nf.format(target) + suffix;
        return;
      }

      var duration = 1400;
      var start = null;

      var tick = function (ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = nf.format(Math.round(target * eased)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(run);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          run(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    nodes.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- Маска телефона ---------- */
  function initPhoneMasks() {
    $$('input[type="tel"]').forEach(function (input) {
      input.addEventListener("input", function () {
        var digits = input.value.replace(/\D/g, "");
        if (digits[0] === "8") digits = "7" + digits.slice(1);
        if (digits[0] !== "7") digits = "7" + digits;
        digits = digits.slice(0, 11);

        var out = "+7";
        if (digits.length > 1) out += " (" + digits.slice(1, 4);
        if (digits.length >= 5) out += ") " + digits.slice(4, 7);
        if (digits.length >= 8) out += "-" + digits.slice(7, 9);
        if (digits.length >= 10) out += "-" + digits.slice(9, 11);
        input.value = digits.length > 1 ? out : "+7 ";
      });

      input.addEventListener("focus", function () {
        if (!input.value) input.value = "+7 ";
      });

      input.addEventListener("blur", function () {
        if (input.value.replace(/\D/g, "").length <= 1) input.value = "";
      });
    });
  }

  /* ---------- Формы заявок ---------- */
  function initForms() {
    var endpoint =
      typeof FORM_ENDPOINT === "string" && FORM_ENDPOINT
        ? FORM_ENDPOINT
        : "send.php";

    var isFormSubmit = endpoint.indexOf("formsubmit.co") !== -1;
    var isWeb3Forms = endpoint.indexOf("web3forms.com") !== -1;

    $$("form[data-form]").forEach(function (form) {
      var status = $(".form-status", form);
      var submit = form.querySelector('[type="submit"]');
      var successHtml = status ? status.innerHTML : "";
      var defaultLabel = submit ? submit.innerHTML : "";
      var sending = false;

      form.setAttribute("action", endpoint);

      var showStatus = function (type, html) {
        if (!status) return;
        status.innerHTML = html;
        status.classList.add("is-visible");
        status.classList.toggle("form-status--error", type === "error");
        status.classList.toggle("form-status--info", type === "info");
        status.setAttribute("tabindex", "-1");
        status.focus({ preventScroll: true });
      };

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        if (sending) return;

        // Скрытое поле заполняют только боты: показываем успех и ничего не отправляем.
        var honey = form.querySelector('[name="_honey"]');
        if (honey && honey.value.trim()) {
          form.reset();
          showStatus("success", successHtml);
          return;
        }

        sending = true;

        if (submit) {
          submit.disabled = true;
          submit.textContent = "Отправляем…";
        }
        if (status) status.classList.remove("is-visible", "form-status--error");

        var data = new FormData(form);
        var source = form.getAttribute("data-form-name") || document.title;
        data.append("page", window.location.href);
        data.append("source", source);
        data.append("ajax", "1");

        if (isFormSubmit) {
          data.append("_subject", "Заявка с сайта — " + source);
          data.append("_template", "table");
          data.append("_captcha", "false");

          var visitorEmail = form.querySelector('[name="email"]');
          if (visitorEmail && visitorEmail.value.trim()) {
            data.append("_replyto", visitorEmail.value.trim());
          }
        }

        if (isWeb3Forms) {
          if (
            typeof WEB3FORMS_KEY === "string" &&
            WEB3FORMS_KEY &&
            !data.has("access_key")
          ) {
            data.append("access_key", WEB3FORMS_KEY);
          }
          data.append("subject", "Заявка с сайта — " + source);
          data.append("from_name", "Сайт Альфа-Холод");
          data.append("botcheck", "");
        }

        var controller =
          "AbortController" in window ? new AbortController() : null;
        var timer = controller
          ? window.setTimeout(
              function () {
                controller.abort();
              },
              isFormSubmit ? 120000 : 25000
            )
          : null;

        // FormSubmit иногда отвечает около минуты: показываем, что идёт работа.
        var hint =
          isFormSubmit && status
            ? window.setTimeout(function () {
                showStatus(
                  "info",
                  "Отправляем заявку… Иногда это занимает до минуты, не закрывайте страницу."
                );
              }, 6000)
            : null;

        fetch(endpoint, {
          method: "POST",
          body: data,
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest"
          },
          signal: controller ? controller.signal : undefined
        })
          .then(function (response) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (json) {
                return { response: response, json: json };
              });
          })
          .then(function (result) {
            var json = result.json || {};
            var ok =
              result.response.ok &&
              (json.ok === true ||
                json.success === true ||
                json.success === "true");

            if (!ok) {
              if (json.message) {
                console.warn("FormSubmit:", json.message);
              }
              throw new Error("send_failed");
            }

            form.reset();
            showStatus("success", successHtml);
          })
          .catch(function () {
            var phone =
              typeof COMPANY !== "undefined" && COMPANY.phone
                ? COMPANY.phone
                : "+7 (928) 433-25-80";
            var phoneHref =
              typeof COMPANY !== "undefined" && COMPANY.phoneHref
                ? COMPANY.phoneHref
                : "tel:+79284332580";
            var email =
              typeof COMPANY !== "undefined" && COMPANY.email
                ? COMPANY.email
                : "kozimirovdima23@gmail.com";

            // Письмо-дубль: даже если сервис недоступен, заявку можно отправить.
            var lines = [];
            var labels = {
              name: "Имя",
              phone: "Телефон",
              email: "Почта",
              city: "Город",
              object: "Тип объекта",
              volume: "Объём камеры",
              temp: "Температурный режим",
              task: "Задача",
              comment: "Комментарий",
              product: "Товар",
              source: "Форма",
              page: "Страница"
            };

            data.forEach(function (value, key) {
              if (typeof value !== "string" || !value) return;
              if (key.charAt(0) === "_" || key === "ajax") return;
              if (key === "consent" || key === "consent_required") return;
              lines.push((labels[key] || key) + ": " + value);
            });

            var mailto =
              "mailto:" +
              email +
              "?subject=" +
              encodeURIComponent("Заявка с сайта Альфа-Холод") +
              "&body=" +
              encodeURIComponent(
                lines.length
                  ? "Заявка с сайта Альфа-Холод\n\n" + lines.join("\n")
                  : "Заявка с сайта Альфа-Холод"
              );

            showStatus(
              "error",
              "Не удалось отправить заявку. Позвоните <a href=\"" +
                phoneHref +
                "\">" +
                phone +
                "</a> или <a href=\"" +
                mailto +
                "\">отправьте её письмом</a> — текст заявки уже подставлен."
            );
          })
          .then(function () {
            sending = false;
            if (timer) window.clearTimeout(timer);
            if (hint) window.clearTimeout(hint);
            if (submit) {
              submit.disabled = false;
              submit.innerHTML = defaultLabel;
            }
          });
      });
    });
  }

  /* ---------- Аккордеон FAQ: закрываем соседние ---------- */
  function initFaq() {
    $$(".faq").forEach(function (group) {
      var items = $$("details", group);
      items.forEach(function (item) {
        item.addEventListener("toggle", function () {
          if (!item.open) return;
          items.forEach(function (other) {
            if (other !== item) other.open = false;
          });
        });
      });
    });
  }

  /* ---------- Табы ---------- */
  function initTabs(scope) {
    $$("[data-tabs]", scope || document).forEach(function (root) {
      var buttons = $$("[data-tab]", root);
      var panels = $$("[data-panel]", root);
      if (!buttons.length) return;

      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-tab");
          buttons.forEach(function (b) {
            var active = b === btn;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-selected", active ? "true" : "false");
          });
          panels.forEach(function (panel) {
            panel.classList.toggle("is-active", panel.getAttribute("data-panel") === id);
          });
        });
      });
    });
  }

  /* ---------- Год в футере ---------- */
  function initYear() {
    $$("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* =======================================================================
     КАТАЛОГ
     ======================================================================= */
  function initCatalog() {
    var grid = $("#catalogGrid");
    if (!grid || typeof PRODUCTS === "undefined") return;

    var state = {
      cats: [],
      temps: [],
      comps: [],
      min: null,
      max: null,
      q: "",
      sort: "popular",
      limit: 9
    };

    var catsBox = $("#filterCats");
    var tempsBox = $("#filterTemps");
    var compsBox = $("#filterComps");
    var priceMin = $("#priceMin");
    var priceMax = $("#priceMax");
    var search = $("#catalogSearch");
    var sort = $("#catalogSort");
    var chips = $("#catalogChips");
    var count = $("#catalogCount");
    var empty = $("#catalogEmpty");
    var more = $("#catalogMore");
    var resetBtns = $$("[data-filters-reset]");
    var filters = $("#filters");

    var catName = function (id) {
      var found = CATEGORIES.filter(function (c) {
        return c.id === id;
      })[0];
      return found ? found.name : id;
    };

    var catImage = function (id) {
      var found = CATEGORIES.filter(function (c) {
        return c.id === id;
      })[0];
      return found ? found.image : "assets/img/monoblock.svg";
    };

    /* — построение фильтров — */
    if (catsBox) {
      catsBox.innerHTML = CATEGORIES.map(function (c) {
        var total = PRODUCTS.filter(function (p) {
          return p.category === c.id;
        }).length;
        return (
          '<li><label class="check"><input type="checkbox" value="' +
          c.id +
          '" data-filter="cat"><span>' +
          esc(c.name) +
          ' <span class="muted">(' +
          total +
          ")</span></span></label></li>"
        );
      }).join("");
    }

    if (tempsBox) {
      tempsBox.innerHTML = TEMP_GROUPS.map(function (t) {
        return (
          '<li><label class="check"><input type="checkbox" value="' +
          t.id +
          '" data-filter="temp"><span>' +
          esc(t.name) +
          "</span></label></li>"
        );
      }).join("");
    }

    if (compsBox) {
      var comps = [];
      PRODUCTS.forEach(function (p) {
        if (comps.indexOf(p.compressor) === -1) comps.push(p.compressor);
      });
      compsBox.innerHTML = comps
        .map(function (c) {
          return (
            '<li><label class="check"><input type="checkbox" value="' +
            esc(c) +
            '" data-filter="comp"><span>' +
            esc(c) +
            "</span></label></li>"
          );
        })
        .join("");
    }

    /* — чтение состояния — */
    var readFilters = function () {
      state.cats = $$('[data-filter="cat"]:checked').map(function (i) {
        return i.value;
      });
      state.temps = $$('[data-filter="temp"]:checked').map(function (i) {
        return i.value;
      });
      state.comps = $$('[data-filter="comp"]:checked').map(function (i) {
        return i.value;
      });
      state.min = priceMin && priceMin.value ? parseInt(priceMin.value, 10) : null;
      state.max = priceMax && priceMax.value ? parseInt(priceMax.value, 10) : null;
    };

    /* — фильтрация — */
    var filtered = function () {
      var q = state.q.trim().toLowerCase();
      var list = PRODUCTS.filter(function (p) {
        if (state.cats.length && state.cats.indexOf(p.category) === -1) return false;
        if (state.temps.length && state.temps.indexOf(p.tempGroup) === -1) return false;
        if (state.comps.length && state.comps.indexOf(p.compressor) === -1) return false;
        if (state.min != null && p.price < state.min) return false;
        if (state.max != null && p.price > state.max) return false;
        if (q) {
          var hay = (p.name + " " + p.short + " " + catName(p.category) + " " + p.capacity).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      list.sort(function (a, b) {
        if (state.sort === "price-asc") return a.price - b.price;
        if (state.sort === "price-desc") return b.price - a.price;
        if (state.sort === "name") return a.name.localeCompare(b.name, "ru");
        return (b.popular || 0) - (a.popular || 0);
      });

      return list;
    };

    /* — карточка — */
    var cardHtml = function (p) {
      return (
        '<article class="product-card">' +
        '<div class="product-card__media">' +
        (p.badge
          ? '<span class="product-card__badge' +
            (p.badgeStyle === "ice" ? " product-card__badge--ice" : "") +
            '">' +
            esc(p.badge) +
            "</span>"
          : "") +
        '<img src="' +
        catImage(p.category) +
        '" alt="' +
        esc(p.name) +
        '" loading="lazy" width="480" height="360">' +
        "</div>" +
        '<div class="product-card__body">' +
        '<div class="product-card__cat">' +
        esc(catName(p.category)) +
        "</div>" +
        '<h3 class="product-card__title"><a href="product.html?id=' +
        encodeURIComponent(p.id) +
        '">' +
        esc(p.name) +
        "</a></h3>" +
        '<div class="product-card__specs">' +
        '<span class="tag tag--ice">' +
        esc(p.temp) +
        "</span>" +
        '<span class="tag">' +
        esc(p.capacity) +
        "</span>" +
        '<span class="tag">' +
        esc(p.volume) +
        "</span>" +
        "</div>" +
        '<div class="product-card__foot">' +
        '<div class="price"><small>Цена от</small><b>' +
        money(p.price) +
        "</b></div>" +
        '<a class="product-card__arrow" href="product.html?id=' +
        encodeURIComponent(p.id) +
        '" aria-label="Подробнее: ' +
        esc(p.name) +
        '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
        "</div>" +
        "</div>" +
        "</article>"
      );
    };

    /* — чипы активных фильтров — */
    var renderChips = function () {
      if (!chips) return;
      var items = [];

      state.cats.forEach(function (id) {
        items.push({ type: "cat", value: id, label: catName(id) });
      });
      state.temps.forEach(function (id) {
        var t = TEMP_GROUPS.filter(function (x) {
          return x.id === id;
        })[0];
        items.push({ type: "temp", value: id, label: t ? t.name : id });
      });
      state.comps.forEach(function (v) {
        items.push({ type: "comp", value: v, label: v });
      });
      if (state.min != null) items.push({ type: "min", value: state.min, label: "от " + money(state.min) });
      if (state.max != null) items.push({ type: "max", value: state.max, label: "до " + money(state.max) });
      if (state.q) items.push({ type: "q", value: state.q, label: "«" + state.q + "»" });

      chips.innerHTML = items
        .map(function (i) {
          return (
            '<span class="chip">' +
            esc(i.label) +
            '<button type="button" data-chip="' +
            i.type +
            '" data-value="' +
            esc(i.value) +
            '" aria-label="Убрать фильтр: ' +
            esc(i.label) +
            '">×</button></span>'
          );
        })
        .join("");
    };

    /* — отрисовка — */
    var render = function () {
      readFilters();
      var list = filtered();
      var shown = list.slice(0, state.limit);

      grid.innerHTML = shown.map(cardHtml).join("");
      if (count) {
        count.textContent =
          list.length === 0
            ? "Ничего не найдено"
            : "Найдено: " + list.length + " " + plural(list.length, ["товар", "товара", "товаров"]);
      }
      if (empty) empty.classList.toggle("is-visible", list.length === 0);
      if (more) {
        more.hidden = list.length <= state.limit;
        var btn = $("button", more);
        if (btn) btn.textContent = "Показать ещё " + Math.min(9, Math.max(list.length - state.limit, 0));
      }
      renderChips();
    };

    var plural = function (n, forms) {
      var mod10 = n % 10;
      var mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return forms[0];
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
      return forms[2];
    };

    /* — события — */
    document.addEventListener("change", function (e) {
      if (e.target.matches("[data-filter]")) {
        state.limit = 9;
        render();
      }
    });

    if (priceMin) priceMin.addEventListener("input", debounce(function () {
      state.limit = 9;
      render();
    }, 350));
    if (priceMax) priceMax.addEventListener("input", debounce(function () {
      state.limit = 9;
      render();
    }, 350));

    if (search) {
      search.addEventListener("input", debounce(function () {
        state.q = search.value;
        state.limit = 9;
        render();
      }, 250));
    }

    if (sort) {
      sort.addEventListener("change", function () {
        state.sort = sort.value;
        render();
      });
    }

    if (more) {
      more.addEventListener("click", function () {
        state.limit += 9;
        render();
      });
    }

    if (chips) {
      chips.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-chip]");
        if (!btn) return;
        var type = btn.getAttribute("data-chip");
        var value = btn.getAttribute("data-value");

        if (type === "cat" || type === "temp" || type === "comp") {
          var input = $('[data-filter="' + type + '"][value="' + value + '"]');
          if (input) input.checked = false;
        }
        if (type === "min" && priceMin) priceMin.value = "";
        if (type === "max" && priceMax) priceMax.value = "";
        if (type === "q" && search) {
          search.value = "";
          state.q = "";
        }
        state.limit = 9;
        render();
      });
    }

    resetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$("[data-filter]").forEach(function (i) {
          i.checked = false;
        });
        if (priceMin) priceMin.value = "";
        if (priceMax) priceMax.value = "";
        if (search) search.value = "";
        if (sort) sort.value = "popular";
        state = { cats: [], temps: [], comps: [], min: null, max: null, q: "", sort: "popular", limit: 9 };
        render();
      });
    });

    var toggle = $("#filtersToggle");
    if (toggle && filters) {
      toggle.addEventListener("click", function () {
        filters.classList.toggle("is-open");
        toggle.setAttribute(
          "aria-expanded",
          filters.classList.contains("is-open") ? "true" : "false"
        );
      });
    }

    /* — предвыбор категории из URL — */
    var params = new URLSearchParams(window.location.search);
    var preselect = params.get("cat");
    if (preselect) {
      var cb = $('[data-filter="cat"][value="' + preselect + '"]');
      if (cb) cb.checked = true;
    }

    /* — диапазон цен по данным — */
    var prices = PRODUCTS.map(function (p) {
      return p.price;
    });
    if (priceMin) priceMin.placeholder = nf.format(Math.min.apply(null, prices));
    if (priceMax) priceMax.placeholder = nf.format(Math.max.apply(null, prices));

    render();
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  /* =======================================================================
     КАРТОЧКА ТОВАРА
     ======================================================================= */
  function initProductPage() {
    var root = $("#productPage");
    if (!root || typeof PRODUCTS === "undefined") return;

    var id = new URLSearchParams(window.location.search).get("id");
    var product =
      PRODUCTS.filter(function (p) {
        return p.id === id;
      })[0] || PRODUCTS[0];

    var category = CATEGORIES.filter(function (c) {
      return c.id === product.category;
    })[0] || CATEGORIES[0];

    var related = PRODUCTS.filter(function (p) {
      return p.id !== product.id && p.category === product.category;
    });
    if (related.length < 3) {
      PRODUCTS.forEach(function (p) {
        if (related.length >= 3) return;
        if (p.id !== product.id && related.indexOf(p) === -1) related.push(p);
      });
    }
    related = related.slice(0, 3);

    var views = [
      { src: category.image, label: "Общий вид" },
      { src: "assets/img/spec-schema.svg", label: "Схема подключения" },
      { src: "assets/img/spec-dims.svg", label: "Габаритный чертёж" }
    ];

    document.title = product.name + " — купить в Альфа-Холод";
    var desc = $('meta[name="description"]');
    if (desc) desc.setAttribute("content", product.short);

    root.innerHTML =
      '<div class="product-layout">' +
      '<div class="product-gallery">' +
      '<div class="product-gallery__main">' +
      (product.badge
        ? '<span class="product-card__badge' +
          (product.badgeStyle === "ice" ? " product-card__badge--ice" : "") +
          '">' +
          esc(product.badge) +
          "</span>"
        : "") +
      '<img id="productMainImage" src="' +
      views[0].src +
      '" alt="' +
      esc(product.name) +
      '" width="480" height="360">' +
      "</div>" +
      '<div class="product-gallery__thumbs" role="group" aria-label="Виды изделия">' +
      views
        .map(function (v, i) {
          return (
            '<button type="button" class="' +
            (i === 0 ? "is-active" : "") +
            '" data-view="' +
            v.src +
            '" aria-label="' +
            v.label +
            '"><img src="' +
            v.src +
            '" alt="" width="120" height="120" loading="lazy"></button>'
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      '<div class="product-info">' +
      '<div class="product-info__cat">' +
      esc(category.name) +
      "</div>" +
      "<h1>" +
      esc(product.name) +
      "</h1>" +
      '<p class="product-info__short">' +
      esc(product.short) +
      "</p>" +
      '<div class="product-buy">' +
      '<div class="product-buy__price"><b>' +
      money(product.price) +
      "</b><span>с НДС, за " +
      esc(product.unit) +
      "</span></div>" +
      '<div class="form-note">Цена базовой комплектации. Итоговая стоимость зависит от объёма камеры, длины трассы и монтажа — рассчитаем в КП.</div>' +
      '<div class="product-buy__actions">' +
      '<a class="btn btn--accent btn--block" href="contacts.html?product=' +
      encodeURIComponent(product.name) +
      '#request">Запросить КП</a>' +
      '<a class="btn btn--outline" href="tel:+79284332580">Позвонить</a>' +
      "</div>" +
      '<ul class="product-buy__meta">' +
      '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Наличие на складе в Ейске</li>' +
      '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Отгрузка 1–3 рабочих дня</li>' +
      '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Гарантия и сервис по всей России</li>' +
      "</ul>" +
      "</div>" +
      '<div class="product-facts">' +
      '<div><small>Температурный режим</small><b>' +
      esc(product.temp) +
      "</b></div>" +
      '<div><small>Холодопроизводительность</small><b>' +
      esc(product.capacity) +
      "</b></div>" +
      '<div><small>Объём / расход</small><b>' +
      esc(product.volume) +
      "</b></div>" +
      '<div><small>Компрессор</small><b>' +
      esc(product.compressor) +
      "</b></div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      /* табы */
      '<div class="tabs" data-tabs>' +
      '<div class="tabs__nav" role="tablist">' +
      '<button type="button" class="is-active" role="tab" aria-selected="true" data-tab="specs">Характеристики</button>' +
      '<button type="button" role="tab" aria-selected="false" data-tab="desc">Описание</button>' +
      '<button type="button" role="tab" aria-selected="false" data-tab="delivery">Доставка и оплата</button>' +
      '<button type="button" role="tab" aria-selected="false" data-tab="warranty">Гарантия</button>' +
      "</div>" +
      '<div class="tabs__panel is-active" data-panel="specs">' +
      '<table class="spec-table"><tbody>' +
      product.specs
        .map(function (row) {
          return "<tr><th>" + esc(row[0]) + "</th><td>" + esc(row[1]) + "</td></tr>";
        })
        .join("") +
      "</tbody></table>" +
      "</div>" +
      '<div class="tabs__panel" data-panel="desc">' +
      '<div class="prose"><p>' +
      esc(product.short) +
      "</p><ul>" +
      product.features
        .map(function (f) {
          return "<li>" + esc(f) + "</li>";
        })
        .join("") +
      "</ul></div>" +
      "</div>" +
      '<div class="tabs__panel" data-panel="delivery">' +
      '<div class="prose"><p>Доставка по Ейску и Краснодарскому краю — от 3 500 ₽, по России — транспортными компаниями. Отгрузка со склада в течение 1–3 рабочих дней после оплаты.</p><ul><li>Самовывоз со склада: г. Ейск, ул. Коммунистическая, д. 71</li><li>Оплата: безналичный расчёт, счёт для юрлиц и ИП</li><li>Подъём и занос оборудования — по согласованию</li><li>Монтаж и пусконаладка — отдельной услугой или «под ключ»</li></ul></div>' +
      "</div>" +
      '<div class="tabs__panel" data-panel="warranty">' +
      '<div class="prose"><p>Гарантия производителя — 24–36 месяцев в зависимости от модели. Гарантия не распространяется на механические повреждения и самостоятельное вмешательство в холодильный контур.</p><ul><li>Выезд сервисного инженера по Ейску и краю — в течение 24 часов</li><li>Регламентное ТО — 2 раза в год по договору</li><li>Подменное оборудование на время ремонта — по запросу</li></ul></div>' +
      "</div>" +
      "</div>" +
      /* похожие */
      '<section class="section section--tight" style="padding-bottom:0">' +
      '<div class="section-head"><div class="section-head__text"><h2>Похожее оборудование</h2></div><a class="link-arrow" href="catalog.html">Весь каталог<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>' +
      '<div class="catalog-grid">' +
      related.map(cardHtmlShared).join("") +
      "</div>" +
      "</section>";

    // хлебные крошки
    var crumbCat = $("#crumbCategory");
    if (crumbCat) {
      crumbCat.innerHTML =
        '<a href="catalog.html?cat=' + category.id + '">' + esc(category.name) + "</a>";
    }
    var crumbName = $("#crumbName");
    if (crumbName) crumbName.textContent = product.name;

    // галерея
    $$(".product-gallery__thumbs button", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".product-gallery__thumbs button", root).forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        var img = $("#productMainImage", root);
        if (img) img.src = btn.getAttribute("data-view");
      });
    });

    initTabs(root);
    initReveal(root);
  }

  function cardHtmlShared(p) {
    var category = CATEGORIES.filter(function (c) {
      return c.id === p.category;
    })[0];
    var img = category ? category.image : "assets/img/monoblock.svg";
    return (
      '<article class="product-card">' +
      '<div class="product-card__media"><img src="' +
      img +
      '" alt="' +
      esc(p.name) +
      '" loading="lazy" width="480" height="360"></div>' +
      '<div class="product-card__body">' +
      '<div class="product-card__cat">' +
      esc(category ? category.name : "") +
      "</div>" +
      '<h3 class="product-card__title"><a href="product.html?id=' +
      encodeURIComponent(p.id) +
      '">' +
      esc(p.name) +
      "</a></h3>" +
      '<div class="product-card__specs"><span class="tag tag--ice">' +
      esc(p.temp) +
      '</span><span class="tag">' +
      esc(p.capacity) +
      "</span></div>" +
      '<div class="product-card__foot"><div class="price"><small>Цена от</small><b>' +
      money(p.price) +
      '</b></div><a class="product-card__arrow" href="product.html?id=' +
      encodeURIComponent(p.id) +
      '" aria-label="Подробнее: ' +
      esc(p.name) +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>' +
      "</div></article>"
    );
  }

  /* ---------- Подстановка товара в форму на странице контактов ---------- */
  function initRequestPrefill() {
    var params = new URLSearchParams(window.location.search);
    var name = params.get("product");
    var comment = $("#requestComment");
    if (name && comment) {
      comment.value = "Интересует: " + name + ". Прошу рассчитать стоимость и сроки.";
    }
  }

  /* ---------- Плавный скролл к якорю (для кнопок) ---------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href || href === "#") return;
      a.addEventListener("click", function (e) {
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        if (target.hasAttribute("tabindex")) target.focus({ preventScroll: true });
      });
    });
  }

  /* ---------- Старт ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initReveal();
    initCounters();
    initPhoneMasks();
    initForms();
    initFaq();
    initCatalog();
    initProductPage();
    initRequestPrefill();
    initYear();
    initAnchors();
  });
})();
