# HAIZ Pocket Lamp Web gateway

This React/Vite entry page uses the unmodified official Aceternity UI LampContainer, fetched at build time with Motion and Tailwind CSS. Clicking "进入本机空间" opens the actual Flutter Web app at ./app/?fromLamp=1.

- Official component: https://ui.aceternity.com/components/lamp
- Official registry: https://ui.aceternity.com/registry/lamp.json
- Author: Manu Arora / Aceternity UI
- Licensing: https://ui.aceternity.com/licence

The repository stores a reference and fetch script, not a vendored copy of the component's source. Aceternity's license permits websites as end products but limits redistribution of the original component source as a standalone asset. This is why GitHub Actions fetches the component when building.

To build: run npm install and npm run build in app/web-lamp-react. The resulting dist/ uses /lamp-preview/ as its base URL.
