/**
 * Repo map generator — compact, signature-only index of the codebase for LLM context.
 *
 * TypeScript/TSX is parsed with ts-morph (syntax only, no type-checking).
 * PHP is parsed with a small built-in scanner (comments/strings stripped, then
 * declaration matching) so the script stays self-contained Node/TS.
 *
 * Usage:
 *   npx tsx scripts/generate-repo-map.ts [--out=REPO_MAP.md] [--roots=a,b] [--max-members=40]
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, SyntaxKind, ts } from 'ts-morph';
import type {
    SourceFile,
    ClassDeclaration,
    InterfaceDeclaration,
    Node,
    VariableStatement,
} from 'ts-morph';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Directories never walked, wherever they appear. */
const SKIP_DIRS = new Set([
    '.git', 'node_modules', 'vendor', 'dist', 'build', 'out', 'coverage', 'public', 'storage',
    'bootstrap/cache', '__tests__', '__mocks__', '__fixtures__', '__snapshots__', 'fixtures',
    'mocks', 'snapshots', 'stubs', '.idea', '.vscode', 'docker', 'proto',
    // Migrations are schema mutations with no signatures worth indexing.
    'database/migrations',
]);
/** Files skipped by name/suffix: tests, generated helpers, minified vendor drops. */
const SKIP_FILE = (name: string) =>
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(name) ||
    /\.min\.js$/.test(name) ||
    /^_ide_helper/.test(name);

const TS_EXT = /\.(ts|tsx)$/;
const PHP_EXT = /\.php$/;

/** Source roots, in output order. Falls back per-repo: `src/` if present, else the Laravel/Inertia layout. */
function defaultRoots(): string[] {
    const roots = existsSync(join(REPO_ROOT, 'src'))
        ? ['src']
        : ['resources/js', 'app', 'routes', 'database', 'config'];
    return roots.filter((r) => existsSync(join(REPO_ROOT, r)));
}

type Args = { out: string; roots: string[]; maxMembers: number };
function parseArgs(argv: string[]): Args {
    const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
    return {
        out: get('out') ?? 'REPO_MAP.md',
        roots: get('roots')?.split(',').map((s) => s.trim()).filter(Boolean) ?? defaultRoots(),
        maxMembers: Number(get('max-members') ?? 40),
    };
}

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(relative(REPO_ROOT, full))) continue;
            walk(full, acc);
        } else if (entry.isFile()) {
            if (SKIP_FILE(entry.name)) continue;
            if (TS_EXT.test(entry.name) || PHP_EXT.test(entry.name)) acc.push(full);
        }
    }
    return acc;
}

