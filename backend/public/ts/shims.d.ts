// Minimal ambient declarations for non-module TS in the browser
// Avoid declaring classes here to prevent duplicate identifier errors—
// we only declare the global app handle for convenience.

declare var app: any;
interface Window { app: any; [key: string]: any }
