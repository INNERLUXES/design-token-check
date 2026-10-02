// Reads a design tokens file in the format of the W3C Design Tokens Community Group (JSON with $value and $type,
// nested groups, {alias.references} and $ref JSON Pointers) from the value tree of src/json.js.
//
// buildTokens flattens the tree: every object with a $value (or a $ref) is a token, every other object is a group,
// and the path of a token is the names of its groups and its own name joined with periods. It reports what the
// format forbids: a name with {, } or . in it, a name that starts with $ (except $root), a token that is also a
// group, a name given twice, a value that is neither a token nor a group.
//
// resolveToken follows aliases to the token that holds a value, with cycle detection, and effectiveType gives the
// type a token has: its own $type, else the type of the token it is an alias of, else the closest group's $type.

import { GROUP_PROPERTIES, ROOT_TOKEN } from './data.js';
import { propOf } from './json.js';

const CURLY = /^\{([^{}]*)\}$/;

// Splits a JSON Pointer ("#/a/b") into the names it walks, or null when it is not one the tool can follow.
function pointerNames(text) {
  if (!text.startsWith('#/')) return null;
  const names = text.slice(2).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  return names.every((n) => n.length > 0) ? names : null;
}

// Returns { tokens: Map(path -> token), list, groups (a count), groupPaths (a Set), issues }. A token is { path, line, kind ('value' or
// 'alias'), valueNode, alias (path or null), explicitType, groupType, typeNode }. An issue is
// { id, path, line, message, fix }.
export function buildTokens(root) {
  const tokens = new Map();
  const list = [];
  const issues = [];
  const groupPaths = new Set();
  const issue = (id, path, line, message, fix) => issues.push({ id, path, line, message, fix });
  let groups = 0;

  if (root.t !== 'object') {
    issue('tokens-invalid', '', root.line, 'the file holds a JSON value that is not an object; a tokens file is one object of groups and tokens', 'Write the tokens as an object, for example { "color": { "red": { "$value": "#ff0000", "$type": "color" } } }');
    return { tokens, list, groups, groupPaths, issues };
  }

  const isToken = (node) => node.t === 'object' && node.props.some((p) => p.key === '$value' || p.key === '$ref');

  function stringProperty(node, key, path) {
    const p = propOf(node, key);
    if (!p) return { present: false, value: null, line: node.line };
    if (p.value.t !== 'string') {
      issue('invalid-token', path, p.line, `${key} of ${path || 'the file'} must be a string`, `Write ${key} as a JSON string`);
      return { present: true, value: null, line: p.line };
    }
    return { present: true, value: p.value.value, line: p.line };
  }

  function walk(node, path, groupType) {
    const seen = new Map();
    for (const prop of node.props) {
      const key = prop.key;
      const childPath = path ? `${path}.${key}` : key;
      if (seen.has(key)) {
        issue('duplicate-name', childPath, prop.line, `${childPath} is written twice in the same group (first at line ${seen.get(key)}); only the first is used`, 'Give the two entries different names, or remove one');
        continue;
      }
      seen.set(key, prop.line);
      if (key.startsWith('$')) {
        if (key === '$extends') {
          issue('unsupported-extends', path, prop.line, `${path || 'the file'} uses $extends, which the tool does not follow; the tokens it would inherit are not in the check`, 'Write the inherited tokens out in the group, or expect missing-token findings for them');
          continue;
        }
        if (GROUP_PROPERTIES.includes(key)) continue;
        if (key !== ROOT_TOKEN && prop.value.t !== 'object') continue;
        if (key !== ROOT_TOKEN) {
          issue('invalid-name', childPath, prop.line, `${childPath}: a name must not start with $; the format keeps those for its own properties (only $root is a name)`, 'Rename the token or the group');
          continue;
        }
      }
      if (/[{}.]/.test(key)) {
        issue('invalid-name', childPath, prop.line, `${childPath}: a name must not contain {, } or a period, because aliases are written with them`, 'Rename the token or the group');
        continue;
      }
      const child = prop.value;
      if (child.t !== 'object') {
        issue('invalid-token', childPath, prop.line, `${childPath} is neither a token (an object with $value) nor a group (an object of tokens)`, 'Make it an object with a $value, or remove it');
        continue;
      }
      if (isToken(child)) {
        addToken(child, childPath, prop.line, groupType);
      } else {
        groups += 1;
        groupPaths.add(childPath);
        const own = stringProperty(child, '$type', childPath);
        walk(child, childPath, own.value ?? groupType);
      }
    }
  }

  function addToken(node, path, line, groupType) {
    const hasValue = propOf(node, '$value');
    const hasRef = propOf(node, '$ref');
    const type = stringProperty(node, '$type', path);
    let kind = 'value';
    let alias = null;
    let valueNode = null;
    let aliasLine = line;
    if (hasValue && hasRef) {
      issue('invalid-token', path, line, `${path} has both $value and $ref; a token has one of them`, 'Remove one of the two');
    }
    if (hasValue) {
      valueNode = hasValue.value;
      aliasLine = hasValue.line;
      const m = valueNode.t === 'string' ? CURLY.exec(valueNode.value) : null;
      if (m) {
        kind = 'alias';
        alias = m[1];
      }
    } else {
      kind = 'alias';
      aliasLine = hasRef.line;
      if (hasRef.value.t !== 'string') {
        issue('invalid-token', path, hasRef.line, `$ref of ${path} must be a string`, 'Write $ref as a JSON Pointer string such as "#/color/red"');
      } else {
        const names = pointerNames(hasRef.value.value);
        if (names === null) issue('unresolved-alias', path, hasRef.line, `${path}: the $ref "${hasRef.value.value}" is not a JSON Pointer that starts with #/`, 'Write the reference as "#/group/token"');
        else alias = names.join('.');
      }
    }
    // Properties that start with $ and are not in the format are left alone (they belong to a later version); a
    // child object of a token is wrong.
    for (const p of node.props) {
      if (!p.key.startsWith('$') && p.value.t === 'object') {
        issue('invalid-token', `${path}.${p.key}`, p.line, `${path} has a $value and also holds ${p.key}; an object is a token or a group, not both`, 'Move the child into its own group, next to the token');
      }
    }
    if (tokens.has(path)) return;
    const token = { path, line, kind, valueNode, alias, aliasLine, explicitType: type.value, typeLine: type.line, groupType: groupType ?? null };
    tokens.set(path, token);
    list.push(token);
  }

  // The $type of the root object applies to every token that has no nearer type.
  const rootType = stringProperty(root, '$type', '');
  walk(root, '', rootType.value);

  // Names that differ only in letter case are different tokens, which is usually a slip.
  const lower = new Map();
  for (const t of list) {
    const key = t.path.toLowerCase();
    if (lower.has(key) && lower.get(key).path !== t.path) {
      issue('case-collision', t.path, t.line, `${t.path} and ${lower.get(key).path} (line ${lower.get(key).line}) differ only in letter case`, 'Give the two tokens names that differ by more than case');
    } else if (!lower.has(key)) lower.set(key, t);
  }
  return { tokens, list, groups, groupPaths, issues };
}

