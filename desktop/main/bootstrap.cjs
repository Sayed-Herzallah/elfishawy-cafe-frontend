'use strict';

// Electron 22 loads the package entry with CommonJS `require()`. Packaged
// builds bundle the ES module main process into main.cjs because Node 16's
// ESM resolver cannot reliably load sibling modules from app.asar.
const { app } = require('electron');

if (app.isPackaged) {
  require('./main.cjs');
} else {
  import('./main.js').catch((error) => {
    console.error('Failed to load the Electron main process:', error);
    process.exit(1);
  });
}
