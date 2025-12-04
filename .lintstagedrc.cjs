module.exports = {
  // Linter les fichiers TypeScript/JavaScript modifiés
  '**/*.(ts|tsx|js|jsx)': ['eslint --fix', 'prettier --write'],

  // Formater les autres fichiers
  '**/*.(json|css|md|html)': ['prettier --write'],
};