// Follows aliases to the token that holds a value, with cycle detection, remembering every answer, so that a long
// chain of aliases is walked once however many tokens are in it. resolve(path) returns
//   { ok: true, token, type }                    the token with the value, and the type of the starting token
//   { ok: false, cause: 'missing', at, target }  the alias at `at` names a path that is not a token
//   { ok: false, cause: 'cycle', cycle, member } the paths of the cycle in order; member says whether the starting
//                                                token is in it or only leads into it
// The type of a token is its own $type, else the type of the token it is an alias of, else the $type of its closest
// group; null when none is set.
export function createResolver(tokens) {
  const memo = new Map();

  function resolve(path) {
    if (memo.has(path)) return memo.get(path);
    const walk = [];
    const index = new Map();
    let current = path;
    let end;
    for (;;) {
      if (memo.has(current)) {
        end = { kind: 'known', state: memo.get(current) };
        break;
      }
      const t = tokens.get(current);
      if (!t) {
        end = { kind: 'missing', at: walk[walk.length - 1], target: current };
        break;
      }
      if (index.has(current)) {
        end = { kind: 'cycle', start: index.get(current) };
        break;
      }
      index.set(current, walk.length);
      walk.push(current);
      if (t.kind === 'value') {
        end = { kind: 'value', token: t };
        break;
      }
      if (t.alias === null) {
        end = { kind: 'missing', at: current, target: '' };
        break;
      }
      current = t.alias;
    }

    if (end.kind === 'value' || (end.kind === 'known' && end.state.ok)) {
      const token = end.kind === 'value' ? end.token : end.state.token;
      let type = end.kind === 'value' ? token.explicitType ?? token.groupType : end.state.type;
      let from = walk.length - 1;
      if (end.kind === 'value') {
        memo.set(walk[from], { ok: true, token, type });
        from -= 1;
      }
      for (let k = from; k >= 0; k -= 1) {
        type = tokens.get(walk[k]).explicitType ?? type;
        memo.set(walk[k], { ok: true, token, type });
      }
    } else if (end.kind === 'known') {
      for (const p of walk) memo.set(p, { ...end.state, member: false });
    } else if (end.kind === 'missing') {
      for (const p of walk) memo.set(p, { ok: false, cause: 'missing', at: end.at, target: end.target });
    } else {
      const cycle = walk.slice(end.start);
      walk.forEach((p, k) => memo.set(p, { ok: false, cause: 'cycle', cycle, member: k >= end.start }));
    }
    return memo.get(path) ?? { ok: false, cause: 'missing', at: undefined, target: path };
  }

  return {
    resolve,
    // The type of a token, or null when it cannot be found.
    type: (path) => {
      const r = resolve(path);
      return r.ok ? r.type : null;
    }
  };
}

// The same for one call.
export function resolveToken(tokens, path) {
  return createResolver(tokens).resolve(path);
}

export function effectiveType(tokens, path) {
  return createResolver(tokens).type(path);
}
