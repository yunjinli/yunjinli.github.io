// Interactive command prompt for the fetch-terminal widget on the about page.
(function () {
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    var cmdBox = document.querySelector(".fetch-terminal__cmd");
    var input = document.getElementById("fetch-terminal-input");
    var ghost = document.getElementById("fetch-terminal-ghost");
    var list = document.getElementById("fetch-terminal-suggestions");
    var promptLine = document.getElementById("fetch-terminal-promptline");
    var dataEl = document.getElementById("fetch-terminal-commands");
    if (!cmdBox || !input || !ghost || !list || !promptLine || !dataEl) return;

    var COMMANDS = JSON.parse(dataEl.textContent);
    var activeIndex = -1;

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
      cmdBox.insertBefore(p, promptLine);
    }

    function printBlock(lines, moreUrl) {
      var wrap = document.createElement("div");
      wrap.setAttribute("data-dynamic", "true");
      wrap.className = "fetch-terminal__printed";

      lines.forEach(function (html, i) {
        var p = document.createElement("p");
        p.className = "fetch-terminal__printed-line";
        p.style.animationDelay = i * 90 + "ms";
        p.innerHTML = html;
        wrap.appendChild(p);
      });

      if (moreUrl) {
        var more = document.createElement("p");
        more.className = "fetch-terminal__printed-line fetch-terminal__printed-more";
        more.style.animationDelay = lines.length * 90 + "ms";
        more.innerHTML = "full list &rarr; <a href=\"" + moreUrl + "\">" + moreUrl + "</a>";
        wrap.appendChild(more);
      }

      cmdBox.insertBefore(wrap, promptLine);
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

    function buildBibliographyLines(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return null;
      var items = container.querySelectorAll("ol.bibliography > li");
      if (!items.length) return null;

      return Array.prototype.map.call(items, function (li) {
        var titleEl = li.querySelector(".title");
        var authorEl = li.querySelector(".author");
        var venueEl = li.querySelector(".periodical");
        // Project titles already link to their page; paper titles don't, so fall
        // back to the first real link (arXiv/project/etc.) in the links row.
        var linkEl = (titleEl && titleEl.querySelector("a")) || li.querySelector(".links a[href]");

        var titleText = (titleEl ? titleEl.textContent : "").replace(/\s+/g, " ").trim();
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

    function run(raw) {
      var value = raw.trim();
      list.hidden = true;
      ghost.textContent = "";
      input.value = "";
      if (!value) return;

      printLine('<span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>' + escapeHtml(value));

      if (value.toLowerCase() === "/clear") {
        Array.prototype.forEach.call(cmdBox.querySelectorAll("[data-dynamic]"), function (el) {
          el.remove();
        });
        return;
      }

      if (value.toLowerCase() === "/help") {
        printLine(
          COMMANDS.map(function (c) {
            return escapeHtml(c.cmd) + " &mdash; " + escapeHtml(c.desc);
          }).join("<br>")
        );
        return;
      }

      var exact = COMMANDS.filter(function (c) {
        return c.cmd === value.toLowerCase();
      })[0];

      if (exact && exact.print) {
        var lines = exact.print === "news" ? buildNewsLines() : buildBibliographyLines("about-" + exact.print);
        if (lines && lines.length) {
          printBlock(lines, exact.moreUrl);
        } else {
          printLine("nothing to show here yet.");
        }
        return;
      }

      if (exact && exact.url) {
        printLine("opening " + exact.cmd.slice(1) + " &hellip;");
        input.disabled = true;
        window.setTimeout(function () {
          window.location.href = exact.url;
        }, 350);
        return;
      }

      printLine("command not found: " + escapeHtml(value) + ". type /help to see available commands.");
    }

    input.addEventListener("input", function () {
      renderGhost();
      renderSuggestions();
    });

    input.addEventListener("keydown", function (e) {
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
