const fs = require('fs');

const replaceInFile = (file, from, to) => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, content);
};

replaceInFile('index.html', 'GamePlay365', 'Playall 365');
replaceInFile('src/App.tsx', 'GamePlay365', 'Playall 365');
replaceInFile('src/components/Header.tsx', 'GamePlay365', 'Playall 365');
replaceInFile('src/components/Navbar.tsx', 'GamePlay365', 'Playall 365');
