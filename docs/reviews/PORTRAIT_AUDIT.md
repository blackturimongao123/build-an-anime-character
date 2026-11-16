# Portrait audit (2026-11-16)

All 673 live portraits were checked by eye on labelled contact sheets (sorted by series, then name). 45 were flagged as wrong or doubtful. 41 were replaced, 3 turned out to be correct, and 1 still needs a manual image.

## Why the wrong images got in

The Anime-Planet lookup in `scripts/lib/anime-planet.ts` had three weak spots:

1. **No-match fallback.** When AP search found no name match, it returned the first character link on the results page. That is how unrelated images such as a pug (Connie), a maid (Fubuki) or a fox (Tatsumaki) got in.
2. **Unknown slug hints.** A hint slug that doesn't exist on AP redirects to a search page with status 200, and the first portrait on that page was taken.
3. **Lookup order.** Cast-page matching by short display name ("Kuzen", "Rose", "Tosen") ran before the explicit slug hint.

## Fixes to the tooling

- The no-match fallback is removed: no confident match now means no image.
- Redirects away from `/characters/<slug>` are rejected.
- The slug hint is now tried before cast-page matching.
- New `data/sources/portrait-pins.json` (id → verified image URL) is checked first by both `fetch-portraits.ts` and `fetch-portraits-ids.ts`, so a re-fetch can never replace a hand-verified portrait.

## Replaced (41)

New images come from AniList, except Ho-Oh, which uses the official Pokémon artwork (PokeAPI sprites). Each was checked by eye.

| Id | Was showing | Now |
|---|---|---|
| ainz-overlord | an old man | Ainz (skeleton) |
| angelo-jojo | a blond boy | Anjuro "Angelo" Katagiri |
| august-fairy-tail | a young blonde woman | August |
| beast-aot | a red-haired woman | Zeke Yeager |
| big-mom-one-piece | a red-bearded man | Charlotte Linlin |
| brandish-fairy-tail | a woman in glasses | Brandish μ |
| bryan-ippo | the wrong man | Bryan Hawk |
| connie-aot | a pug | Connie Springer |
| daki-demon-slayer | Urokodaki (red mask) | Daki |
| dimaria-fairy-tail | a cloaked man | Dimaria Yesta |
| doma-demon-slayer | a bearded man | Doma |
| founding-aot | a girl in a dress | Ymir Fritz |
| fubuki-opm | a maid | Fubuki |
| gabi-aot | a man | Gabi Braun |
| grey-black-clover | a dark silhouette | Grey |
| haizaki-kuroko | a girl | Shogo Haizaki |
| historia-aot | a blue-haired girl | Historia (Krista Lenz) |
| ho-oh-pokemon | a blurry wing | Ho-Oh |
| ichibe-bleach | a cartoon boy | Ichibe Hyosube |
| ignia-fairy-tail | a red-haired girl | Ignia |
| kaguya-naruto | a dark, unrelated figure | Kaguya Otsutsuki |
| kakashi-naruto | an unrelated icon | Kakashi Hatake |
| kaoru-baki | an orange-haired woman | Kaoru Hanayama |
| kenjaku-jjk | a manga scribble | Kenjaku |
| konan-naruto | a man | Konan |
| kuzen-tg | two red-haired girls | Kuzen Yoshimura (the Non-Killing Owl) |
| minato-naruto | an old bald man | Minato Namikaze |
| musashi-baki | an animal face | Musashi Miyamoto |
| obito-naruto | an old man | Obito (masked, as Tobi) |
| oetsu-bleach | a moustached man | Oetsu Nimaiya |
| patri-black-clover | a woman in glasses | Patri |
| pepe-bleach | a cartoon chick | Pepe Waccabrada |
| pride-fma | a red-haired girl | Pride (Selim Bradley) |
| rakan-sl | a kid in a hat | Rakan |
| rose-bleach | a green muscled figure | Rojuro "Rose" Otoribashi |
| tank-sl | a pink hamster | Tank |
| tatsumaki-opm | a fox in a scarf | Tatsumaki |
| tien-dragon-ball | a silver-haired girl | Tien Shinhan |
| tosen-bleach | a brown-haired girl | Kaname Tosen |
| wrath-fma | a white-haired character | Wrath (King Bradley) |
| yoriichi-demon-slayer | a dark, unclear figure | Yoriichi Tsugikuni |

## Checked and kept (3)

- eto-tg: the current image is Eto (bandaged One-Eyed Owl).
- thomas-andre-sl: the current image is Thomas Andre.
- volg-ippo: the current image is Volg Zangief (old-anime art).

## Needs your eye (1)

- **soul-king-bleach**: still the wrong image (a boy in a red shirt). The Soul King has no AniList or Anime-Planet entry, and the Bleach and VS Battles wiki image hosts sit behind a Cloudflare check. To fix it, drop an image at `public-shared/portraits/soul-king-bleach.<ext>` (and update the portrait path), or send a direct image URL and I'll pin it.
