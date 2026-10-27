# Funktionaaliset ryhmät

Kemian harjoitus: tunnista satunnaisesti luodun molekyylin funktionaaliset ryhmät viivakaavasta. Ei riippuvuuksia, ei build-vaihetta.

- **4 vaikeustasoa** (1–4 ryhmää, pidempi ketju, bentseenirenkaan sivuryhmät) ja **mukautuva tila**: 3 oikein putkeen nostaa tasoa, 2 väärin laskee sitä.
- Molekyylit luodaan graafina ja **vastaus lasketaan graafista** (`chem.js › detect`), joten vastaus on aina oikea.
- **Avaa Ketcherissä** kopioi Molfilen ja avaa [EPAM Ketcherin](https://github.com/epam/ketcher).
- Testi: `node test.js`

## GitHub Pages
1. Luo repo ja työnnä tiedostot `main`-haaraan.
2. Settings → Pages → Source: **GitHub Actions**.
3. Sivu julkaistaan osoitteeseen `https://<käyttäjä>.github.io/<repo>/`.

## Languages, license and terms
- UI in **English, Finnish and Swedish** (`i18n.js`); the language is picked from the browser and can be changed at any time.
- On first load the user must accept the **GPLv3 license and terms of use** (stored in `localStorage` under `fgq-consent-1`; bump the key to ask again).
- Add the full license text to the repo before releasing: `curl -o LICENSE https://www.gnu.org/licenses/gpl-3.0.txt`

## Ketcher (molecule opens directly in the editor)
The hosted Ketcher demo is a different website, so a molecule can only be pasted into it by hand (the button copies the Molfile).
To make **Open in Ketcher** show the molecule automatically, host Ketcher yourself:
1. Download the ready-to-run standalone build from the *Assets* of a release at https://github.com/epam/ketcher/releases
2. Extract it into a `ketcher/` folder in this repo so that `ketcher/index.html` exists (keep Ketcher's own LICENSE and NOTICE files).
3. Commit and push. The button then opens Ketcher in the page and loads the molecule through `ketcher.setMolecule()`.
Without the folder it falls back to copy and paste.

## Competition mode (no server needed)
- **Host**: Competition → Host → pick difficulty (1–4, or *rising*) and time → *Create new code* → give the code (e.g. `K7M2Q-R-10`) to the players.
- **Players**: Competition → Join → name + code → *Start*. Everyone gets the **same molecules in the same order**. Points: 10 × level per correct answer, plus a streak bonus (up to +10). Skips and wrong answers give 0 and reset the streak. One attempt per code and device.
- When the time is up the player gets a **result code**. The host pastes the codes into *Host → Result codes* to see the leaderboard (kept in the host's browser).
- Result codes carry a checksum, so edited codes are rejected, but this is a light deterrent, not strong anti-cheat: there is no server.
- Practice mode: leaving an unanswered molecule (New molecule or a difficulty button) now counts as a miss.
