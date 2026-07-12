---
layout: about
title: about
nav_icon: fas fa-user
permalink: /
# subtitle: <a href='#'>Affiliations</a>. Address. Contacts. Moto. Etc.

profile:
  align: right
  # image: profile.jpg
  image_circular: false # crops the image to make it circular
  # more_info: >
  #  <p>555 your office number</p>
  #  <p>123 your address street</p>
  #  <p>Your City, State 12345</p>

news: true # includes a list of news items
selected_papers: true # includes a list of papers marked as "selected={true}"
projects: true
social: true # includes social icons at the bottom of the page
fetch_terminal: true # loads the interactive command prompt for the terminal widget below
---

<!-- Write your biography here. Tell the world about yourself. Link to your favorite [subreddit](http://reddit.com). You can put a picture in, too. The code is already in, just name your picture `prof_pic.jpg` and put it in the `img/` folder.

Put your address / P.O. box / other info right below your picture. You can also disable any of these elements by editing `profile` property of the YAML header of your `_pages/about.md`. Edit `_bibliography/papers.bib` and Jekyll will render your [publications page](/al-folio/publications/) automatically.

Link to your social media connections, too. This theme is set up to use [Font Awesome icons](https://fontawesome.com/) and [Academicons](https://jpswalsh.github.io/academicons/), like the ones below. Add your Facebook, Twitter, LinkedIn, Google Scholar, or just disable all of them. -->
<div class="fetch-terminal">
  <div class="fetch-terminal__bar">
    <span class="dot dot--red"></span><span class="dot dot--yellow"></span><span class="dot dot--green"></span>
    <span class="fetch-terminal__title">jim@lsy-tum: ~</span>
  </div>
  <div class="fetch-terminal__body">
    <div class="fetch-terminal__photo">
      <img src="{{ '/assets/img/terminal-photo.jpg' | relative_url }}" alt="Jim">
    </div>
    <div class="fetch-terminal__info">
      <!-- <p>jim<span class="fetch-terminal__prompt-sym" style="margin:0;">@</span>lsy-tum</p> -->
      <!-- <p class="fetch-terminal__rule">-----------------</p> -->
      <p><span class="k">OS</span>: PhD Student @ <a href="https://www.tum.de/en/">TUM</a></p>
      <p><span class="k">Host</span>: <a href="https://www.dynsyslab.org/">Learning Systems and Robotics Lab (LSY)</a></p>
      <p><span class="k">Advisor</span>: <a href="https://www.dynsyslab.org/prof-angela-schoellig/">Prof. Dr. Angela Schoellig</a></p>
      <p><span class="k">Research</span>: Safe Embodied Robot Interaction on Humanoids</p>
      <p><span class="k">Focus</span>: Real2Sim2Real / Articulated Object Generation</p>
      <p><span class="k">Previously</span>: CVG TUM &mdash; <a href="https://cvg.cit.tum.de/members/cremers">Prof. Dr. Daniel Cremers</a></p>
      <!-- <p><span class="k">Projects</span>: <a href="https://yunjinli.github.io/projects-vxp/">VXP</a>, <a href="https://yunjinli.github.io/project-sadg/">TRASE</a>, <a href="https://yan-xia.github.io/projects/UniLoc/">UniLoc</a></p> -->
      <p><span class="k">Status</span>: open to thesis / GR / internship students & collab</p>
      <div class="fetch-terminal__logos">
        <a href="https://nthu-en.site.nthu.edu.tw/"><img src="{{ '/assets/img/nthu_logo.png' | relative_url }}" style="height: 32px;" alt="NTHU Logo"></a>
        <a href="https://www.tum.de/en/"><img src="{{ '/assets/img/tum_logo.png' | relative_url }}" style="height: 32px;" alt="TUM Logo"></a>
        <a href="https://www.dynsyslab.org/"><img src="{{ '/assets/img/learnsyslab_logo.PNG' | relative_url }}" style="height: 32px;" alt="LSY Logo"></a>
        <a href="https://mcml.ai/"><img src="{{ '/assets/img/MCML_Logo_os.png' | relative_url }}" style="height: 12px;" alt="MCML Logo"></a>
      </div>
    </div>
  </div>
  <div class="fetch-terminal__cmd">
    <p><span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>cat welcome.txt</p>
    <p>Hello! It's Jim here :wave: I am a PhD student at <a href="https://www.dynsyslab.org/">Learning Systems and Robotics Lab (LSY)</a> at TUM, supervised by <a href="https://www.dynsyslab.org/prof-angela-schoellig/">Prof. Dr. Angela Schoellig</a>. My research centers on Safe Embodied Robot Interaction on Humanoids. More broadly, I work on Real2Sim2Real frameworks for learning complex embodied interactions, such as manipulating multi-joint articulated objects found in daily life.</p>
    <p>Previously, I was a Master's student at <a href="https://www.tum.de/en/">TUM</a>. During my Master's studies, I focused on giving machine richer spatial understanding. I completed three research projects <a href="https://yunjinli.github.io/projects-vxp/">VXP (3DV 2025)</a>, <a href="https://yunjinli.github.io/project-sadg/">TRASE (3DV 2026)</a>, and <a href="https://yan-xia.github.io/projects/UniLoc/">UniLoc</a> in Computer Vision Group, led by <a href="https://cvg.cit.tum.de/members/cremers">Prof. Dr. Daniel Cremers</a>.</p>
    <p>I am always open to supervising excellent and motivative student for thesis, guided research, research internship. You can always find our open topics <a href="https://www.ce.cit.tum.de/lsy/open-research-projects/">here</a>. If you want to work with me, please send me an email describing your area of interest and attach your CV and up-to-date transcripts. I am also open to any research collaboration :smile:</p>
    <div class="fetch-terminal__promptline" id="fetch-terminal-promptline">
      <span class="fetch-terminal__prompt-sym">jim@lsy-tum:~$</span>
      <span class="fetch-terminal__input-wrap">
        <span class="fetch-terminal__ghost" id="fetch-terminal-ghost"></span>
        <input
          type="text"
          class="fetch-terminal__input"
          id="fetch-terminal-input"
          placeholder="type / for commands&hellip;"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-label="terminal command input"
        />
      </span>
    </div>
    <ul class="fetch-terminal__suggestions" id="fetch-terminal-suggestions" hidden></ul>
    <script type="application/json" id="fetch-terminal-commands">
      [
        { "cmd": "/news", "print": "news", "moreUrl": "{{ '/news/' | relative_url }}", "desc": "news & updates" },
        { "cmd": "/publications", "print": "publications", "moreUrl": "{{ '/publications/' | relative_url }}", "desc": "papers & publications" },
        { "cmd": "/projects", "print": "projects", "moreUrl": "{{ '/projects/' | relative_url }}", "desc": "projects" },
        { "cmd": "/repositories", "url": "{{ '/repositories/' | relative_url }}", "desc": "github repositories" },
        { "cmd": "/about", "url": "{{ '/' | relative_url }}", "desc": "back to top" },
        { "cmd": "/help", "desc": "list available commands" },
        { "cmd": "/clear", "desc": "clear this session" }
      ]
    </script>
  </div>
</div>
