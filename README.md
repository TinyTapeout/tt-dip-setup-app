# tt-dip-setup-app

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![AI Assisted](https://www.aihonestybadge.com/badges/ai-assisted-small.svg)

Tiny Tapeout DIP Setup lets you configure a [Tiny Tapeout DIP](https://github.com/TinyTapeout/tt-dip-firmware) breakout
from your browser, over USB (Web Serial). You can select the active design, set its clock, and choose what the
board does when it powers up (default design, clock, reset behaviour, external-driver detection), then save that
configuration to the board's flash.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) 20 or later, with npm.

### Instructions

1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. Run `npm start` to start the development server and open the app.

Other scripts:

| Script             | What it does                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `npm test`         | Unit tests (Vitest): protocol parsers, clock math, device driver. |
| `npm run test:e2e` | End-to-end tests (Playwright) against the simulated board.        |
| `npm run lint`     | oxlint and TypeScript type checking.                              |
| `npm run format`   | Prettier.                                                         |
| `npm run build`    | Production build into `dist/`.                                    |

Open `http://localhost:5173/?mock=1` to use the simulated board. The Web Serial API (Chrome, Edge, Opera, or
Firefox 151+) is needed to connect to a real one.

### Project layout

- `src/dip/`: everything that talks to the board: the text protocol (`protocol.ts`), the clock quantization
  math (`clock.ts`), the serial transport (`WebSerialLink.ts`), the command queue and state store
  (`DipDevice.ts`), and the firmware simulator (`SimulatedDip.ts`).
- `src/model/`: the shuttle index client.
- `src/components/`: the React UI (Material UI).

## Firmware

- The board is a USB CDC device (VID `0x1209`, PID `0x5454`). The app sends one `\n`-terminated command at a
  time, treats the `>>> ` prompt as the end of the response, and filters out the echoed command.
- Only `key=value` lines are parsed (`read_shuttle()`, `dump_state()`, `dump_settings()`). After a command that
  changes state or settings, the app re-reads `dump_state()` / `dump_settings()` rather than parsing the
  human-readable messages, which depend on the debug level. `ERROR:` lines are shown to the user when the board
  emits them (debug level >= 1).
- `src/dip/clock.ts` mirrors the firmware's `calc_pwm_nm()` (48 MHz timer, 24 MHz maximum), so the UI shows the
  quantized rate the board will actually produce before sending it.
- `restart()` gets a 10 s timeout, since the boot sequence clocks the mux once per design index.

Firmware quirks the app works around:

- `select_design()` without a clock argument stops the clock, so the app always passes the rate when it is
  non-zero.
- `set_mux_ext()` reconfigures the clock/reset pins instead of the mux pins.

## License

Tiny Tapeout DIP Setup is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for more
details.
