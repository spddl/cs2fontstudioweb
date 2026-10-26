// Scenes: background without text (Assets/measure/NoneFont, cs2-fonts.ps1 Blank) + text elements.
// Coordinates in 2000x1124 space (screenshot scaled to 2000x1124). px = CSS size at 1080p. Positions, sizes and letter spacing of the main menu, console, HUD and scoreboard were measured with the measurement fonts (cs2-fonts.ps1 Measure, tools/measure_bars.py).
// Item: [x, y, align(l|c|r), text, family, px, weight, color, area, extra]
//   y = vertical middle of the text. extra: {ls: letter-spacing px, up: 1 = uppercase, cells: width (CSS px) of one digit cell (digitpanel), bw/bh: fixed box (CSS px at 1080p) the game clips text to, runs: [[text, px, colour?, weight?], ...] one text with several sizes (colours, weights) on one baseline, clipR: x (stage units) where the game cuts the text off, after/before: gap (stage units) to the end of the item before / the start of the item after it (the x is ignored), hbox: [left, width] (stage units) container the text is centred in (left-anchored once it is wider), vbox: [top, height] (stage units) of the container the game places the text in by font metrics (used for chosen fonts), ta: text-align, top: 1 = align text to box top, face: the face the game shows when it differs from the family (stand-in only), row/ow/slot/chip: see ROWS (chip: [top, height, padding, colour] of a box behind the text), ns: 1 = no text shadow, shrink: max width (CSS px) the game shrinks the text to, col: [right, min width] (stage units) of a right-aligned column the text is centred in}
//   flow/fcol: column fcol of a FLOWS layout (x is ignored).
const W = "#fff", DIM = "#ffffff80", GOLD = "#f6c968", CT = "#B5D4EE", T = "#EAD18A";
const NAV = "#83d8ff";                              // selectedNavColor (active tab)
const CT_DIM = "#91aabf", T_DIM = "#bba76e";          // team colours as the match-info scoreboard tints rows (about 80 %)
// Text in a family that no group reaches (labels without a font class get a default family that is not in families.json;
// measured with tools/cs2-calibrate.ps1: these texts stay unchanged whatever the app sets). Shown, but not selectable.
const FIXED = "(default font)";

// top menu bar (mainmenu.css .mainmenu-top-navbar__radio-btn__label: 28px, PLAY 36px, letter-spacing 1px). The tabs are as wide as
// their text (padding 18px), PLAY has a fixed 128px tab, and the whole row is centred: a wider font pushes the tabs apart.
// ow = text width with Stratum2 (measured), slot = the fixed PLAY tab including the gaps to its neighbours.
const menuNav = active => [[784.5, "INVENTORY", 28, 90.7], [908.6, "LOADOUT", 28, 72.3], [1032, "PLAY", 36, 48.1], [1146.5, "STORE", 28, 51.5], [1238.4, "NEWS", 28, 46.2]]
  .map(([x, t, px, ow]) => [x, px > 30 ? 35.5 : 35.1, "c", t, "Stratum2 Condensed", px, 400, t === active ? NAV : W, "Menu bar",
    {ls: 1, row: "nav", ow, ...(t === "PLAY" ? {slot: 174.5} : {})}]);
// rows laid out by text width (stage units): c = centre of the row, gap = space between two tabs' texts.
// Fitted to the measured menu bar with Stratum2 and to a screenshot with a much wider font (both within 1.5 units).
const ROWS = {nav: {c: 1000.4, gap: 42.3}, storetabs: {c: 1000.2, gap: 27.8}, watchtabs: {c: 1000.6, gap: 27.8}};
// columns that flow to the right (flow-children: right): each one starts after the widest text of the previous one plus gap
// (stage units); ow = column width with Stratum2 (from the measured positions), right = edge of the parent, where the last
// column wraps its text
const FLOWS = {mimeta: {x: 1004, gap: 87.4, right: 1645, ow: [55.6, 97.6, 0]}};
// small counters under the icons of the right-hand bar (friends, streams, history); [y, text] per counter. No font class: the default font (FIXED).
const friendCounts = list => list.map(([y, t]) => [1966.5, y, "c", t, FIXED, 9, 400, "#d1d1d1", "Menu friends"]);

