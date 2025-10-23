// convert-tle.js
import fs from "fs";

const raw = fs.readFileSync("station.txt", "utf8");
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const sats = [];
for (let i = 0; i < lines.length; ) {
  const name = lines[i];
  const l1 = lines[i + 1];
  const l2 = lines[i + 2];

  if (l1?.startsWith("1 ") && l2?.startsWith("2 ")) {
    sats.push({ satellite_id: name, tle1: l1, tle2: l2 });
    i += 3;
  } else {
    i++;
  }
}

fs.writeFileSync("satellites.json", JSON.stringify(sats, null, 2));
console.log(`✅ Saved ${sats.length} satellites to satellites.json`);
