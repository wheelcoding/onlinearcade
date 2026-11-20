import type { GameDefinition } from "../lib/catalog";
export default function GameArtwork({ game }: { game: GameDefinition }) {
  const kind = game.art;
  const id = "art-" + game.id;
  return (
    <svg
      className="game-artwork"
      viewBox="0 0 640 400"
      role="img"
      aria-label={`${game.title} original game artwork`}
    >
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop
            stopColor={
              kind === "racing"
                ? "#ef8374"
                : kind === "tiles"
                  ? "#213d51"
                  : kind === "cloud"
                    ? "#5d9fa9"
                    : "#181537"
            }
          />
          <stop
            offset="1"
            stopColor={
              kind === "racing"
                ? "#613969"
                : kind === "prism"
                  ? "#48408a"
                  : "#111324"
            }
          />
        </linearGradient>
        <radialGradient id={id + "glow"}>
          <stop
            stopColor={kind === "space" ? "#716afa" : "#ffa781"}
            stopOpacity=".65"
          />
          <stop offset="1" stopColor="#15152f" stopOpacity="0" />
        </radialGradient>
        <filter id={id + "blur"}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="640" height="400" fill={`url(#${id})`} />
      <ellipse cx="410" cy="160" rx="260" ry="220" fill={`url(#${id}glow)`} />
      {Array.from({ length: 35 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 173 + 35) % 640}
          cy={(i * 97 + 10) % 320}
          r={i % 4 === 0 ? 2 : 1}
          fill="#f7e3d0"
          opacity={0.2 + (i % 3) * 0.15}
        />
      ))}
      {kind === "boostball" ? (
        <g>
          <rect
            x="32"
            y="55"
            width="576"
            height="285"
            rx="30"
            fill="#183744"
            stroke="#66c9dc"
            strokeWidth="3"
          />
          {Array.from({ length: 10 }, (_, i) => (
            <rect
              key={i}
              x={40 + i * 56}
              y="65"
              width="28"
              height="265"
              fill="#72bab6"
              opacity=".07"
            />
          ))}
          <path
            d="M320 58V338 M35 145H140V250H35 M605 145H500V250H605"
            fill="none"
            stroke="#b4e1d4"
            opacity=".4"
            strokeWidth="3"
          />
          <circle
            cx="320"
            cy="200"
            r="65"
            fill="none"
            stroke="#b4e1d4"
            strokeWidth="3"
            opacity=".4"
          />
          <path
            d="M35 145H12V250H35"
            fill="#63d5ff33"
            stroke="#63d5ff"
            strokeWidth="6"
          />
          <path
            d="M605 145H628V250H605"
            fill="#ffa15933"
            stroke="#ffa159"
            strokeWidth="6"
          />
          <g transform="translate(225 245) rotate(-24)">
            <path d="M-30 -12L-110 0L-30 12" fill="#63d5ff" opacity=".5" />
            <rect
              x="-35"
              y="-22"
              width="70"
              height="44"
              rx="12"
              fill="#63d5ff"
            />
            <rect
              x="-10"
              y="-16"
              width="25"
              height="32"
              rx="5"
              fill="#173550"
            />
            <path d="M24 -15V-5 M24 5V15" stroke="#fff5d2" strokeWidth="5" />
          </g>
          <g transform="translate(455 140) rotate(150)">
            <path d="M-30 -12L-100 0L-30 12" fill="#ffa159" opacity=".5" />
            <rect
              x="-35"
              y="-22"
              width="70"
              height="44"
              rx="12"
              fill="#ffa159"
            />
            <rect
              x="-10"
              y="-16"
              width="25"
              height="32"
              rx="5"
              fill="#51382e"
            />
          </g>
          <circle
            cx="337"
            cy="192"
            r="29"
            fill="#eff9e6"
            stroke="#9eb7bb"
            strokeWidth="3"
          />
          <path d="M337 180L348 188L344 201H330L326 188Z" fill="#264958" />
          <text
            x="320"
            y="380"
            fill="#cde8e7"
            textAnchor="middle"
            fontSize="17"
            fontWeight="800"
            letterSpacing="7"
          >
            OWN THE ARENA
          </text>
        </g>
      ) : kind === "racing" ? (
        <>
          <circle cx="440" cy="115" r="77" fill="#ffd5a1" />
          <path
            d="M0 270 120 130 250 245 345 165 480 280 640 160V400H0"
            fill="#64517d"
          />
          <path
            d="M0 310 130 230 270 310 440 240 640 290V400H0"
            fill="#3b375d"
          />
          <path
            d="M-90 460Q450 420 350 290T640 260"
            stroke="#d8a099"
            strokeWidth="160"
            fill="none"
          />
          <path
            d="M-90 460Q450 420 350 290T640 260"
            stroke="#303447"
            strokeWidth="130"
            fill="none"
          />
          <path
            d="M-90 460Q450 420 350 290T640 260"
            stroke="#fff0ba"
            strokeWidth="3"
            strokeDasharray="24 22"
            fill="none"
          />
          <g transform="translate(385 315) rotate(-18)">
            <ellipse rx="66" ry="16" cy="38" fill="#111827" opacity=".5" />
            <rect
              x="-63"
              y="-3"
              width="25"
              height="48"
              rx="10"
              fill="#1b202c"
            />
            <rect x="38" y="-3" width="25" height="48" rx="10" fill="#1b202c" />
            <path d="M-41 33-35-25 28-25 45 33Z" fill="#ffad5f" />
            <rect
              x="-26"
              y="-14"
              width="47"
              height="29"
              rx="9"
              fill="#334c63"
            />
            <path d="M-30 25H33" stroke="#ffe0a8" strokeWidth="8" />
            <path d="M-50-25H45" stroke="#f2ce9c" strokeWidth="11" />
          </g>
          <path d="m530 230 20-100 17 100" fill="#262f46" />
          <path d="m565 246 18-70 14 70" fill="#273449" />
        </>
      ) : kind === "tiles" ? (
        <>
          <g transform="translate(160 40) rotate(-9 160 160)">
            <rect
              x="-12"
              y="-12"
              width="344"
              height="344"
              rx="25"
              fill="#111d2c"
              stroke="#66b5b6"
            />
            {Array.from({ length: 15 }, (_, i) => (
              <g
                key={i}
                transform={`translate(${(i % 4) * 80} ${Math.floor(i / 4) * 80})`}
              >
                <rect
                  width="71"
                  height="71"
                  rx="12"
                  fill={
                    i % 3 === 0
                      ? "#ffb97e"
                      : i % 3 === 1
                        ? "#a7d8cf"
                        : "#8d9ed2"
                  }
                  stroke="#ffffff44"
                  strokeWidth="2"
                />
                <text
                  x="35"
                  y="46"
                  textAnchor="middle"
                  fill="#203047"
                  fontFamily="Arial"
                  fontWeight="bold"
                  fontSize="27"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </g>
          <circle
            cx="540"
            cy="310"
            r="60"
            fill="none"
            stroke="#8bc9c4"
            strokeDasharray="5 12"
          />
        </>
      ) : kind === "prism" ? (
        <>
          <g transform="translate(65 50) rotate(-8 250 90)">
            {Array.from({ length: 24 }, (_, i) => (
              <rect
                key={i}
                x={(i % 6) * 83}
                y={Math.floor(i / 6) * 38}
                width="73"
                height="27"
                rx="6"
                fill={
                  ["#fda499", "#ffc47f", "#b2dab1", "#98d6e2"][
                    Math.floor(i / 6)
                  ]
                }
                stroke="#ffffff55"
                strokeWidth="2"
              />
            ))}
          </g>
          <path
            d="m170 330 160-130 120 90"
            fill="none"
            stroke="#a7fff0"
            strokeWidth="4"
            strokeDasharray="5 10"
          />
          <circle
            cx="330"
            cy="200"
            r="20"
            fill="#a4ffe0"
            opacity=".3"
            filter={`url(#${id}blur)`}
          />
          <circle cx="330" cy="200" r="9" fill="#fff7d9" />
          <rect x="115" y="335" width="150" height="15" rx="8" fill="#c6b2ff" />
          <rect x="135" y="337" width="110" height="4" rx="2" fill="#f4e4ff" />
        </>
      ) : kind === "cloud" ? (
        <>
          <circle cx="465" cy="100" r="55" fill="#ffe7b1" />
          <path
            d="M0 300Q40 230 90 280Q130 200 180 270Q230 240 270 310Q330 240 385 295Q440 220 490 285Q580 230 640 280V400H0"
            fill="#cbe8da"
          />
          <path d="m270 240 115-20 45 20-110 25Z" fill="#c5de9d" />
          <path
            d="m270 240 50 25v38l-50-27Zm50 25 110-25v36l-110 27Z"
            fill="#7da896"
          />
          <path d="m420 130 90-15 35 18-87 20Z" fill="#f4eac1" />
        </>
      ) : kind === "party" ? (
        <>
          <ellipse
            cx="420"
            cy="240"
            rx="180"
            ry="130"
            fill="#d58f94"
            transform="rotate(-25 420 240)"
          />
          <ellipse
            cx="420"
            cy="240"
            rx="230"
            ry="50"
            fill="none"
            stroke="#f5be8e"
            strokeWidth="20"
            transform="rotate(-25 420 240)"
          />
          {[0, 1, 2].map((i) => (
            <g
              key={i}
              transform={`translate(${160 + i * 125} ${150 - i * 20})`}
            >
              <rect
                x="-32"
                y="-40"
                width="64"
                height="80"
                rx="28"
                fill={["#bbd8a0", "#f7b48f", "#a8b7e6"][i]}
              />
              <circle cx="-10" r="5" fill="#333349" />
              <circle cx="10" r="5" fill="#333349" />
              <path
                d="M-8 15Q0 23 8 15"
                stroke="#333349"
                strokeWidth="4"
                fill="none"
              />
            </g>
          ))}
        </>
      ) : (
        <>
          {kind === "space" ? (
            <>
              <circle cx="480" cy="150" r="100" fill="#5e5496" />
              <ellipse
                cx="480"
                cy="150"
                rx="145"
                ry="26"
                fill="none"
                stroke="#a197d8"
                strokeWidth="8"
                transform="rotate(-25 480 150)"
              />
              {Array.from({ length: 7 }, (_, i) => (
                <g
                  key={i}
                  transform={`translate(${70 + i * 77} ${85 + (i % 3) * 55}) rotate(180)`}
                >
                  <path d="m0-24 23 38-23-9-23 9Z" fill="#ec8d9e" />
                  <circle r="7" fill="#693c67" />
                </g>
              ))}
              <path d="m300 200 22 67-22-10-22 10Z" fill="#b3f4e1" />
              <path d="m292 270 8 50 8-50" fill="#ffbb80" />
              <path
                d="M300 190v-40M300 130v-20"
                stroke="#8affdc"
                strokeWidth="4"
              />
            </>
          ) : (
            <>
              <circle cx="445" cy="130" r="85" fill="#ce83b9" />
              {Array.from({ length: 13 }, (_, i) => (
                <rect
                  key={i}
                  x={i * 55 - 10}
                  y={160 - ((i * 37) % 95)}
                  width="42"
                  height={200}
                  fill={i % 2 ? "#252644" : "#363151"}
                />
              ))}
              <path d="M0 295H640" stroke="#8bffdf" strokeWidth="4" />
              <path d="M0 297H640V400H0Z" fill="#211e3d" />
              {Array.from({ length: 12 }, (_, i) => (
                <path
                  key={i}
                  d={`M${i * 60} 295 ${320 + (i - 5) * 180} 400`}
                  stroke="#a172b8"
                  opacity=".35"
                />
              ))}
              <path d="M0 325H640M0 370H640" stroke="#a172b8" opacity=".4" />
              <g transform="translate(385 235) rotate(12)">
                <rect
                  x="-6"
                  y="-8"
                  width="35"
                  height="46"
                  rx="8"
                  fill="#acffe0"
                />
                <rect
                  x="15"
                  y="2"
                  width="12"
                  height="9"
                  rx="2"
                  fill="#223c4c"
                />
                <path
                  d="M0 33-13 57M20 34 36 53"
                  stroke="#acffe0"
                  strokeWidth="11"
                />
                <path d="M-8 5-30 21" stroke="#acffe0" strokeWidth="8" />
              </g>
              <path d="m500 293 24-48 24 48Z" fill="#f69eb6" />
            </>
          )}
        </>
      )}
      <rect
        x="0"
        y="0"
        width="640"
        height="400"
        fill="none"
        stroke="#ffffff0a"
        strokeWidth="3"
      />
    </svg>
  );
}
