/* AllReady — runs before the first paint on every page. MIT licensed.
   Applies the saved light/dark choice so a page never flashes the wrong colours while its
   stylesheet and modules load. A file, not an inline script, because the CSP allows no inline
   script. Mirrors src/theme.js, which takes over once the page's modules run. */
(function () {
  try {
    var m = localStorage.getItem("allready.theme");
    var dark = m === "dark" || (m !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    var r = document.documentElement;
    r.setAttribute("data-theme", dark ? "dark" : "light");
    r.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
