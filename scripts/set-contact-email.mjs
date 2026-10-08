// Sets the contact_email site setting via the admin_upsert_setting RPC.
// The CLI's --data flag rejects JSON payloads on this shell, so this runs
// through the InsForge HTTP API directly.
//
// The stored shape matters: the contact route reads it as a plain string, and
// an admin tool had written it as {"email": "..."}, which made the route
// return "যোগাযোগ ইমেইল সেটআপ করা হয়নি।".

import https from "https";
import fs from "fs";

const projectJson = JSON.parse(
  fs.readFileSync("H:/website/.insforge/project.json", "utf8"),
);

const body = JSON.stringify({
  p_key: "contact_email",
  p_value: "Pradipkumaracharjee78@gmail.com",
  p_category: "general",
});

const req = https.request(
  {
    hostname: projectJson.oss_host.replace("https://", ""),
    port: 443,
    path: "/api/database/rpc/admin_upsert_setting",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: projectJson.api_key,
      Authorization: `Bearer ${projectJson.api_key}`,
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      console.log("HTTP", res.statusCode);
      console.log(data);
    });
  },
);
req.on("error", (e) => console.error("ERR", e.message));
req.write(body);
req.end();