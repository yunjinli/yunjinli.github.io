// Interactive, tmux-style command prompt for the fetch-terminal widget on the about page.
// Windows (about/news/publications/repositories/...) are rendered inside a single
// pane, switched via typed commands, clicking the status bar, or ctrl+b <number>.
(function () {
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    var cmdBox = document.querySelector(".fetch-terminal__cmd");
    var pane = document.getElementById("fetch-terminal-pane");
    var input = document.getElementById("fetch-terminal-input");
    var ghost = document.getElementById("fetch-terminal-ghost");
    var list = document.getElementById("fetch-terminal-suggestions");
    var promptLine = document.getElementById("fetch-terminal-promptline");
    var dataEl = document.getElementById("fetch-terminal-commands");
    var tmuxBar = document.getElementById("fetch-terminal-tmuxbar");
    var titleEl = document.getElementById("fetch-terminal-title");
    var newContentTemplate = document.getElementById("fetch-terminal-new-content");
    var nextBtn = document.getElementById("fetch-terminal-next-btn");
    var newBtn = document.getElementById("fetch-terminal-new-btn");
    if (!cmdBox || !pane || !input || !ghost || !list || !promptLine || !dataEl || !tmuxBar) return;

    var COMMANDS = JSON.parse(dataEl.textContent);
    var WINDOWS = COMMANDS.filter(function (c) {
      return c.window;
    });

    // Snapshot of the "about" window's original, hand-authored lines (with its
    // charming slow boot-up animation baked into the page's CSS) so we can
    // restore it quickly later without replaying that multi-second intro.
    var aboutLines = Array.prototype.map.call(pane.children, function (el) {
      return el.innerHTML;
    });

    var currentWindow = "about";
    var activeIndex = -1;
    var prefixActive = false;
    var cache = {};

    function matches(value) {
      if (!value || value[0] !== "/") return [];
      var v = value.toLowerCase();
      return COMMANDS.filter(function (c) {
        return c.cmd.indexOf(v) === 0;
      });
    }

    function renderGhost() {
      var value = input.value;
      var m = matches(value);
      var best = m.filter(function (c) {
        return c.cmd !== value.toLowerCase();
      })[0];
      ghost.textContent = best ? value + best.cmd.slice(value.length) : "";
    }

    function setActive(index) {
      var items = list.children;
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle("is-active", i === index);
      }
      activeIndex = index;
    }

    function renderSuggestions() {
      var value = input.value;
      var m = matches(value);
      list.innerHTML = "";

      if (!value || !m.length) {
        list.hidden = true;
        activeIndex = -1;
        return;
      }

      m.forEach(function (c) {
        var li = document.createElement("li");
        li.className = "fetch-terminal__suggestion";
        li.innerHTML =
          '<span class="fetch-terminal__suggestion-cmd">' +
          escapeHtml(c.cmd) +
          '</span><span class="fetch-terminal__suggestion-desc">' +
          escapeHtml(c.desc) +
          "</span>";
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          run(c.cmd);
        });
        list.appendChild(li);
      });

      list.hidden = false;
      setActive(0);
    }

    function printLine(html) {
      var p = document.createElement("p");
      p.setAttribute("data-dynamic", "true");
      p.innerHTML = html;
      pane.appendChild(p);
    }

    // Same as printLine, but appends each line with a staggered fade-in so a
    // multi-line result (news/publications/projects text, /help, ...) streams
    // in one line at a time instead of popping in all at once.
    function printLinesStaggered(lines) {
      lines.forEach(function (html, i) {
        var p = document.createElement("p");
        p.className = "fetch-terminal__printed-line";
        p.setAttribute("data-dynamic", "true");
        p.style.animationDelay = i * 90 + "ms";
        p.innerHTML = html;
        pane.appendChild(p);
      });
    }

    function renderLines(lines) {
      pane.innerHTML = "";
      lines.forEach(function (html, i) {
        var p = document.createElement("p");
        p.className = "fetch-terminal__printed-line";
        p.style.animationDelay = i * 70 + "ms";
        p.innerHTML = html;
        pane.appendChild(p);
      });
    }

    function renderMessage(html) {
      // data-dynamic keeps this out of the old hand-authored "about" boot
      // sequence's slow, position-based CSS delays (it would otherwise land on
      // p:nth-child(1) and sit invisible for ~2s before its fade-in even starts).
      pane.innerHTML = '<p class="fetch-terminal__printed-line" data-dynamic="true">' + html + "</p>";
    }

    function buildNewsLines() {
      var container = document.getElementById("about-news");
      if (!container) return null;
      var rows = container.querySelectorAll("table tr");
      if (!rows.length) return null;

      return Array.prototype.map.call(rows, function (row) {
        var date = row.querySelector("th");
        var body = row.querySelector("td");
        var dateHtml = date ? '<span class="fetch-terminal__meta">' + escapeHtml(date.textContent.trim()) + "</span> " : "";
        return dateHtml + (body ? body.innerHTML.trim() : "");
      });
    }

    // Full-fidelity render for publications/projects: reuse the real
    // bibliography markup as-is (preview gifs, abstract/links buttons, badges)
    // instead of a stripped-down text summary, so it looks exactly like the
    // dedicated sub-page. Each entry still streams in with a quick stagger.
    function renderBibliography(containerId) {
      var container = document.getElementById(containerId);
      var list = container ? container.querySelector("ol.bibliography") : null;
      if (!list || !list.children.length) {
        renderMessage("nothing to show here yet.");
        return;
      }

      // Wrapped in the site's own ".publications" class (not just a custom one)
      // because all of the bibliography/title/author/links/abstract styling in
      // _base.scss is scoped under that ancestor selector.
      pane.innerHTML = '<div class="publications fetch-terminal__bibliography"><ol class="bibliography"></ol></div>';
      var target = pane.querySelector("ol.bibliography");
      Array.prototype.forEach.call(list.children, function (li, i) {
        var clone = li.cloneNode(true);
        clone.classList.add("fetch-terminal__printed-line");
        clone.style.animationDelay = i * 90 + "ms";
        target.appendChild(clone);
      });
    }

    // Plain-text summary (title/authors/venue, no images) — what typing
    // /publications or /projects prints inline. Clicking the matching status-bar
    // tab (or ctrl+b 2/3) instead opens the dedicated window with the full
    // rich preview (renderBibliography, above), so the reader picks the format.
    function buildBibliographyLines(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return null;
      var items = container.querySelectorAll("ol.bibliography > li");
      if (!items.length) return null;

      return Array.prototype.map.call(items, function (li) {
        var titleEl2 = li.querySelector(".title");
        var authorEl = li.querySelector(".author");
        var venueEl = li.querySelector(".periodical");
        // Project titles already link to their page. Paper titles don't, so
        // prefer the bib entry's own `html={...}` field (rendered as the
        // globe-icon "Project" button in _layouts/bib.liquid) — that's the
        // author-chosen canonical link, not just whichever button is first.
        var projectIcon = li.querySelector(".links i.fa-globe");
        var projectAnchor = projectIcon ? projectIcon.closest("a") : null;
        var linkEl = (titleEl2 && titleEl2.querySelector("a")) || projectAnchor || li.querySelector(".links a[href]");

        var titleText = (titleEl2 ? titleEl2.textContent : "").replace(/\s+/g, " ").trim();
        var titleHtml = linkEl
          ? '<a href="' + linkEl.getAttribute("href") + '" target="_blank" rel="noopener">' + escapeHtml(titleText) + "</a>"
          : escapeHtml(titleText);

        var meta = [];
        if (authorEl && authorEl.textContent.trim()) meta.push(authorEl.textContent.replace(/\s+/g, " ").trim());
        if (venueEl && venueEl.textContent.trim()) meta.push(venueEl.textContent.replace(/\s+/g, " ").trim());

        var line = '<span class="fetch-terminal__bullet">&raquo;</span> ' + titleHtml;
        if (meta.length) line += '<br><span class="fetch-terminal__meta">' + escapeHtml(meta.join(" · ")) + "</span>";
        return line;
      });
    }

    // /cv: embed Google Drive's own PDF viewer inline via its iframe-embeddable
    // /preview URL, plus a link out to the normal share link for a full-size view.
    function renderPreview(entry) {
      pane.innerHTML =
        '<div class="fetch-terminal__printed-line fetch-terminal__iframe-wrap">' +
        '<iframe src="' + entry.previewUrl + '" loading="lazy" allow="autoplay"></iframe>' +
        "</div>" +
        '<p class="fetch-terminal__printed-line fetch-terminal__printed-more" style="animation-delay:120ms">' +
        'open full view &rarr; <a href="' + entry.url + '" target="_blank" rel="noopener">' + entry.url + "</a>" +
        "</p>";
    }

    // ctrl+b c's blank "new" window: a fastfetch-style boot banner (figlet
    // title + ascii-art logo + joke system specs), authored once as a
    // <template> in the page so this file stays logic-only.
    function renderNewPane() {
      if (!newContentTemplate) {
        renderMessage("empty pane &mdash; nothing here yet.");
        return;
      }
      pane.innerHTML = "";
      pane.appendChild(newContentTemplate.content.cloneNode(true));
      Array.prototype.forEach.call(pane.querySelectorAll(".fetch-terminal__newinfo p"), function (p, i) {
        p.classList.add("fetch-terminal__printed-line");
        p.style.animationDelay = i * 90 + "ms";
      });
    }

    function fetchRepositories(entry, done) {
      if (cache.repositories) {
        done(cache.repositories);
        return;
      }
      renderMessage("loading repositories &hellip;");
      fetch(entry.fetchUrl)
        .then(function (res) {
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var article = doc.querySelector(".post article");
          var content = article ? article.innerHTML : "<p>could not load repositories.</p>";
          cache.repositories = content;
          done(content);
        })
        .catch(function () {
          renderMessage('failed to load repositories. <a href="' + entry.fetchUrl + '">open the page directly</a>.');
        });
    }

    function setTitle(win) {
      if (!titleEl) return;
      titleEl.textContent = win === "about" ? "jim@lsy-tum: ~" : "jim@lsy-tum: ~ (" + win + ")";
    }

    function highlightTab(win) {
      Array.prototype.forEach.call(tmuxBar.querySelectorAll(".fetch-terminal__tmuxwin"), function (el) {
        var isActive = el.getAttribute("data-window") === win;
        el.classList.toggle("is-active", isActive);
        el.textContent = el.textContent.replace(/\*$/, "") + (isActive ? "*" : "");
      });
    }

    function switchWindow(win) {
      var entry = WINDOWS.filter(function (w) {
        return w.window === win;
      })[0];
      if (!entry || win === currentWindow) return;

      currentWindow = win;
      highlightTab(win);
      setTitle(win);

      if (win === "about") {
        renderLines(aboutLines);
        return;
      }
      if (entry.print === "news") {
        var newsLines = buildNewsLines();
        newsLines && newsLines.length ? renderLines(newsLines) : renderMessage("nothing to show here yet.");
        return;
      }
      if (entry.print) {
        renderBibliography("about-" + entry.print);
        return;
      }
      if (win === "new") {
        renderNewPane();
        return;
      }
      if (entry.fetchUrl) {
        fetchRepositories(entry, function (html) {
          pane.innerHTML = html;
        });
      }
    }

    // ctrl+b n: cycle to the next window, wrapping around.
    function nextWindow() {
      var idx = -1;
      for (var i = 0; i < WINDOWS.length; i++) {
        if (WINDOWS[i].window === currentWindow) {
          idx = i;
          break;
        }
      }
      switchWindow(WINDOWS[(idx + 1) % WINDOWS.length].window);
    }

    // ctrl+b c: create one extra blank "new" window, tmux-style. Re-pressing
    // it just refocuses the existing one instead of creating another.
    function createNewWindow() {
      var existing = WINDOWS.filter(function (w) {
        return w.window === "new";
      })[0];
      if (existing) {
        switchWindow("new");
        return;
      }

      var entry = { cmd: "/new", window: "new", key: null, desc: "blank pane" };
      WINDOWS.push(entry);
      COMMANDS.push(entry);

      var tab = document.createElement("span");
      tab.className = "fetch-terminal__tmuxwin";
      tab.setAttribute("data-window", "new");
      tab.textContent = WINDOWS.length - 1 + ":new";
      tab.addEventListener("click", function () {
        switchWindow("new");
        input.focus();
      });
      // Insert before the spacer (i.e. right after the last window tab), not
      // at the very end — the sticky next/new buttons live after the spacer.
      var spacer = tmuxBar.querySelector(".fetch-terminal__tmuxbar-spacer");
      if (spacer) {
        tmuxBar.insertBefore(tab, spacer);
      } else {
        tmuxBar.appendChild(tab);
      }

      switchWindow("new");
    }

    function run(raw) {
      var value = raw.trim();
      list.hidden = true;
      ghost.textContent = "";
      input.value = "";
      if (!value) return;

      if (value.toLowerCase() === "/clear") {
        Array.prototype.forEach.call(pane.querySelectorAll("[data-dynamic]"), function (el) {
          el.remove();
        });
        return;
      }

      if (value.toLowerCase() === "/help") {
        var lines = COMMANDS.map(function (c) {
          var shortcut = c.key ? " (ctrl+b " + c.key + ")" : "";
          return escapeHtml(c.cmd) + shortcut + " &mdash; " + escapeHtml(c.desc);
        });
        lines.push("ctrl+b n &mdash; next window");
        lines.push("ctrl+b c &mdash; create a new blank window (only one allowed)");
        printLinesStaggered(lines);
        return;
      }

      var exact = COMMANDS.filter(function (c) {
        return c.cmd === value.toLowerCase();
      })[0];

      // Typing /news, /publications, /projects prints plain text right here —
      // it does NOT switch tabs. Use the status bar (or ctrl+b <number>) to open
      // the dedicated window with the full rich preview instead.
      if (exact && exact.text) {
        printLine('<span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>' + escapeHtml(value));
        var textLines = exact.text === "news" ? buildNewsLines() : buildBibliographyLines("about-" + exact.text);
        printLinesStaggered(textLines && textLines.length ? textLines : ["nothing to show here yet."]);
        return;
      }

      if (exact && exact.window) {
        switchWindow(exact.window);
        return;
      }

      if (exact && exact.previewUrl) {
        renderPreview(exact);
        return;
      }

      if (exact && exact.mailSubject) {
        printLine("drafting an email to " + escapeHtml(exact.mailTo) + " &hellip;");
        window.location.href = "mailto:" + exact.mailTo + "?subject=" + encodeURIComponent(exact.mailSubject);
        return;
      }

      if (exact && exact.url) {
        printLine("opening " + exact.cmd.slice(1) + " in a new tab &hellip;");
        window.open(exact.url, "_blank", "noopener");
        return;
      }

      // Setting these attributes/localStorage directly (rather than reloading
      // the page) is enough: every color on this page is already driven by the
      // html[data-theme] CSS variables, so the switch applies instantly.
      if (exact && exact.themeMode) {
        localStorage.setItem("theme", exact.themeMode);
        document.documentElement.setAttribute("data-theme-setting", exact.themeMode);
        document.documentElement.setAttribute("data-theme", exact.themeMode);
        printLine("switched to " + exact.themeMode + " mode.");
        return;
      }

      printLine("command not found: " + escapeHtml(value) + ". type /help to see available commands.");
    }

    Array.prototype.forEach.call(tmuxBar.querySelectorAll(".fetch-terminal__tmuxwin"), function (el) {
      el.addEventListener("click", function () {
        switchWindow(el.getAttribute("data-window"));
        input.focus();
      });
    });

    // Tappable equivalents of ctrl+b n / ctrl+b c, for phones and anyone else
    // without an easy ctrl+b (touch keyboards have no reliable ctrl key).
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        nextWindow();
        input.focus();
      });
    }
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        createNewWindow();
        input.focus();
      });
    }

    input.addEventListener("input", function () {
      renderGhost();
      renderSuggestions();
    });

    input.addEventListener("keydown", function (e) {
      if (prefixActive) {
        prefixActive = false;
        tmuxBar.classList.remove("is-prefix");

        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          nextWindow();
          return;
        }
        if (e.key.toLowerCase() === "c") {
          e.preventDefault();
          createNewWindow();
          return;
        }
        var found = WINDOWS.filter(function (w) {
          return w.key === e.key;
        })[0];
        if (found) {
          e.preventDefault();
          switchWindow(found.window);
          return;
        }
      }

      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        prefixActive = true;
        tmuxBar.classList.add("is-prefix");
        return;
      }

      if (e.key === "Tab") {
        if (ghost.textContent) {
          e.preventDefault();
          input.value = ghost.textContent;
          renderGhost();
          renderSuggestions();
        }
      } else if (e.key === "ArrowRight" || e.key === "End") {
        if (ghost.textContent && input.selectionStart === input.value.length) {
          input.value = ghost.textContent;
          renderGhost();
          renderSuggestions();
        }
      } else if (e.key === "ArrowDown") {
        if (!list.hidden) {
          e.preventDefault();
          setActive((activeIndex + 1) % list.children.length);
        }
      } else if (e.key === "ArrowUp") {
        if (!list.hidden) {
          e.preventDefault();
          setActive((activeIndex - 1 + list.children.length) % list.children.length);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!list.hidden && activeIndex >= 0 && list.children[activeIndex]) {
          run(list.children[activeIndex].querySelector(".fetch-terminal__suggestion-cmd").textContent);
        } else {
          run(input.value);
        }
      } else if (e.key === "Escape") {
        list.hidden = true;
        activeIndex = -1;
      }
    });

    cmdBox.addEventListener("click", function (e) {
      if (e.target.tagName !== "A") input.focus();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
