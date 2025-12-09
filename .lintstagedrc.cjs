module.exports = {
  // Linter les fichiers TypeScript/JavaScript modifiés
  '**/*.(ts|tsx|js|jsx)': ['eslint --fix', 'prettier --write'],

  // Formater les autres fichiers (les fichiers dans .prettierignore seront automatiquement exclus)
  '**/*.(json|css|md|html)': ['prettier --write'],
};
