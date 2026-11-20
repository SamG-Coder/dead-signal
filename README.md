# Dead Signal

Dead Signal is a single-player Three.js zombie survival game set in a freight yard. Survive waves, collect ammo and health between rounds, and beat your browser's saved kill count.

[Play Dead Signal](https://samg-coder.github.io/dead-signal/)

On phones, drag the left joystick to move and drag the right side to aim. Hold **FIRE** to shoot and tap **↻** to reload. On desktop, use **WASD** and the mouse, click to fire, press **R** to reload, and press **Esc** to pause.

## Local hosting

Run `npm ci` and `npm start` in the project directory, then open [localhost:4173](http://localhost:4173/). The desktop menu can display a QR code for phones on the same network.

Run `npm run build` to produce the static site in `dist/`. GitHub Actions publishes that site to GitHub Pages on pushes to `main`.
