// Verifies extractContactEmail handles every stored shape.
function extractContactEmail(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        const inner = parsed.email ?? parsed.value ?? parsed.address;
        return typeof inner === "string" ? inner.trim() : "";
      } catch {
        return "";
      }
    }
    return trimmed;
  }
  if (value && typeof value === "object") {
    const obj = value;
    const inner = obj.email ?? obj.value ?? obj.address;
    return typeof inner === "string" ? inner.trim() : "";
  }
  return "";
}

const cases = [
  ["plain string", "Pradipkumaracharjee78@gmail.com", "Pradipkumaracharjee78@gmail.com"],
  ["object form", { email: "Pradipkumaracharjee78@gmail.com" }, "Pradipkumaracharjee78@gmail.com"],
  ["object with value key", { value: "Pradipkumaracharjee78@gmail.com" }, "Pradipkumaracharjee78@gmail.com"],
  ["old address key", { address: "Pradipkumaracharjee78@gmail.com" }, "Pradipkumaracharjee78@gmail.com"],
  ["whitespace", "  Pradipkumaracharjee78@gmail.com  ", "Pradipkumaracharjee78@gmail.com"],
  ["empty string", "", ""],
  ["null", null, ""],
  ["broken JSON object", "{ not json }", ""],
];

let ok = true;
for (const [name, input, expected] of cases) {
  const got = extractContactEmail(input);
  const pass = got === expected;
  if (!pass) ok = false;
  console.log(`${pass ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}`);
}
process.exit(ok ? 0 : 1);