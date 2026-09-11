// Injects the generated sample data into the dashboard template, producing a
// standalone dashboard.html you can open in a browser or publish as an artifact.
// Usage: npm run build && node prototype/generate-sample.js && node prototype/build.js
const fs = require("fs");
const path = require("path");

const tpl = fs.readFileSync(path.join(__dirname, "dashboard.template.html"), "utf8");
const dataPath = path.join(__dirname, "sample-reports.json");
if (!fs.existsSync(dataPath)) {
  console.error("Missing sample-reports.json — run: node prototype/generate-sample.js");
  process.exit(1);
}
const data = fs.readFileSync(dataPath, "utf8");
if (data.indexOf("</script") >= 0) throw new Error("data must not contain a closing script tag");

const out = tpl.replace("__REPORTS_JSON__", data);
if (out.indexOf("__REPORTS_JSON__") >= 0) throw new Error("placeholder not replaced");

const dest = path.join(__dirname, "dashboard.html");
fs.writeFileSync(dest, out);
console.log("Wrote", dest, "(" + out.length + " bytes)");
