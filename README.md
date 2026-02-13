# School Capacity Simulator

Simulate school occupancy on Matterport 3D scans with 3D-anchored human figures for capacity planning and visualization.

![silhouette figures on a matterport scan]

## Quick Start

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000` with your Matterport scan loaded.

## Features

### Bulk Placement
- Enter a count (e.g., "25") and select a role (Students, Teachers, Mixed)
- Click **Select Area & Place** → draw a freehand lasso shape on the scan
- People scatter naturally within your drawn shape using gaussian distribution
- **Mixed mode** distributes people by school ratios (75% students, 25% teachers)

### 3D-Anchored Figures
- Figures are anchored to 3D positions in the Matterport scan via the Embed SDK
- They stay in place as you rotate, zoom, and walk through the model
- Falls back to 2D overlay mode if SDK is unavailable

### Figure Styles
- **Photo**: Real PNG cutout images per role
- **Silhouettes**: Human figures in standing, walking, sitting poses with natural variation
- **Icons**: Circular person icons with role coloring
- **Dots**: Minimal dot markers
- Adjustable size slider to scale figures up/down

### Individual Placement
- Name a person, pick a role, click to place one at a time
- Right-click any figure to remove it

### Capacity Tracking
- Set an occupancy limit → live progress bar in header
- Role breakdown badges and stats bar

### Export
- Download JSON with all placements, roles, and positions for reporting

## Configuration

Credentials are in `.env`:

```env
VITE_MATTERPORT_SDK_KEY=4pg12mmsm62sf2m553p6sfnnd
VITE_MATTERPORT_MODEL_SID=hvvUfPkLBME
```

### Finding Your Model SID

From your Matterport scan URL:
```
https://my.matterport.com/show/?m=hvvUfPkLBME
                                   ^^^^^^^^^^^
```

Or use the **Load Scan** input in the sidebar to switch models at runtime.

## Project Structure

```
school-capacity-simulator/
├── index.html              # Entry point
├── src/
│   ├── main.js             # App logic, events, state, camera tracking
│   ├── sdk-connection.js   # Matterport Embed SDK connection & worldToScreen
│   ├── people-figures.js   # SVG figure generator (silhouettes, icons, dots)
│   ├── people-photos.js    # Photo cutout figure renderer
│   └── styles.css          # All styles
├── public/people/          # Photo assets per role
├── .env                    # Matterport credentials
├── vite.config.js          # Vite dev server
└── package.json
```

## Usage Tips

1. **Hover over the scan** before bulk placement so the SDK captures a floor reference point
2. **Draw zones strategically** — draw a lasso shape over a classroom, then another over the hallway
3. **Use Mixed mode** for realistic school population distribution
4. **Adjust figure size** to match the zoom level of your view
5. **Right-click figures** to remove individual ones
6. **Export JSON** for capacity documentation and reports

## Build for Production

```bash
npm run build     # Outputs to dist/
npm run preview   # Preview production build
```

Deploy the `dist/` folder to any static host.
