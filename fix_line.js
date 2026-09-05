const fs = require('fs');
let lines = fs.readFileSync('src/services/logging/logRotation.ts', 'utf8').split('\n');
// Fix line 211 (index 210): replace the incorrectly-escaped regex
lines[210] = '  const jsonStart = message.search(/\\s(?=\\{|")/);';
fs.writeFileSync('src/services/logging/logRotation.ts', lines.join('\n'));
console.log('Fixed. New line 211:', lines[210]);
