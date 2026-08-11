// Serves a self-contained, embeddable widget loader script.
// Embedded via: <script src="http://localhost:3000/api/widget" data-company-id="..."></script>

export async function GET() {
  const script = `
(function () {
  var BASE_URL = "http://localhost:3000";

  function findSelf() {
    var scripts = document.getElementsByTagName("script");
    var src = BASE_URL + "/api/widget";
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.src && s.src.indexOf("/api/widget") !== -1) {
        return s;
      }
    }
    return scripts[scripts.length - 1];
  }

  var companyId =
    document.currentScript && document.currentScript.getAttribute("data-company-id");

  if (!companyId && window.__QUOTEFLOW_COMPANY_ID__) {
    companyId = window.__QUOTEFLOW_COMPANY_ID__;
  }

  if (!companyId) {
    var self = findSelf();
    if (self) {
      companyId = self.getAttribute("data-company-id");
    }
  }

  if (!companyId) {
    console.error("QuoteFlow widget: missing data-company-id attribute.");
    return;
  }

  var container = document.createElement("div");
  container.setAttribute(
    "id",
    "quoteflow-widget-" + companyId.replace(/[^a-zA-Z0-9_-]/g, "")
  );
  container.style.width = "100%";
  container.style.overflow = "hidden";

  var iframe = document.createElement("iframe");
  iframe.src = BASE_URL + "/quote/" + encodeURIComponent(companyId);
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.height = "600px";
  iframe.style.overflow = "hidden";
  iframe.setAttribute("title", "QuoteFlow Instant Quote");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute(
    "allow",
    "camera; microphone; fullscreen"
  );

  container.appendChild(iframe);

  var host = findSelf().parentNode;
  if (host && host.nodeType === 1) {
    host.insertBefore(container, findSelf().nextSibling);
  } else {
    document.body.appendChild(container);
  }

  function setHeight(height) {
    var h = parseInt(height, 10);
    if (!isNaN(h) && h > 0) {
      iframe.style.height = h + "px";
      container.style.height = "auto";
    }
  }

  window.addEventListener(
    "message",
    function (event) {
      try {
        if (event.origin !== new URL(iframe.src).origin) return;
        var data = event.data;
        if (data && data.type === "quoteflow:resize") {
          setHeight(data.height);
        }
      } catch (err) {
        // Ignore malformed messages.
      }
    },
    false
  );
})();
`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}