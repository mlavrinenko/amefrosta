/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*?raw' {
  const content: string;
  export default content;
}

// Injected by vite's `define` (see vite.config.ts). Absent under vitest, so
// every read guards with `typeof`.
declare const __APP_VERSION__: string;
