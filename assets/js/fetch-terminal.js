// Interactive, tmux-style command prompt for the fetch-terminal widget on the about page.
// Windows (about/news/publications/projects/...) are rendered inside a single
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

    // Captured live (see switchWindow) every time the reader leaves "about",
    // so coming back restores whatever was actually there a moment ago —
    // including any /news, /publications, ... output typed into it — rather
    // than resetting to the pristine boot-time bio and losing that history.
    var aboutSnapshot = null;

    var currentWindow = "about";
    var activeIndex = -1;
    var prefixActive = false;
    var cache = {};
    // Flips true the moment a real person does anything with the terminal —
    // used to bail out of the auto-demo (below) the instant someone doesn't
    // just want to watch it type by itself.
    var userInteracted = false;

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

    // The pane no longer scrolls internally (it just grows with its content),
    // so "keep the new output visible" means scrolling the page itself.
    // Appending a line brings the prompt (right after the new output) into
    // view, like a real terminal following its own output; switching to a
    // fresh window scrolls the terminal box's top back into view instead.
    function scrollPaneTop() {
      var windowBox = document.getElementById("fetch-terminal-window");
      if (windowBox) windowBox.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function scrollPaneBottom() {
      // The tmux bar (not the prompt line) is the terminal's true bottom edge —
      // scrolling that into view brings the whole box, prompt included, into frame.
      tmuxBar.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    function printLine(html) {
      var p = document.createElement("p");
      p.setAttribute("data-dynamic", "true");
      p.innerHTML = html;
      pane.appendChild(p);
      scrollPaneBottom();
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
      scrollPaneBottom();
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
      scrollPaneTop();
    }

    // Switching back to "about" should show the finished state instantly —
    // the text was already there a moment ago, so replaying the multi-second
    // boot animation (typewriter included) every time would be wrong. Only
    // the very first render (the actual page load) gets that treatment.
    // Forces every line (and the typed span) to its finished, settled state —
    // used right before snapshotting "about" so leaving mid-animation never
    // freezes a half-typed/half-faded frame into the saved snapshot.
    function freezeAboutPane() {
      Array.prototype.forEach.call(pane.children, function (child) {
        child.style.opacity = "1";
        child.style.animation = "none";
      });
      var typed = pane.querySelector(".fetch-terminal__typed");
      if (typed) {
        typed.style.width = "15ch";
        typed.style.borderRightColor = "transparent";
      }
    }

    function restoreAboutSnapshot() {
      if (aboutSnapshot !== null) pane.innerHTML = aboutSnapshot;
      scrollPaneTop();
    }

    function renderMessage(html) {
      // data-dynamic keeps this out of the old hand-authored "about" boot
      // sequence's slow, position-based CSS delays (it would otherwise land on
      // p:nth-child(1) and sit invisible for ~2s before its fade-in even starts).
      pane.innerHTML = '<p class="fetch-terminal__printed-line" data-dynamic="true">' + html + "</p>";
      scrollPaneTop();
    }

    // containerId picks the source: "about-news" (short, limited to
    // site.announcements.limit — used by typed /news) or "about-news-full"
    // (every item — used by the 1:news window/tab).
    function buildNewsLines(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return null;
      var rows = container.querySelectorAll("table tr");
      if (!rows.length) return null;

      return Array.prototype.map.call(rows, function (row) {
        var date = row.querySelector("th");
        var body = row.querySelector("td");
        var dateText = date ? escapeHtml(date.textContent.trim()) : "";
        var bodyHtml = body ? body.innerHTML.trim() : "";
        return (
          '<span class="fetch-terminal__newsrow">' +
          '<span class="fetch-terminal__meta fetch-terminal__newsdate">' + dateText + "</span>" +
          '<span class="fetch-terminal__newsevent">' + bodyHtml + "</span>" +
          "</span>"
        );
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
      scrollPaneTop();
    }

    // Same rich content as renderBibliography, but appended (like every other
    // typed command's output) instead of replacing the pane — so typing
    // /publications keeps whatever was already printed above it.
    function appendBibliography(containerId) {
      var container = document.getElementById(containerId);
      var list = container ? container.querySelector("ol.bibliography") : null;
      if (!list || !list.children.length) {
        printLine("nothing to show here yet.");
        return;
      }

      var wrap = document.createElement("div");
      wrap.className = "publications fetch-terminal__bibliography";
      wrap.setAttribute("data-dynamic", "true");
      var ol = document.createElement("ol");
      ol.className = "bibliography";
      wrap.appendChild(ol);
      Array.prototype.forEach.call(list.children, function (li, i) {
        var clone = li.cloneNode(true);
        clone.classList.add("fetch-terminal__printed-line");
        clone.style.animationDelay = i * 90 + "ms";
        ol.appendChild(clone);
      });
      pane.appendChild(wrap);
      scrollPaneBottom();
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
      scrollPaneTop();
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
      scrollPaneTop();
    }

    // /repo: not a window/tab anymore, just a typed-only shortcut that fetches
    // the (same-origin, static) repositories page and drops its content into
    // whatever pane is currently open. Cached after the first load.
    function fetchRepositories(entry, done) {
      if (cache.repositories) {
        done(cache.repositories);
        return;
      }
      var placeholder = document.createElement("p");
      placeholder.setAttribute("data-dynamic", "true");
      placeholder.innerHTML = "loading repositories &hellip;";
      pane.appendChild(placeholder);
      scrollPaneBottom();

      fetch(entry.fetchUrl)
        .then(function (res) {
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var article = doc.querySelector(".post article");
          var content = article ? article.innerHTML : "<p>could not load repositories.</p>";
          cache.repositories = content;
          placeholder.remove();
          done(content);
        })
        .catch(function () {
          placeholder.innerHTML = 'failed to load repositories. <a href="' + entry.fetchUrl + '">open the page directly</a>.';
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

      if (currentWindow === "about") {
        freezeAboutPane();
        aboutSnapshot = pane.innerHTML;
      }

      currentWindow = win;
      highlightTab(win);
      setTitle(win);

      if (win === "about") {
        restoreAboutSnapshot();
        return;
      }
      if (entry.print === "news") {
        var newsLines = buildNewsLines("about-news-full");
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
      if (exact && exact.text === "publications") {
        // Same full rich preview (gif previews, buttons) as the dedicated
        // window/tab, appended below whatever's already printed here — just
        // without switching tabs to get there.
        printLine('<span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>' + escapeHtml(value));
        appendBibliography("about-publications");
        return;
      }

      if (exact && exact.text === "news") {
        printLine('<span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>' + escapeHtml(value));
        // exact.previewCount (set on the /latest_news command in about.md) is
        // the one parameter controlling how many show here — shorter than
        // even the about page's own news limit; the 1:news tab (or ctrl+b 1)
        // is where to see all of it.
        var allNews = buildNewsLines("about-news") || [];
        var newsPreview = allNews.slice(0, exact.previewCount || allNews.length);
        printLinesStaggered(newsPreview.length ? newsPreview : ["nothing to show here yet."]);
        var fullNewsCount = (buildNewsLines("about-news-full") || []).length;
        if (fullNewsCount > newsPreview.length) {
          printLine('<span class="fetch-terminal__meta">' + fullNewsCount + " total &mdash; see 1:news (or ctrl+b 1) for all of it.</span>");
        }
        return;
      }

      if (exact && exact.text) {
        printLine('<span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>' + escapeHtml(value));
        var textLines = buildBibliographyLines("about-" + exact.text);
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

      if (exact && exact.fetchUrl) {
        printLine('<span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>' + escapeHtml(value));
        fetchRepositories(exact, function (html) {
          var wrap = document.createElement("div");
          wrap.setAttribute("data-dynamic", "true");
          wrap.innerHTML = html;
          pane.appendChild(wrap);
          scrollPaneBottom();
        });
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

      if (exact && exact.infoText) {
        printLine(exact.infoText);
        return;
      }

      printLine("command not found: " + escapeHtml(value) + ". type /help to see available commands.");
    }

    // Deliberately not calling input.focus() from any of these three handlers:
    // on phones, focusing the input pops the on-screen keyboard, which is a
    // jarring surprise when the user only meant to switch tabs/panes.
    Array.prototype.forEach.call(tmuxBar.querySelectorAll(".fetch-terminal__tmuxwin"), function (el) {
      el.addEventListener("click", function () {
        userInteracted = true;
        switchWindow(el.getAttribute("data-window"));
      });
    });

    // Tappable equivalents of ctrl+b n / ctrl+b c, for phones and anyone else
    // without an easy ctrl+b (touch keyboards have no reliable ctrl key).
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        userInteracted = true;
        nextWindow();
      });
    }
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        userInteracted = true;
        createNewWindow();
      });
    }

    input.addEventListener("input", function () {
      userInteracted = true;
      renderGhost();
      renderSuggestions();
    });

    input.addEventListener("keydown", function (e) {
      userInteracted = true;
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
      userInteracted = true;
      if (e.target.tagName !== "A") input.focus();
    });

    // Types text into the prompt one character at a time, like someone
    // actually typing, then "presses enter". Bails out cleanly at any point
    // if userInteracted flips true — a real visitor always wins over the demo.
    function typeIntoInput(text, done) {
      var i = 0;
      var iv = setInterval(function () {
        if (userInteracted) {
          clearInterval(iv);
          return;
        }
        i++;
        input.value = text.slice(0, i);
        renderGhost();
        renderSuggestions();
        if (i >= text.length) {
          clearInterval(iv);
          setTimeout(function () {
            if (userInteracted) return;
            list.hidden = true;
            ghost.textContent = "";
            run(text);
            if (done) done();
          }, 450);
        }
      }, 80);
    }

    // A quiet, self-guided tour: once the welcome.txt boot text has finished
    // streaming in, type /news and show it, then type /publications and show
    // that too — so a first-time visitor sees what the terminal can do without
    // having to already know these commands exist.
    function runAutoDemo() {
      var script = ["/latest_news", "/publications", "/info", "/help"];

      function step(i) {
        if (i >= script.length || userInteracted || currentWindow !== "about") return;
        typeIntoInput(script[i], function () {
          setTimeout(function () {
            step(i + 1);
          }, 1800);
        });
      }

      step(0);
    }

    // Chains the whole boot sequence off of measurements instead of hardcoded
    // magic numbers, so it stays in sync no matter how the identity card's
    // fastfetch fields or the welcome.txt bio text change later:
    //   identity card finishes streaming in
    //     -> the tmux window pops open
    //       -> "cat welcome.txt" types itself out
    //         -> each bio paragraph streams in
    //           -> the prompt line appears -> the auto-demo begins
    (function scheduleBootSequence() {
      var windowBox = document.getElementById("fetch-terminal-window");
      var info = document.querySelector(".fetch-terminal__info");
      var typed = document.querySelector(".fetch-terminal__typed");
      if (!windowBox || !info || !info.lastElementChild) return;

      function finishTime(el, fallbackDuration) {
        if (!el) return 0;
        var cs = getComputedStyle(el);
        var delay = parseFloat(cs.animationDelay) || 0;
        var duration = parseFloat(cs.animationDuration) || fallbackDuration || 0;
        return delay + duration;
      }

      var t = finishTime(info.lastElementChild) + 0.1;
      windowBox.style.animationDelay = t + "s";
      t += 0.5 + 0.1; // the window's own pop-open animation, plus a small pause

      if (typed) {
        var charCount = typed.textContent.length;
        var typingDuration = Math.max(0.4, charCount * 0.06);
        typed.style.animationDuration = typingDuration + "s";
        typed.style.animationTimingFunction = "steps(" + charCount + ", end)";
        typed.style.animationDelay = t + "s";
        t += typingDuration + 0.2;
      }

      Array.prototype.forEach.call(pane.children, function (child) {
        if (child.classList.contains("fetch-terminal__cmdline") || child.hasAttribute("data-dynamic")) return;
        child.style.animationDelay = t + "s";
        t += 0.55;
      });

      promptLine.style.animationDelay = t + "s";
      t += 0.25 + 0.8; // the prompt's own fade-in, plus a beat before the demo starts

      setTimeout(runAutoDemo, t * 1000);
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
