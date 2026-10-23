(function () {
  var path = location.pathname || "/";
  if (path.endsWith("/index.html")) path = path.slice(0, -"index.html".length);
  if (!path.endsWith("/")) {
    var file = path.split("/").pop() || "";
    if (!file) path += "/";
  }
  var page = location.origin + path;
  var folder = location.origin + (location.pathname || "/").replace(/[^/]*$/, "");
  var image = folder + "assets/og.jpg";
  var canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.setAttribute("href", page);
  var set = function (selector, value) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.setAttribute("content", value);
    });
  };
  set('meta[property="og:url"]', page);
  set('meta[property="og:image"]', image);
  set('meta[property="og:image:secure_url"]', image);
  set('meta[name="twitter:image"]', image);
  var schema = document.getElementById("schema-negocio");
  if (!schema) return;
  try {
    var data = JSON.parse(schema.textContent || "{}");
    data.url = page;
    data.image = image;
    schema.textContent = JSON.stringify(data);
  } catch (error) {}
})();