// a player name with its clan tag in front ([BOT] for bots): two labels, the tag in Stratum2 Light Condensed (measured with the bit
// shots in the scoreboard and the kill feed). The name starts after the tag (after: gap in stage units), so a wider tag font
// pushes it to the right.
const clanName = (x, y, tag, name, color, family = "Stratum2 Medium", px = 17, w = 500, area = "Scoreboard player name") => [
  [x, y, "l", tag, "Stratum2 Light Condensed", px, 300, color, "Clan tag"],
  [x, y, "l", name, family, px, w, color, area, {after: 5}],
];
// the same right-aligned (kill feed killer): the name ends at x, the tag ends before it (before: gap)
const clanNameR = (x, y, tag, name, color) => [
  [x, y, "r", tag, "Stratum2 Light Condensed", 16, 300, color, "Clan tag", {before: 4.5}],
  [x, y, "r", name, "Stratum2", 16, 700, color, "HUD killfeed"],
];

const HUD = [
  // top centre: round timer and team counter (hudteamcounter.css .teamcounter_timer: stratum-bold-tf 28px)
  [1000.8, 55.1, "c", "1:52", "Stratum2 Bold TF", 28, 700, W, "HUD timer"],
  // the score digits are drawn semi-transparent: measured by hand, size from the CSS
  [978.1, 90.6, "c", "0", "Stratum2 Bold TF", 28, 700, CT, "HUD score"],
  [1021.8, 90.6, "c", "0", "Stratum2 Bold TF", 28, 700, T, "HUD score"],
  [981.2, 120.7, "c", "5", "Stratum2", 14, 700, "#d9dde3", "HUD player count"],
  [1027.8, 120.7, "c", "5", "Stratum2", 14, 700, "#f0dc9a", "HUD player count"],
  // bottom left
  [233.4, 1020.9, "l", "Voice Disabled", "Stratum2 Mono", 12, 400, W, "HUD voice status"],
  // money: a digit panel (one cell per character, measured 18.7 CSS px wide); the digits are semi-transparent, measured by hand
  [236.5, 1047.1, "l", "$1000", "Stratum2 Mono", 38, 700, GOLD, "HUD money", {bh: 36, cells: 18.7, ls: 0}],
  // bottom centre: health / ammo (hudhealthammocenter.css: hud-HA-large-font-size 42px, reserve 32px)
  [721.8, 1038.1, "c", "100", "Stratum2 Bold TF", 42, 700, GOLD, "HUD health", {ls: 1}],
  [1278.2, 1037.7, "c", "30", "Stratum2 Bold TF", 42, 700, GOLD, "HUD ammo"],
  [1336.8, 1035.7, "c", "3", "Stratum2 Bold TF", 32, 700, GOLD, "HUD ammo"],
  // right: weapon selection (the name is right-aligned with the weapon icons, slot numbers white)
  [1785.4, 774.5, "c", "1", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
  [1771.4, 829.9, "r", "StatTrak™ AK-47 | Red Laminate", "Stratum2 Medium", 14, 500, W, "HUD weapon list"],
  [1785.4, 853.3, "c", "2", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
  [1785.4, 932.2, "c", "3", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
  [1785.4, 1013.5, "c", "4", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
  [1608.1, 1013.5, "c", "5", "Stratum2 Mono", 14, 700, W, "HUD weapon list"],
];

// main menu items on the 1920x1080 background: positions measured in the calibration run (tools/cs2-calibrate.ps1,
// out/mainmenu.json), groups from the bit shots, fonts and sizes from the panorama styles. At 1920x1080 the tiles wrap and space
// their text differently than at 2560x1440 (no letter spacing on the tile descriptions).
const MAINMENU_ITEMS = [
    ...menuNav(),
    // counters under the icons of the right-hand bar: friends online (hidden in the measured run), streams, history
    ...friendCounts([[55.5, "91"], [1044.9, "20"], [1112.6, "14"]]),
    // mission tile (mission_tile.css): title and XP reward Stratum2 Medium Condensed 18px; mode/map and directive request "Stratum2"
    // (22px/32px, the main menu draws them at 19px/32px) and get a condensed face through font-stretch, so they belong to the
    // Stratum2 group (face = the face the game shows, for the stand-in only). Runs with a weight: bold and regular parts of one label.
    [26.6, 100.4, "l", "MISSION", "Stratum2 Medium Condensed", 18, 500, W, "Menu tiles"],
    [68.2, 100.4, "l", "Expires in 5 Days", "Stratum2", 11, 400, W, "Menu tiles", {runs: [["Expires in ", 11], ["5 Days", 11, null, 700]]}],
    [149.5, 135.3, "c", "COMPETITIVE on CACHE", "Stratum2", 19, 700, W, "Menu tiles", {face: "Stratum2 Bold Condensed", runs: [["COMPETITIVE ", 19], ["on", 19, null, 400], [" CACHE", 19]]}],
    [150.3, 171.7, "c", "18 ROUND WINS", "Stratum2", 32, 300, W, "Menu tiles", {face: "Stratum2 Light Condensed", runs: [["18 ", 32, null, 700], ["ROUND WINS", 32]]}],
    // progress marks in the diamonds (group measured with the bit shots)
    ...[[70.7, "5"], [133.5, "11"], [202.4, "18"]].map(([x, t]) => [x, 205.3, "c", t, "Stratum2 Condensed", 11, 400, W, "Menu tiles"]),
    [247.9, 207.1, "c", "1050 XP", "Stratum2 Medium Condensed", 18, 500, W, "Menu tiles"],
    [149.2, 477.2, "c", "PLAY", "Stratum2 Black", 12, 900, "#222", "Menu tiles", {ls: 7.5}],
    [149.5, 523.0, "c", "A new fast paced 3v3 mode", "Stratum2 Black Italic", 12, 900, "#222", "Menu tiles", {ls: 1, face: "Stratum2 Medium Italic"}],
    [31.8, 741.0, "l", "The Armory Pass", "Stratum2", 22, 500, "#6fe39a", "Menu tiles", {face: "Stratum2 Medium Italic"}],
    [30.7, 763.9, "l", "Get access to the new Arabesque and Spy", "Stratum2", 12, 500, W, "Menu tiles"],
    [30.7, 780.6, "l", "Tech Collections, The Fever Case and more.", "Stratum2", 12, 500, W, "Menu tiles"],
    [30.7, 849.8, "l", "NEW & POPULAR", "Stratum2 Medium Condensed", 18, 500, W, "Menu tiles"],
    // mainmenu_mini_store.css: "see all" button Stratum2 Light TF, item name Stratum2, price stratum-regular-tf green
    [114.1, 849.8, "l", "See All...", "Stratum2 Light TF", 12, 300, "#cbcbcb", "Menu tiles"],
    // store tile tags have no font class: the default font, which no group reaches (FIXED)
    [59.9, 872.1, "c", "StatTrak™", FIXED, 12, 700, W, "Menu tiles"],
    [246.4, 875.8, "c", "NEW!", FIXED, 14, 700, W, "Menu tiles"],
    [30.7, 1021.0, "l", "Music Kit | Starjunk 95, Industrial Sunset", "Stratum2", 12, 500, "#c5c5c5", "Menu tiles"],
    [30.7, 1037.6, "l", "Memories", "Stratum2", 12, 500, "#c5c5c5", "Menu tiles"],
    [30.7, 1054.8, "l", "4.39€ - 6.99€", "Stratum2 TF", 12, 900, "#18ea18", "Menu tiles"],
    // player name: clan tag in Stratum2 Light Condensed, name in Stratum2 Medium Condensed (bit shots)
    ...clanName(950.0, 779.5, "[(•●)", "spddl.de", W, "Stratum2 Medium Condensed", 20, 500, "Menu player card"),
    // Premier rating (rating_emblem.css: .rating__value = Stratum2 Black Italic, ".major" 18px before the comma, ".minor" 14px after it);
    // The game clips it at the right edge of the rating bar (clipR),
    // centres it in the bar (hbox = left, width) until it no longer fits, and places it by font metrics (vbox = top, height).
    [963.0, 958.6, "l", "18,434", "Stratum2 Black Italic", 18, 900, "#c9a0ff", "Menu player card", {runs: [["18", 18], [",434", 14]], clipR: 1010.8, vbox: [947.6, 26], hbox: [952.8, 59]}],
];
// store care package header, placed by hand with the row/column logic of the game (used in the measured store scene)
const CARE_PACKAGE = [
    // rankup_redemption_store.css: .rrs__title Stratum2 Condensed 60px uppercase, shrunk to at most 420px;
    // title and banner sit in a right-aligned column as wide as its widest child (col: right edge, banner width; measured with two fonts),
    // frame badges Stratum2 medium 20px uppercase (drawn at 18px: checked with the original font against the game),
    // .rrs__desc stratum-regular-tf 16px rgb(238,184,118)
    [1411, 176, "c", "Weekly Care Package", "Stratum2 Condensed", 60, 400, W, "Store care package", {up: 1, shrink: 420, col: [1600, 377]}],
    [1411, 245, "c", "Weekly Rewards Claimed", "Stratum2", 18, 500, W, "Store care package", {up: 1}],
    [1255, 284, "l", "You will receive a new Care Package when you", "Stratum2 TF", 16, 400, "#eab574", "Store care package"],
    [1255, 303, "l", "earn your next XP Rank.", "Stratum2 TF", 16, 400, "#eab574", "Store care package"],
];

// console log of a real session (the colours are the game's own, measured)
const CONSOLE_LOG = [
      ["[Host] HO:  IGameSystem::LoopActivateAllSystems {", "#00b5ff"],
      ["[Host] HO:  } IGameSystem::LoopActivateAllSystems done", "#00b5ff"],
      ["[Server] SV:  } IGameSystem::LoopActivateAllSystems done", "#97c9ff"],
      ["[Server] SV:  1 player server started", "#97c9ff"],
      ["[Client] CL:  IGameSystem::LoopActivateAllSystems {", "#b5ff00"],
      ["[Client] CL:  } IGameSystem::LoopActivateAllSystems done", "#b5ff00"],
      ["[SignonState] CL:  CNetworkGameClient::OnSwitchLoopModeFinished( game : success )", "#ff9733"],
      ["[Prediction] Added prediction for player slot 0 (spddl.de)", "#daf875"],
      ["[Prediction] Scanned 84 entities, activated prediction for 1, total predictable entities now 1", "#daf875"],
      ["[SplitScreen] Writing configuration for slot 0", "#ab8df6"],
      ["[SplitScreen] Saved 'cs2_user_keys.vcfg' to SteamRemoteStorage, 2172 bytes OK", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_keys_0_slot0.vcfg': type 1", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_keys_0_slot0.vcfg_lastclouded': type 3", "#ab8df6"],
      ["[SplitScreen] Saved 'cs2_user_convars.vcfg' to SteamRemoteStorage, 3262 bytes OK", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_convars_0_slot0.vcfg': type 1", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_convars_0_slot0.vcfg_lastclouded': type 3", "#ab8df6"],
      ["[RenderSystem] Resizing VBPool from 8.39 MB -> 33.55 MB", "#fff"],
      ["Named camera 'cam_default' not found in map 'ui/xpshop_item'", "#ffff00"],
      ["[SteamNetSockets] Ping measurement completed in 5.4s.  Relays: 25 valid, 9 great, 10 good+, 17 ok+, 19 ignored", "#fff"],
      ["[SteamNetSockets] Ping location: dfra=8+0,fra=8+0/9+0,ams=12+1,waw=15+1,par=19+1/17+0,lhr=21+2/17+1,dlhr=/18+1,dvie=19+1,vie=83+8/20+0,iad=106+10/94+0,sea=160+16/147+0", "#fff"],
      ["[SteamNetSockets] SDR RelayNetworkStatus:  avail=OK  config=OK  anyrelay=OK   (OK.  Relays: 25 valid, 9 great, 10 good+, 17 ok+, 19 ignored)", "#fff"],
      ["[SplitScreen] Writing configuration for slot 0", "#ab8df6"],
      ["[SplitScreen] Saved 'cs2_user_keys.vcfg' to SteamRemoteStorage, 2172 bytes OK", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_keys_0_slot0.vcfg': type 1", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_keys_0_slot0.vcfg_lastclouded': type 3", "#ab8df6"],
      ["[SplitScreen] Saved 'cs2_user_convars.vcfg' to SteamRemoteStorage, 3262 bytes OK", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_convars_0_slot0.vcfg': type 1", "#ab8df6"],
      ["[SplitScreen] Saved user config file 'cfg/cs2_user_convars_0_slot0.vcfg_lastclouded': type 3", "#ab8df6"],
];

const SCENES = [
  {id: "ingame", name: "In game", img: "scenes/ingame.jpg", items: [
    ...HUD,
    // win panel (hudwinpanel.css .WinPanel__Result__Title: Stratum2 Medium Condensed bold, letter-spacing 8px; the panel is drawn
    // smaller, so 52px measured instead of 64px), below it the round's highlight in white
    [1000.4, 230.4, "c", "ROUND WON", "Stratum2 Medium Condensed", 52, 700, "#eabf55", "HUD win panel", {ls: 8}],
    [1000.8, 268.7, "c", "spddl.de killed 3 enemies with headshots that round.", "Stratum2", 12, 400, W, "HUD win panel", {ls: 1}],
    // alert at the bottom (stratum-medium-tf 18px), centred in its bar
    [1000.7, 890.1, "c", "MATCH START", "Stratum2 Medium TF", 18, 500, W, "HUD notices"],
    // the place name under the radar (hudradar.xml #DashboardLabel; class stratum-medium, but measured in the game it is drawn
    // in the notosans group; semi-transparent too, measured by hand)
    [356.6, 452.8, "c", "Bombsite B", "notosans", 22, 500, "#eec35e", "HUD location name"],
    // chat: one label, several colours on one baseline
    [215.6, 908.4, "l", "[T] Sam @ Upper Tunnel: Molotov!", "Stratum2", 16, 500, "#ffdf94", "HUD chat", {runs: [["[T] Sam ", 16], ["@ Upper Tunnel", 16, "#41ff41"], [": ", 16, W], ["Molotov!", 16, "#e4af3a"]]}],
    [215.6, 933.4, "l", "[T] spddl.de @ T Spawn: HE Grenade!", "Stratum2", 16, 500, "#ffdf94", "HUD chat", {runs: [["[T] spddl.de ", 16], ["@ T Spawn", 16, "#41ff41"], [": ", 16, W], ["HE Grenade!", 16, "#eb4c4c"]], ls: 0.5}],
    [209.6, 956.1, "l", "+$150 for neutralizing an enemy with the AK-47", "Stratum2", 16, 500, "#a3ff48", "HUD chat", {runs: [["+$150 ", 16], ["for neutralizing an enemy with the AK-47", 16, W]], ls: 1}],
  ]},
  {id: "scoreboard", name: "Scoreboard", img: "scenes/scoreboard.jpg", items: [
    ...HUD,
    // the board in the background sits 14 px (title, CT) and 3 px (T) higher than in the measured shot: the items are shifted to it
    [563.8, 348.8, "l", "Casual | Dust II", "Stratum2 Condensed", 22, 400, "#818181", "Scoreboard title"],
    [556.2, 385.5, "l", "New Beat Fund, Sponge Fingerz", "Stratum2 Condensed", 17, 400, "#818181", "Scoreboard title"],
    [1416.8, 346.5, "r", "0:12", "Stratum2 Mono", 17, 400, "#818181", "Scoreboard title"],
    // column titles, centred over their column
    [1120.4, 426.1, "c", "Money", "Stratum2 Condensed", 17, 400, "#ccc", "Scoreboard header"],
    [1181.7, 426.1, "c", "Kills", "Stratum2 Condensed", 17, 400, "#ccc", "Scoreboard header"],
    [1234.0, 426.1, "c", "Deaths", "Stratum2 Condensed", 17, 400, "#ccc", "Scoreboard header"],
    [1286.8, 426.1, "c", "Assists", "Stratum2 Condensed", 17, 400, "#ccc", "Scoreboard header"],
    [1338.7, 426.1, "c", "MVPs", "Stratum2 Condensed", 17, 400, "#ccc", "Scoreboard header"],
    [1390.8, 426.1, "c", "Score", "Stratum2 Condensed", 17, 400, "#ccc", "Scoreboard header"],
    // team CT: the score centred on the logo, name and alive count below
    [563.5, 477.7, "c", "0", "Stratum2 Black Condensed", 72, 900, CT, "Scoreboard team score"],
    [562.9, 533.9, "c", "COUNTER-", "Stratum2 Condensed", 19, 400, CT, "Scoreboard team name", {ls: 0.5}],
    [563.2, 558.1, "c", "TERRORISTS", "Stratum2 Condensed", 19, 400, CT, "Scoreboard team name", {ls: 0.5}],
    [563.5, 585.4, "c", "Alive: 5/5", "Stratum2 Condensed", 19, 400, "#56636e", "Scoreboard team name"],
    // CT rows: the clan tag in Stratum2 Light Condensed, the name after it in Stratum2 Medium (both measured with the bit shots)
    ...clanName(747.0, 448.8, "[BOT]", "Azul", CT),
    ...clanName(747.0, 475.3, "[BOT]", "Miguel", CT),
    ...clanName(747.0, 501.9, "[BOT]", "Niles", CT),
    ...clanName(747.0, 528.4, "[BOT]", "Pines", CT),
    ...clanName(747.0, 555.0, "[BOT]", "Telsen", CT),
    [1181.7, 448.8, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1234.0, 448.8, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1286.5, 448.8, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1391.2, 448.8, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1181.7, 475.3, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1234.0, 475.3, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1286.5, 475.3, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1391.2, 475.3, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1181.7, 501.9, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1234.0, 501.9, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1286.5, 501.9, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1391.2, 501.9, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1181.7, 528.4, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1234.0, 528.4, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1286.5, 528.4, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1391.2, 528.4, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1181.7, 555.0, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1234.0, 555.0, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1286.5, 555.0, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    [1391.2, 555.0, "c", "0", "Stratum2 Mono", 17, 400, CT, "Scoreboard player row"],
    // team T
    [563.5, 675.3, "c", "0", "Stratum2 Black Condensed", 72, 900, T, "Scoreboard team score"],
    [564.0, 731.5, "c", "TERRORISTS", "Stratum2 Condensed", 19, 400, T, "Scoreboard team name", {ls: 0.5}],
    [563.5, 758.9, "c", "Alive: 5/5", "Stratum2 Condensed", 19, 400, "#675c3f", "Scoreboard team name"],
    // T rows: money right-aligned in its column
    ...clanName(747.0, 646.4, "[(•●)", "spddl.de", T),
    ...clanName(747.0, 673.0, "[BOT]", "Maru", T),
    ...clanName(747.0, 699.5, "[BOT]", "Mayer", T),
    ...clanName(747.0, 726.1, "[BOT]", "Adonis", T),
    ...clanName(747.0, 752.6, "[BOT]", "Yanni", T),
    [1147.9, 646.4, "r", "$6700", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1147.9, 673.0, "r", "$7000", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1147.9, 699.5, "r", "$8350", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1147.9, 726.1, "r", "$7350", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1147.9, 752.6, "r", "$7000", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1181.7, 646.4, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1234.0, 646.4, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1286.5, 646.4, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1391.2, 646.4, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1181.7, 673.0, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1234.0, 673.0, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1286.5, 673.0, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1391.2, 673.0, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1181.7, 699.5, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1234.0, 699.5, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1286.5, 699.5, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1391.2, 699.5, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1181.7, 726.1, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1234.0, 726.1, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1286.5, 726.1, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1391.2, 726.1, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1181.7, 752.6, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1234.0, 752.6, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1286.5, 752.6, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1391.2, 752.6, "c", "0", "Stratum2 Mono", 17, 400, T, "Scoreboard player row"],
    [1467.8, 838.2, "r", "[MOUSE2] Enable Cursor", "Stratum2", 11, 700, "#656565", "Scoreboard hint"],
  ]},
  // Scenes from screenshots without reference text (test2, 2560x1440): x/y measured from the boxes in the image,
  // font, size and weight from the panorama styles named in the comments. Not yet calibrated against a screenshot with text.
  {id: "killfeed", name: "Killfeed", img: "scenes/ingame_killfeed.jpg", items: [
    ...HUD.filter(it => /^HUD (voice status|money|health)$/.test(it[8])),   // knife drawn: no ammo
    // slot numbers of the weapon list: the icons sit where they are in the HUD scene; no bomb, so no slot 5
    ...HUD.filter(it => it[8] === "HUD weapon list" && /^[1-4]$/.test(it[3])),
    // team counter 5v5 (hudteamcounter.css): timer and scores stratum-bold-tf 28px
    [1000.8, 55.1, "c", "1:42", "Stratum2 Bold TF", 28, 700, W, "HUD timer"],
    [978.1, 90.6, "c", "4", "Stratum2 Bold TF", 28, 700, CT, "HUD score"],
    [1021.8, 90.6, "c", "7", "Stratum2 Bold TF", 28, 700, T, "HUD score"],
    [981.2, 120.7, "c", "4", "Stratum2", 14, 700, "#d9dde3", "HUD player count"],
    [1027.8, 120.7, "c", "4", "Stratum2", 14, 700, "#f0dc9a", "HUD player count"],
    // own team: letter (stratum-regular-condensed) and health (stratum-bold-mono, black on the bar); card 3 is dead
    ...[[0, "Y"], [1, "B"], [3, "P"], [4, "O"]].flatMap(([i, l]) => [
      [1056 + 60 * i, 49, "c", l, "Stratum2 Condensed", 11, 400, W, "HUD player card"],
      [1050 + 60 * i, 106, "l", "100", "Stratum2 Mono", 14, 700, "#000", "HUD player card"],
    ]),
    [357, 453, "c", "T Spawn", "notosans", 22, 500, "#f0e0a8", "HUD location name"],
    // hudalerts.css (y 120px) and hudhinttext.css low priority (y 236px): stratum-medium-tf 18px, alert-width 300px.
    // The warmup alert is the exception: its text is wrapped in .MatchStartAlert (Stratum2 medium, set by the game code,
    // not in any layout); checked in game, replacing Stratum2 Medium TF leaves "Warmup" unchanged
    [999, 768, "c", "Warmup", "Stratum2", 18, 500, W, "HUD notices", {bw: 400, bh: 24}],
    [1001, 887, "c", "Press B to buy weapons", "Stratum2 Medium TF", 18, 500, W, "HUD hint"],
    [1001, 910, "c", "Buy time ends in 0:20", "Stratum2 Medium TF", 18, 500, W, "HUD hint"],
    // huddeathnotice.css: Label.stratum-bold 16px (measured in the game: cap height 10 px at 1080p = 16px); killer left of the
    // weapon icon, victim right of it; bots carry the clan tag [BOT] in Stratum2 Light Condensed
    ...clanNameR(1612, 129, "[BOT]", "Valentin", CT), ...clanName(1684, 129, "[BOT]", "Reinhold", T, "Stratum2", 16, 700, "HUD killfeed"),
    ...clanNameR(1600, 164, "[BOT]", "Leopold", T), ...clanName(1692, 164, "[BOT]", "Theodor", CT, "Stratum2", 16, 700, "HUD killfeed"),
    ...clanNameR(1612, 199, "[BOT]", "Valentin", CT), ...clanName(1684, 199, "[BOT]", "Clemens", T, "Stratum2", 16, 700, "HUD killfeed"),
  ]},
  {id: "watch", name: "Watch", img: "scenes/watch.jpg", items: [
    ...menuNav(),
    ...friendCounts([[202, "37"], [1046, "9"]]),   // the friends bar is expanded here, so its icons sit lower
    // mainmenu.css .content-navbar__tabs__btn Label: Stratum2 16px medium, uppercase; the selected tab in selectedNavColor.
    // Laid out like the store tabs; the selected tab's box was removed from the background (it was 108 units wide, so
    // "Your Matches" is 92.6 wide), the other widths are estimated from it
    ...[["Your Matches", NAV, 92.6], ["Downloaded", W, 77.6], ["Majors", W, 45.0]]
      .map(([t, c, ow]) => [1000, 91, "c", t, "Stratum2", 16, 500, c, "Watch tabs",
        {up: 1, row: "watchtabs", ow, ...(c === NAV ? {chip: [79, 25.6, 7.7, "#2c4d5e"]} : {})}]),
    // match list (matchtile.css): .MatchInfo__Score stratum2 29px bold in team colours; the rest has no font class:
    // the default font, which no group reaches (FIXED)
    // the score sits level with the mode icon, date and result below it (on victories next to the trophy, which sits higher without text), the map name under the map icon
    ...[[159, 9, 13, "3 October 2026, 00:03", "Loss", "Cache"],
        [280, 11, 13, "2 October 2026, 23:10", "Loss", "Dust II"],
        [398, 14, 16, "18 September 2026, 23:46", "Loss", "Inferno"],
        [514, 13, 5, "18 September 2026, 23:10", "Victory", "Nuke"],
        [632, 13, 9, "18 September 2026, 22:17", "Victory", "Inferno"],
        [751, 15, 15, "18 September 2026, 21:18", "Tied", "Inferno"]]
      .flatMap(([y, ct, t, date, result, map]) => [
        [180, y, "l", `${ct} · ${t}`, "Stratum2", 29, 700, W, "Watch match list", {runs: [[String(ct), 29, CT], [" · ", 29, W], [String(t), 29, T]]}],
        [result === "Victory" ? 161 : 143, y + 28, "l", date, FIXED, 12, 400, W, "Watch match list"],
        [result === "Victory" ? 161 : 143, y + 54, "l", result, FIXED, 12, 400, W, "Watch match list"],
        [75, y + 57, "c", map, FIXED, 12, 400, W, "Watch match list"],
      ]),
    // Everything in .mi-sb-main (meta labels, team boxes, player rows) is drawn at ui-scale 120% (matchinfo.css, 16:9),
    // hence the sizes x 1.2 (checked against a screenshot with a script font).
    // matchinfo.css .mi-meta__labels: bold title over the value, columns flow right with margin-right 70px; the last column
    // wraps when it reaches the edge of the scoreboard. matchinfo_scoreboard.css sets Label to Stratum2
    ...[["Map", "Cache"], ["Duration", "33 Minutes"], ["Date", "3 October 2026, 00:03"]].flatMap(([k, v], i) => [
      [1004, 217, "l", k, "Stratum2", 21.6, 700, "#ccc", "Watch match info", {flow: "mimeta", fcol: i}],
      [1004, 244, "l", v, "Stratum2", 21.6, 300, "#ccc", "Watch match info", {flow: "mimeta", fcol: i}],
    ]),
    ...[[1399, "K"], [1449, "A"], [1499, "D"], [1612, "Score"]].map(([x, t]) => [x, 300, "c", t, "Stratum2", 21.6, 300, "#747474", "Watch scoreboard"]),
    // .sb-team__info__score Label 70px bolder (shrunk to its box, so not larger with the ui-scale), .sb-team__info__name 12px
    // uppercase, both in team colour
    [781, 380, "c", "9", "Stratum2", 70, 800, CT, "Watch team score"],
    [781, 596, "c", "13", "Stratum2", 70, 800, T, "Watch team score"],
    [781, 440, "c", "Counter-", "Stratum2", 14.4, 400, CT, "Watch team score", {up: 1}],
    [781, 457, "c", "Terrorists", "Stratum2", 14.4, 400, CT, "Watch team score", {up: 1}],
    [781, 537, "c", "Terrorists", "Stratum2", 14.4, 400, T, "Watch team score", {up: 1}],
    // .sb-row__cell Label: Stratum2 Regular Monodigit 18px, tinted in the team colour (sb-team-tint, about 80 % bright), but
    // .sb-row__cell--name Label is plain Stratum2; the MVP count sits small at the top right of the star
    ...[[332, CT_DIM, "spddl.de", 17, 4, 14, 2, 50], [365, CT_DIM, "Make me Laugh", 18, 6, 18, 3, 43], [397, CT_DIM, "L33t B0t", 16, 5, 18, 2, 39],
        [431, CT_DIM, "U're Dead", 13, 3, 18, 1, 39], [464, CT_DIM, "Make my Day", 12, 5, 16, 1, 31],
        [521, T_DIM, "Fuzzy Logic", 28, 3, 16, 4, 65], [555, T_DIM, "Kugelfang", 16, 8, 16, 2, 44], [587, T_DIM, "Funky Byte", 15, 8, 14, 2, 41],
        [620, T_DIM, "Zap!", 15, 4, 16, 4, 36], [653, T_DIM, "Rambotnic", 9, 4, 14, 1, 33]]
      .flatMap(([y, c, name, k, a, d, mvp, score]) => [
        [881, y, "l", name, "Stratum2", 21.6, 400, c, "Watch scoreboard"],
        ...[[1399, k], [1449, a], [1499, d], [1612, score]].map(([x, v]) => [x, y, "c", String(v), "Stratum2 Regular Monodigit", 21.6, 400, c, "Watch scoreboard"]),
        [1561, y - 9, "l", String(mvp), "Stratum2 Regular Monodigit", 12, 400, c, "Watch scoreboard"],
      ]),
    // round data (outside .mi-sb-main, no ui-scale): no font-size in the styles, measured 18px title and 16px ticks
    [1188, 776, "c", "spddl.de's Round Performance", "Stratum2", 18, 400, "#ccc", "Watch round data"],
    ...[[828, "1"], [923, "4"], [1047, "8"], [1195, "<>"], [1296, "16"], [1423, "20"], [1547, "24"]].map(([x, t]) => [x, 976, "c", t, "Stratum2", 16, 400, "#b4b4b4", "Watch round data"]),
    // csgostyles.css .PopupButton Label: stratum2Font 24px medium, uppercase (greyed out here)
    [1766, 1075, "c", "Download", "Stratum2", 24, 500, "#838383", "Watch buttons", {up: 1}],
  ]},
];
