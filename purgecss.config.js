module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  // These states are applied after load by the portfolio's scroll observers.
  safelist: ["reveal-ready", "is-visible"],
  dynamicAttributes: ["data-reveal", "aria-current", "aria-expanded", "data-theme", "data-theme-setting"],
};
