const slugs = process.argv.slice(2);
const UA = "BuildCharacterPortraitBot/1.0";
for (const s of slugs) {
  const res = await fetch(`https://www.anime-planet.com/characters/${s}`, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  const html = await res.text();
  const m =
    html.match(/cdn\.anime-planet\.com\/characters\/primary\/[^"'\s]+/) ??
    html.match(/www\.anime-planet\.com\/images\/characters\/[^"'\s]+/);
  console.log(s, res.status, res.url.replace(/^https?:\/\/[^/]+/, ""), m ? m[0] : "no-img");
  await new Promise((r) => setTimeout(r, 220));
}
