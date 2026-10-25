const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 15)) {
  console.error(
    `\nThis project requires Node.js 22.15 or newer. You have ${process.versions.node}.\nInstall Node.js 24 LTS, reopen your terminal, then run npm ci.\n`,
  );
  process.exit(1);
}