const MAX_IMPORTS = 60;
const capList = (items: string[]) =>
    items.length > MAX_IMPORTS ? [...items.slice(0, MAX_IMPORTS), `+${items.length - MAX_IMPORTS} more`] : items;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max).trimEnd()}~` : s);
const rel = (p: string) => relative(REPO_ROOT, p).split(sep).join('/');

// ---------------------------------------------------------------- TypeScript

type FileEntry = { path: string; lang: 'ts' | 'php'; ns?: string; imports: string[]; exports: string[] };

function typeOf(node: { getTypeNode?: () => Node | undefined }): string {
    const t = node.getTypeNode?.();
    return t ? cut(norm(t.getText()), 160) : '';
}

function paramList(params: { getText(): string }[]): string {
    return params.map((p) => cut(norm(p.getText()), 120)).join(', ');
}

function fnSignature(
    node: {
        getName?: () => string | undefined;
        getTypeParameters(): { getText(): string }[];
        getParameters(): { getText(): string }[];
        getReturnTypeNode(): Node | undefined;
    },
    name: string,
): string {
    const tp = node.getTypeParameters();
    const generics = tp.length ? `<${tp.map((p) => norm(p.getText())).join(', ')}>` : '';
    const ret = node.getReturnTypeNode();
    return `${name}${generics}(${paramList(node.getParameters())})${ret ? `: ${cut(norm(ret.getText()), 160)}` : ''}`;
}

function classMembers(cls: ClassDeclaration, maxMembers: number): string[] {
    const out: string[] = [];
    for (const m of cls.getMembers()) {
        const anyM = m as any;
        if (anyM.hasModifier?.(SyntaxKind.PrivateKeyword)) continue;
        if (m.getKind() === SyntaxKind.Constructor) {
            out.push(`ctor(${paramList(anyM.getParameters())})`);
        } else if (m.getKind() === SyntaxKind.MethodDeclaration) {
            const stat = anyM.isStatic?.() ? 'static ' : '';
            out.push(`${stat}${fnSignature(anyM, anyM.getName())}`);
        } else if (m.getKind() === SyntaxKind.PropertyDeclaration) {
            const stat = anyM.isStatic?.() ? 'static ' : '';
            const t = typeOf(anyM);
            out.push(`${stat}${anyM.getName()}${t ? `: ${t}` : ''}`);
        } else if (m.getKind() === SyntaxKind.GetAccessor || m.getKind() === SyntaxKind.SetAccessor) {
            out.push(`${m.getKind() === SyntaxKind.GetAccessor ? 'get' : 'set'} ${anyM.getName()}`);
        }
        if (out.length >= maxMembers) { out.push(`+${cls.getMembers().length - out.length} more`); break; }
    }
    return out;
}

function interfaceMembers(iface: InterfaceDeclaration, maxMembers: number): string[] {
    const members = iface.getMembers();
    const out = members.slice(0, maxMembers).map((m) => cut(norm(m.getText().replace(/[;,]$/, '')), 160));
    if (members.length > maxMembers) out.push(`+${members.length - maxMembers} more`);
    return out;
}

function variableExports(stmt: VariableStatement): string[] {
    const kind = stmt.getDeclarationKind();
    return stmt.getDeclarations().map((d) => {
        const name = d.getName();
        const init = d.getInitializer();
        if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
            return `${kind} ${fnSignature(init as any, name)}`;
        }
        const t = typeOf(d);
        if (t) return `${kind} ${name}: ${t}`;
        const literal = init && [SyntaxKind.StringLiteral, SyntaxKind.NumericLiteral, SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword].includes(init.getKind());
        return `${kind} ${name}${literal ? ` = ${cut(norm(init!.getText()), 60)}` : ''}`;
    });
}

function readTsFile(sf: SourceFile, maxMembers: number): FileEntry {
    const imports: string[] = [];
    for (const imp of sf.getImportDeclarations()) {
        const spec = imp.getModuleSpecifierValue();
        const names: string[] = [];
        const def = imp.getDefaultImport();
        if (def) names.push(def.getText());
        const ns = imp.getNamespaceImport();
        if (ns) names.push(`* ${ns.getText()}`);
        for (const n of imp.getNamedImports()) names.push(n.getAliasNode() ? `${n.getName()} as ${n.getAliasNode()!.getText()}` : n.getName());
        const kind = imp.isTypeOnly() ? 'type ' : '';
        imports.push(`${kind}${spec}${names.length ? `[${names.join(',')}]` : ''}`);
    }

    const exports: string[] = [];
    for (const exp of sf.getExportDeclarations()) {
        const spec = exp.getModuleSpecifierValue();
        const named = exp.getNamedExports().map((n) => n.getName());
        if (spec) exports.push(`re-export ${spec}${named.length ? `[${named.join(',')}]` : ' *'}`);
        else if (named.length) exports.push(`export {${named.join(',')}}`);
    }

    for (const stmt of sf.getStatements()) {
        const anyS = stmt as any;
        if (typeof anyS.isExported === 'function' && !anyS.isExported()) continue;
        switch (stmt.getKind()) {
            case SyntaxKind.FunctionDeclaration: {
                const asyncKw = anyS.isAsync?.() ? 'async ' : '';
                exports.push(`${asyncKw}fn ${fnSignature(anyS, anyS.getName() ?? 'default')}`);
                break;
            }
            case SyntaxKind.ClassDeclaration: {
                const cls = stmt as ClassDeclaration;
                const ext = cls.getExtends() ? ` extends ${norm(cls.getExtends()!.getText())}` : '';
                const impl = cls.getImplements().length ? ` implements ${cls.getImplements().map((i) => norm(i.getText())).join(', ')}` : '';
                exports.push(`class ${cls.getName() ?? 'default'}${ext}${impl}`);
                for (const m of classMembers(cls, maxMembers)) exports.push(`. ${m}`);
                break;
            }
            case SyntaxKind.InterfaceDeclaration: {
                const iface = stmt as InterfaceDeclaration;
                const ext = iface.getExtends().length ? ` extends ${iface.getExtends().map((e) => norm(e.getText())).join(', ')}` : '';
                exports.push(`iface ${iface.getName()}${ext}`);
                for (const m of interfaceMembers(iface, maxMembers)) exports.push(`. ${m}`);
                break;
            }
            case SyntaxKind.TypeAliasDeclaration:
                exports.push(`type ${anyS.getName()} = ${cut(norm(anyS.getTypeNode()?.getText() ?? ''), 400)}`);
                break;
            case SyntaxKind.EnumDeclaration:
                exports.push(`enum ${anyS.getName()} {${anyS.getMembers().map((m: any) => m.getName()).join(',')}}`);
                break;
            case SyntaxKind.VariableStatement:
                for (const e of variableExports(stmt as VariableStatement)) exports.push(e);
                break;
            case SyntaxKind.ExportAssignment:
                exports.push(`default ${cut(norm(anyS.getExpression().getText()), 120)}`);
                break;
        }
    }
    return { path: rel(sf.getFilePath()), lang: 'ts', imports: capList(imports), exports };
}

// ----------------------------------------------------------------- PHP

/** Blanks out comments and string bodies (newlines kept) so declaration matching can't trip on them. */
function stripPhpNoise(src: string): string {
    let out = '';
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        const next = src[i + 1];
        if (c === '/' && next === '*') {
            const end = src.indexOf('*/', i + 2);
            const chunk = src.slice(i, end === -1 ? src.length : end + 2);
            out += chunk.replace(/[^\n]/g, ' ');
            i += chunk.length - 1;
        } else if ((c === '/' && next === '/') || c === '#') {
            const end = src.indexOf('\n', i);
            const stop = end === -1 ? src.length : end;
            out += ' '.repeat(stop - i);
            i = stop - 1;
        } else if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
            const chunk = src.slice(i, Math.min(j + 1, src.length));
            out += c + chunk.slice(1).replace(/[^\n]/g, ' ');
            i += chunk.length - 1;
        } else if (c === '<' && src.startsWith('<<<', i)) {
            const header = /^<<<\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/.exec(src.slice(i));
            if (header) {
                const label = header[2];
                const endRe = new RegExp(`^[ \\t]*${label}\\b`, 'm');
                const rest = src.slice(i + header[0].length);
                const m = endRe.exec(rest);
                const chunk = src.slice(i, i + header[0].length + (m ? m.index + m[0].length : rest.length));
                out += chunk.replace(/[^\n]/g, ' ');
                i += chunk.length - 1;
            } else out += c;
        } else out += c;
    }
    return out;
}

/** Reads a declaration from `start` up to `{` or `;`, i.e. the signature without its body. */
function signatureAt(src: string, start: number): { text: string; end: number } {
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (depth === 0 && (c === '{' || c === ';')) return { text: norm(src.slice(start, i)), end: i };
    }
    return { text: norm(src.slice(start)), end: src.length };
}

const PHP_TYPE_RE = /\b(?:(abstract|final|readonly)\s+)*\b(class|interface|trait|enum)\s+([A-Za-z_]\w*)/g;
const PHP_FN_RE = /(?:^|[\s;}])((?:(?:public|protected|private|static|abstract|final)\s+)*)function\s+&?([A-Za-z_]\w*)\s*\(/g;

function readPhpFile(path: string, maxMembers: number): FileEntry {
    const raw = readFileSync(path, 'utf8');
    const src = stripPhpNoise(raw);
    const ns = /^\s*namespace\s+([^;{]+)/m.exec(src)?.[1]?.trim();

    const imports: string[] = [];
    for (const m of src.matchAll(/^\s*use\s+(function\s+|const\s+)?([^;]+);/gm)) {
        const body = norm(m[2]);
        // No backslash at all => a class-level trait `use` or a closure `use (...)`, not an import.
        if (!body.includes('\\')) continue;
        const group = /^(.+?)\\\{(.+)\}$/.exec(body);
        if (group) for (const part of group[2].split(',')) imports.push(`${group[1]}\\${norm(part)}`);
        else imports.push(`${m[1] ? norm(m[1]) + ' ' : ''}${body}`);
    }
    for (const m of src.matchAll(/^\s{4,}use\s+([A-Za-z_][\w\\]*(?:\s*,\s*[A-Za-z_][\w\\]*)*)\s*;/gm)) {
        for (const t of m[1].split(',')) imports.push(`trait ${norm(t)}`);
    }

    // Declaration order matters for readability, so collect then sort by offset.
    type Decl = { pos: number; text: string; member: boolean };
    const decls: Decl[] = [];
    for (const m of src.matchAll(PHP_TYPE_RE)) {
        const { text } = signatureAt(src, m.index!);
        decls.push({ pos: m.index!, text: cut(text, 240), member: false });
    }
    for (const m of src.matchAll(PHP_FN_RE)) {
        const mods = norm(m[1]);
        if (/\bprivate\b/.test(mods)) continue;
        const at = m.index! + (/^[\s;}]/.test(m[0]) ? 1 : 0);
        const { text } = signatureAt(src, at);
        // `public` and `function` are boilerplate on every method — drop both, keep the rest.
        const sig = text.replace(/^public\s+/, '').replace(/^((?:(?:protected|static|abstract|final)\s+)*)function\s+/, '$1');
        decls.push({ pos: m.index!, text: cut(sig, 240), member: true });
    }
    decls.sort((a, b) => a.pos - b.pos);

    const exports: string[] = [];
    let members = 0;
    for (const d of decls) {
        if (!d.member) { members = 0; exports.push(d.text); continue; }
        if (members === maxMembers) { exports.push('. +more'); members++; continue; }
        if (members > maxMembers) continue;
        members++;
        exports.push(`. ${d.text}`);
    }
    return { path: rel(path), lang: 'php', ns, imports: capList([...new Set(imports)]), exports };
}

// ----------------------------------------------------------------- Output

function folderTree(files: FileEntry[], depth = 3): string[] {
    const counts = new Map<string, number>();
    for (const f of files) {
        const parts = f.path.split('/');
        for (let d = 1; d < Math.min(parts.length, depth + 1); d++) {
            const key = parts.slice(0, d).join('/');
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    return [...counts.keys()].sort().map((k) => `${'  '.repeat(k.split('/').length - 1)}${k.split('/').pop()}/ ${counts.get(k)}`);
}

function render(files: FileEntry[], args: Args): string {
    const lines: string[] = [];
    const ts = files.filter((f) => f.lang === 'ts').length;
    const php = files.length - ts;
    lines.push('# Repo Map');
    lines.push(`Signature-only index of ${files.length} source files (${ts} ts/tsx, ${php} php). Generated by \`scripts/generate-repo-map.ts\` — do not edit by hand.`);
    lines.push('Legend: `i` import/dependency · `e` export (ts) or declaration (php) · `.` member of the declaration above it · `~` truncated · `+N more` members omitted. Private php methods and bodies are omitted.');
    lines.push('## Tree');
    lines.push('```');
    lines.push(...folderTree(files));
    lines.push('```');
    lines.push('## Files');
    for (const f of files) {
        lines.push(`### ${f.path}`);
        if (f.ns) lines.push(`ns ${f.ns}`);
        if (f.imports.length) lines.push(`i ${f.imports.join(' | ')}`);
        for (const e of f.exports) lines.push(e.startsWith('. ') ? e : `e ${e}`);
    }
    return lines.filter((l) => l !== '').join('\n') + '\n';
}

