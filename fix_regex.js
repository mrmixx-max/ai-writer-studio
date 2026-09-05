const fs = require('fs');
let content = fs.readFileSync('src/services/logging/logRotation.ts', 'utf8');
const lines = content.split('\n');
// Remove the broken line 212 (index 211)
lines.splice(211, 1);
// Fix line 211 (index 210) - replace with correct regex
lines[210] = '  const jsonStart = message.search(/\\\\s(?=\\\\{|")/);';
console.log('Fixed line 211:', lines[210]);
content = lines.join('\n');
fs.writeFileSync('src/services/logging/logRotation.ts', content);
