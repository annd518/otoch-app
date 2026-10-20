// React Native throws "Text strings must be rendered within a <Text> component" when a View
// gets a bare string as a child: {" "} between lines, {cond && ...} where cond can be "" or 0,
// raw words. react-native-web does not, so the browser never shows it. This finds those places
// with the type checker. Run: npm run check:text (also in CI).
const ts = require('typescript')
const path = require('path')
const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, process.cwd())
const program = ts.createProgram(parsed.fileNames.filter((f) => /\/(app|components)\//.test(f)), parsed.options)
const checker = program.getTypeChecker()
const TEXTY = new Set(['Text', 'AppText', 'TextInput', 'Animated.Text'])
// components that take their children as text themselves
const WRAPS_TEXT = new Set(['Button'])
const name = (n) => (ts.isJsxElement(n) ? n.openingElement.tagName.getText() : n.tagName.getText())
const mayBeText = (t) => {
  // a ReactNode prop (children, footer) is the caller's responsibility
  const shown = checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation)
  if (shown === 'ReactNode' || /^string \| number \| bigint \| (true \| )?ReactElement/.test(shown)) return false
  const parts = t.isUnion() ? t.types : [t]
  return parts.some((p) => p.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral | ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral | ts.TypeFlags.Any))
}
let found = 0
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !/\/(app|components)\//.test(sf.fileName)) continue
  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const tag = name(node)
      if (!TEXTY.has(tag) && !WRAPS_TEXT.has(tag)) {
        for (const c of node.children) {
          const { line } = sf.getLineAndCharacterOfPosition(c.getStart())
          if (ts.isJsxText(c) && c.getText().trim() !== '') { found++; console.log(`${path.relative('.', sf.fileName)}:${line + 1}  raw text in <${tag}>: "${c.getText().trim().slice(0, 40)}"`) }
          if (ts.isJsxExpression(c) && c.expression) {
            const t = checker.getTypeAtLocation(c.expression)
            if (mayBeText(t)) { found++; console.log(`${path.relative('.', sf.fileName)}:${line + 1}  <${tag}> child {${c.expression.getText().slice(0, 60)}} : ${checker.typeToString(t).slice(0, 50)}`) }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}
console.log(found ? `${found} place(s) can render bare text outside <Text>` : 'no bare-text risks found')
process.exit(found ? 1 : 0)