// ----------------------------------------------------------------- Main

function main() {
    const args = parseArgs(process.argv.slice(2));
    const paths: string[] = [];
    for (const root of args.roots) {
        const abs = join(REPO_ROOT, root);
        if (!existsSync(abs)) continue;
        if (statSync(abs).isDirectory()) walk(abs, paths);
    }
    const tsPaths = paths.filter((p) => TS_EXT.test(p));
    const phpPaths = paths.filter((p) => PHP_EXT.test(p));

    const project = new Project({
        useInMemoryFileSystem: false,
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        compilerOptions: { allowJs: false, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext },
    });

    const entries: FileEntry[] = [];
    for (const p of tsPaths) entries.push(readTsFile(project.addSourceFileAtPath(p), args.maxMembers));
    for (const p of phpPaths) entries.push(readPhpFile(p, args.maxMembers));

    // Root order first (as given), then alphabetical within a root.
    const rootIndex = (p: string) => args.roots.findIndex((r) => p === r || p.startsWith(`${r}/`));
    entries.sort((a, b) => rootIndex(a.path) - rootIndex(b.path) || a.path.localeCompare(b.path));

    const outPath = resolve(REPO_ROOT, args.out);
    const markdown = render(entries, args);
    writeFileSync(outPath, markdown, 'utf8');
    process.stdout.write(`${args.out}: ${entries.length} files, ${markdown.split('\n').length} lines, ${(markdown.length / 1024).toFixed(0)} KB\n`);
}

main();
