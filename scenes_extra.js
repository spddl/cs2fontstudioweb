// Scenes put together by hand from generated backgrounds (tools/gen_scenes.py ... <screen>:-) and hand-made items.
// The main menu on the 1920x1080 background without text, with the items of the hand-made main menu scene
SCENES.push({id: "mainmenu_blank", name: "Main menu", img: "scenes/m_mainmenu_blank.jpg", items: MAINMENU_ITEMS});
// the care package header of the store is placed by the game's column logic, which the measured items cannot express
// and the menu bar comes from the hand-made scenes (the measurement missed NEWS)
SCENES.find(s => s.id === "m_store_blank")?.items.push(...CARE_PACKAGE, ...menuNav("STORE"));
// console: the log of a real session in the game's colours instead of the calibration text (Stratum2 Mono 13px, measured: one
// character every 7.29 units, a line every 17.7; long lines are cut at the window edge), and the mission button: its two
// labels are centred on the button (70..274) and anchored at its left edge once they are wider, so a larger font runs out on
// the right; mode and map like the mission tile (bold, "on" regular)
{
  const sc = SCENES.find(s => s.id === "m_console_blank");
  if (sc) {
    sc.items = sc.items.filter(it => !(it[4] === "Stratum2 Mono" && it[3] !== "CONSOLE") && !/^(COMPETITIVE on CACHE|Win rounds)$/.test(it[3]));
    sc.items.push(
      ...CONSOLE_LOG.slice(0, 27).map(([t, c], i) => [424.5, 286.2 + i * 17.7, "l", t, "Stratum2 Mono", 13, 400, c, "Console text", {ls: 0.66, clipR: 1486}]),
      [70, 1055.3, "l", "COMPETITIVE on CACHE", "Stratum2", 19, 700, W, "Menu tiles", {face: "Stratum2 Bold Condensed", hbox: [70, 204], runs: [["COMPETITIVE ", 19], ["on", 19, null, 400], [" CACHE", 19]]}],
      [70, 1089.7, "l", "Win rounds", "Stratum2 Condensed", 22.5, 400, W, "Menu tiles", {hbox: [70, 204]}],
    );
  }
}
// tab order
{
  const order = ["mainmenu_blank", "m_console_blank", "m_store_blank", "m_loadout_blank", "m_settings_game_blank", "watch", "ingame", "m_hud_blank", "killfeed", "scoreboard"];
  SCENES.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
}
// In game 2: money, health and ammo (the calibration run did not read them: semi-transparent digits). Groups from the bit shots
// (as in the HUD scene: money Stratum2 Mono in a digit panel, health/ammo Stratum2 Bold TF), position and colour measured on
// the screenshot with text; CT side, so the digits are light blue instead of gold
SCENES.find(s => s.id === "m_hud_blank")?.items.push(
  [219, 1048, "l", "$16000", "Stratum2 Mono", 38, 700, "#d7def9", "HUD money", {bh: 36, cells: 18.7, ls: 0}],
  [722, 1037.1, "c", "100", "Stratum2 Bold TF", 42, 700, "#cae7fc", "HUD health", {ls: 1}],
  [1273, 1037.1, "c", "12", "Stratum2 Bold TF", 42, 700, "#d9e2fa", "HUD ammo"],
  [1336.8, 1035.7, "c", "2", "Stratum2 Bold TF", 32, 700, "#dbe1f3", "HUD ammo"],
);
// In game 2: slot numbers of the weapon list (pistol 2, knife 3), measured on the screenshot with text; font as in the HUD scene
SCENES.find(s => s.id === "m_hud_blank")?.items.push(
  [1785.4, 850.3, "c", "2", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
  [1785.4, 930.4, "c", "3", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
);
// In game 2: team counter at the top (no round timer in warmup): scores Stratum2 Bold TF, player counts Stratum2 bold (groups
// from the bit shots, positions as in the HUD scene, size and colours measured)
SCENES.find(s => s.id === "m_hud_blank")?.items.push(
  [978.1, 91.1, "c", "0", "Stratum2 Bold TF", 28, 700, CT, "HUD score"],
  [1021.9, 91.1, "c", "0", "Stratum2 Bold TF", 28, 700, T, "HUD score"],
  [982, 120.4, "c", "5", "Stratum2", 16.5, 700, "#a4b2c5", "HUD player count"],
  [1027, 120.4, "c", "5", "Stratum2", 16.5, 700, "#ccae72", "HUD player count"],
);
