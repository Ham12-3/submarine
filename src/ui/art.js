// SVG artwork for the fleet carousel (technical blueprints) and the heritage cards.

const dimLine = (x1, x2, label) => `
  <line x1="${x1}" y1="130" x2="${x2}" y2="130" class="bp"/>
  <line x1="${x1}" y1="126" x2="${x1}" y2="134" class="bp"/>
  <line x1="${x2}" y1="126" x2="${x2}" y2="134" class="bp"/>
  <text x="${(x1 + x2) / 2}" y="143" text-anchor="middle">${label}</text>`;

const callout = (x1, y1, x2, y2, label, anchor = 'start') => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="bp-dim"/>
  <circle cx="${x1}" cy="${y1}" r="1.6" class="bp-hot"/>
  <text x="${x2 + (anchor === 'start' ? 2 : -2)}" y="${y2 - 2}" text-anchor="${anchor}">${label}</text>`;

const blueprint = (inner) => `
  <svg class="card__art" viewBox="0 0 200 150" aria-hidden="true">
    <line x1="4" y1="75" x2="196" y2="75" class="bp-dim"/>
    ${inner}
  </svg>`;

export const VEHICLES = [
  {
    name: 'Abyss-11',
    tag: 'CREWED · FULL OCEAN DEPTH',
    desc: 'Our flagship two-person submersible. A 90 mm forged titanium sphere, eighteen vectored thrusters and 96 hours of emergency life support take a pilot and a scientist to the bottom of any trench on Earth — and home the same day.',
    specs: [
      ['DEPTH', '11,000 M'],
      ['CREW', '2'],
      ['DIVE', '16 H'],
    ],
    art: blueprint(`
      <path class="bp" d="M20 75 C24 67 38 59 60 57 L150 57 C170 57 184 65 186 75 C184 85 170 93 150 93 L60 93 C38 91 24 83 20 75 Z"/>
      <path class="bp" d="M112 57 L115 37 Q116 34 120 34 L136 34 Q140 34 141 37 L143 57"/>
      <line class="bp" x1="130" y1="45" x2="152" y2="45"/>
      <path class="bp" d="M40 64 L30 46 L22 48 L27 66"/>
      <path class="bp" d="M40 86 L30 104 L22 102 L27 84"/>
      <rect class="bp" x="9" y="66" width="12" height="18" rx="2"/>
      <circle class="bp-fill" cx="158" cy="75" r="13"/>
      <circle class="bp-dim" cx="158" cy="75" r="17"/>
      <line class="bp-dim" x1="58" y1="64" x2="138" y2="64"/>
      <line class="bp-dim" x1="58" y1="86" x2="138" y2="86"/>
      <circle class="bp-hot" cx="178" cy="86" r="2.4"/>
      <path class="bp-hot" d="M181 86 L197 92 M181 86 L197 81"/>
      ${callout(158, 62, 166, 18, 'Ti SPHERE Ø2.1')}
      ${callout(126, 36, 96, 18, 'SAIL', 'end')}
      ${dimLine(20, 186, 'LOA 11.8 M')}`),
  },
  {
    name: 'Pelagic-3',
    tag: 'CREWED · TWILIGHT ZONE',
    desc: 'A two-metre acrylic sphere with near-perfect optical clarity. Built for film crews, researchers and private expeditions to the mesopelagic, where bioluminescence outnumbers sunlight.',
    specs: [
      ['DEPTH', '1,000 M'],
      ['CREW', '3'],
      ['DIVE', '10 H'],
    ],
    art: blueprint(`
      <circle class="bp-fill" cx="130" cy="72" r="32"/>
      <circle class="bp-dim" cx="130" cy="72" r="26"/>
      <path class="bp" d="M44 50 h50 a9 9 0 0 1 0 18 h-50 a9 9 0 0 1 0 -18 Z"/>
      <path class="bp" d="M44 78 h50 a9 9 0 0 1 0 18 h-50 a9 9 0 0 1 0 -18 Z"/>
      <path class="bp" d="M34 110 L172 110 M58 96 L54 110 M118 102 L122 110 M150 100 L156 110"/>
      <rect class="bp" x="20" y="54" width="16" height="11" rx="3"/>
      <rect class="bp" x="20" y="82" width="16" height="11" rx="3"/>
      <path class="bp" d="M103 59 L99 59 M103 87 L99 87"/>
      <path class="bp-hot" d="M114 84 q6 -11 12 0 M130 76 q6 -11 12 0"/>
      ${callout(152, 50, 166, 20, 'ACRYLIC Ø2.0')}
      ${callout(70, 59, 52, 24, 'VBT', 'end')}
      ${dimLine(20, 162, 'LOA 6.4 M')}`),
  },
  {
    name: 'Sentinel',
    tag: 'AUTONOMOUS · SURVEY AUV',
    desc: 'A hover-capable autonomous vehicle that maps the seafloor at centimetre resolution with synthetic-aperture sonar, laser scanning and water-column sampling — for days at a time, without a crew.',
    specs: [
      ['DEPTH', '6,000 M'],
      ['CREW', '0'],
      ['ENDUR.', '72 H'],
    ],
    art: blueprint(`
      <path class="bp" d="M18 75 C22 69 30 66 42 66 L162 66 C178 66 188 70 190 75 C188 80 178 84 162 84 L42 84 C30 84 22 81 18 75 Z"/>
      <path class="bp" d="M36 66 L28 54 L22 56 L27 66"/>
      <path class="bp" d="M36 84 L28 96 L22 94 L27 84"/>
      <rect class="bp" x="8" y="69" width="10" height="12" rx="2"/>
      <rect class="bp-fill" x="118" y="66" width="34" height="18"/>
      <line class="bp" x1="80" y1="66" x2="80" y2="50"/>
      <circle class="bp-hot" cx="80" cy="49" r="2"/>
      <path class="bp-dim" d="M135 84 L116 118 M135 84 L154 118 M116 118 Q135 124 154 118"/>
      ${callout(135, 66, 150, 26, 'SAS ARRAY')}
      ${callout(80, 49, 60, 26, 'GNSS', 'end')}
      ${dimLine(18, 190, 'LOA 6.2 M')}`),
  },
  {
    name: 'Hadal Lander',
    tag: 'UNCREWED · SEAFLOOR OBSERVATORY',
    desc: 'A free-falling observatory that sits on the trench floor for months, recording video, chemistry and sound until an acoustic command releases its ballast for the long climb home.',
    specs: [
      ['DEPTH', '11,000 M'],
      ['CREW', '0'],
      ['DEPLOY', '6 MO'],
    ],
    art: blueprint(`
      <circle class="bp" cx="72" cy="34" r="12"/>
      <circle class="bp" cx="100" cy="30" r="12"/>
      <circle class="bp" cx="128" cy="34" r="12"/>
      <line class="bp" x1="100" y1="18" x2="100" y2="6"/>
      <path class="bp" d="M58 48 L142 48 L152 106 L48 106 Z"/>
      <path class="bp-dim" d="M58 48 L152 106 M142 48 L48 106"/>
      <rect class="bp-fill" x="86" y="62" width="28" height="22" rx="3"/>
      <circle class="bp-hot" cx="100" cy="73" r="5"/>
      <path class="bp" d="M42 106 h20 v8 h-20 Z M138 106 h20 v8 h-20 Z"/>
      ${callout(128, 34, 160, 16, 'GLASS FLOATS')}
      ${callout(100, 73, 162, 74, 'CAM / CTD')}
      ${dimLine(42, 158, 'W 3.4 M')}`),
  },
  {
    name: 'Atlas DSRV',
    tag: 'CREWED · SUBMARINE RESCUE',
    desc: "A deep-submergence rescue vehicle that mates with a disabled submarine's escape hatch at angles up to 45°, transferring survivors under pressure through three linked compartments.",
    specs: [
      ['DEPTH', '600 M'],
      ['CREW', '3 + 24'],
      ['DIVE', '12 H'],
    ],
    art: blueprint(`
      <path class="bp" d="M28 70 C28 55 42 48 62 48 L146 48 C166 48 178 58 178 70 C178 82 166 90 146 90 L62 90 C42 90 28 85 28 70 Z"/>
      <path class="bp-fill" d="M92 90 L86 110 L124 110 L118 90"/>
      <rect class="bp" x="14" y="61" width="14" height="18" rx="2"/>
      <circle class="bp-dim" cx="70" cy="69" r="15"/>
      <circle class="bp-dim" cx="105" cy="69" r="15"/>
      <circle class="bp-dim" cx="140" cy="69" r="15"/>
      <path class="bp" d="M112 48 L114 40 L132 40 L134 48"/>
      <circle class="bp-hot" cx="172" cy="80" r="2.4"/>
      ${callout(105, 110, 150, 120, 'SKIRT ±45°')}
      ${callout(70, 69, 50, 26, 'CREW', 'end')}
      ${dimLine(14, 178, 'LOA 15.0 M')}`),
  },
];

// ── Heritage cards ─────────────────────────────────────────────

const C = '#f26e4e';
const glow = 'rgba(255,196,160,0.7)';
const hull = '#0b1b28';

const scene = (id, inner) => `
  <svg viewBox="0 0 160 200" aria-hidden="true">
    <defs>
      <linearGradient id="hg${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1c5470"/>
        <stop offset="0.5" stop-color="#0a2238"/>
        <stop offset="1" stop-color="#030c16"/>
      </linearGradient>
      <radialGradient id="hl${id}" cx="0.5" cy="0.6" r="0.5">
        <stop offset="0" stop-color="rgba(242,110,78,0.28)"/>
        <stop offset="1" stop-color="rgba(242,110,78,0)"/>
      </radialGradient>
    </defs>
    <rect width="160" height="200" fill="url(#hg${id})"/>
    <path d="M26 0 L46 0 L92 200 L58 200 Z" fill="rgba(170,220,255,0.07)"/>
    <path d="M92 0 L104 0 L134 200 L110 200 Z" fill="rgba(170,220,255,0.05)"/>
    <rect width="160" height="200" fill="url(#hl${id})"/>
    ${inner}
    <g fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.7">
      <circle cx="122" cy="42" r="2.4"/><circle cx="128" cy="30" r="1.6"/><circle cx="118" cy="20" r="1.2"/>
      <circle cx="36" cy="150" r="1.8"/><circle cx="30" cy="138" r="1.2"/>
    </g>
  </svg>`;

export const HERITAGE = [
  {
    year: '1934',
    title: 'BATHYSPHERE',
    note: '923 M — FIRST DEEP-SEA OBSERVATION',
    pos: [14, 9],
    depth: 0.7,
    art: (id) =>
      scene(
        id,
        `<line x1="80" y1="0" x2="80" y2="70" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
         <rect x="72" y="64" width="16" height="8" fill="${hull}" stroke="${C}"/>
         <circle cx="80" cy="106" r="34" fill="${hull}" stroke="${C}" stroke-width="1.5"/>
         <circle cx="68" cy="100" r="6" fill="${glow}" stroke="#fff" stroke-width=".8"/>
         <circle cx="92" cy="100" r="6" fill="${glow}" stroke="#fff" stroke-width=".8"/>
         <circle cx="80" cy="122" r="5" fill="none" stroke="#fff" stroke-width=".8"/>
         <path d="M46 106 h-8 M114 106 h8" stroke="${C}"/>`,
      ),
  },
  {
    year: '1960',
    title: 'TRIESTE',
    note: '10,916 M — CHALLENGER DEEP',
    pos: [64, 5],
    depth: 1.1,
    art: (id) =>
      scene(
        id,
        `<path d="M20 86 C20 74 32 70 50 70 L118 70 C134 70 142 76 142 86 C142 96 134 100 118 100 L50 100 C32 100 20 96 20 86 Z" fill="${hull}" stroke="${C}" stroke-width="1.5"/>
         <path d="M70 70 L72 56 L90 56 L92 70" fill="${hull}" stroke="${C}"/>
         <line x1="81" y1="100" x2="81" y2="112" stroke="${C}"/>
         <circle cx="81" cy="128" r="15" fill="${hull}" stroke="#fff" stroke-width="1"/>
         <circle cx="75" cy="126" r="3.5" fill="${glow}"/>
         <path d="M32 100 v10 M130 100 v10" stroke="rgba(255,255,255,.5)"/>`,
      ),
  },
  {
    year: '1964',
    title: 'ALVIN',
    note: 'COMMISSIONED — STILL DIVING',
    pos: [80, 40],
    depth: 0.5,
    art: (id) =>
      scene(
        id,
        `<path d="M26 112 C26 98 40 92 58 92 L110 92 C126 92 136 102 136 112 C136 122 126 130 110 130 L58 130 C40 130 26 124 26 112 Z" fill="#dfe5ea" stroke="#fff"/>
         <path d="M62 92 L66 76 L90 76 L94 92 Z" fill="${C}"/>
         <circle cx="122" cy="118" r="4" fill="${glow}" stroke="${hull}"/>
         <path d="M128 124 L146 132 L152 126" stroke="#fff" fill="none" stroke-width="1.4"/>
         <rect x="96" y="130" width="26" height="8" fill="none" stroke="#fff" stroke-width=".8"/>
         <rect x="14" y="104" width="12" height="14" rx="2" fill="${hull}" stroke="#fff" stroke-width=".8"/>`,
      ),
  },
  {
    year: '2012',
    title: 'DEEPSEA CHALLENGER',
    note: '10,908 M — SOLO DESCENT',
    pos: [5, 54],
    depth: 0.95,
    art: (id) =>
      scene(
        id,
        `<path d="M80 28 C93 28 99 44 99 60 L99 138 C99 150 91 156 80 156 C69 156 61 150 61 138 L61 60 C61 44 67 28 80 28 Z" fill="${hull}" stroke="${C}" stroke-width="1.5"/>
         <circle cx="80" cy="146" r="12" fill="${hull}" stroke="#fff"/>
         <circle cx="80" cy="146" r="4" fill="${glow}"/>
         <path d="M99 70 L128 58 M61 70 L32 58" stroke="#fff" stroke-width="1"/>
         <circle cx="128" cy="58" r="3" fill="${glow}"/><circle cx="32" cy="58" r="3" fill="${glow}"/>
         <path d="M68 40 h24" stroke="${C}"/>`,
      ),
  },
  {
    year: '2019',
    title: 'LIMITING FACTOR',
    note: 'ALL FIVE OCEAN DEEPS',
    pos: [60, 72],
    depth: 0.75,
    art: (id) =>
      scene(
        id,
        `<path d="M24 98 L116 98 L134 110 L134 132 L24 132 Z" fill="${hull}" stroke="${C}" stroke-width="1.5"/>
         <rect x="40" y="84" width="60" height="14" fill="${hull}" stroke="${C}"/>
         <circle cx="114" cy="118" r="9" fill="${glow}" stroke="#fff"/>
         <rect x="12" y="104" width="12" height="10" rx="2" fill="none" stroke="#fff" stroke-width=".8"/>
         <rect x="12" y="118" width="12" height="10" rx="2" fill="none" stroke="#fff" stroke-width=".8"/>
         <path d="M40 140 h80" stroke="rgba(255,255,255,.5)"/>`,
      ),
  },
];
