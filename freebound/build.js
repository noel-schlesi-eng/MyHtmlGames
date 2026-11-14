// Baut die eigenständige www/index.html (Vorlage + three.min.js + game.js).
// Keine externen Abhängigkeiten zur Laufzeit: Spiel und Engine liegen in einer Datei.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const tpl = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8');
const three = fs.readFileSync(path.join(root, 'node_modules', 'three', 'build', 'three.min.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const out = tpl.replace('/*__THREE__*/', () => safe(three)).replace('/*__GAME__*/', () => safe(game));
fs.mkdirSync(path.join(root, 'www'), { recursive: true });
fs.writeFileSync(path.join(root, 'www', 'index.html'), out);
console.log('www/index.html geschrieben:', (out.length / 1024).toFixed(0), 'KB');
