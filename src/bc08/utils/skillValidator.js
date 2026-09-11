import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua, lauxlib, to_luastring } = fengari;

const BLOCKED_GLOBALS = [
  'os.execute',
  'os.remove',
  'os.rename',
  'os.tmpname',
  'io.open',
  'io.popen',
  'io.read',
  'io.write',
  'dofile',
  'loadfile',
  'load',
  'js',
  'interop',
  'window',
  'document',
  'fetch',
  'eval',
];

const DANGEROUS_PATTERNS = [
  {
    pattern: /repeat\s+until\s+false/,
    level: 'warn',
    message: 'Detected infinite "repeat until false" loop; make sure the script yields via pop_event() or delay.delay_ms(ms)',
  },
];

function checkSyntax(code) {
  const L = lauxlib.luaL_newstate();
  try {
    const status = lauxlib.luaL_loadstring(L, to_luastring(code));
    if (status !== lua.LUA_OK) {
      const top = lua.lua_gettop(L);
      const msg = interop.tojs(L, top);
      return { ok: false, error: `Syntax error: ${msg}` };
    }
    return { ok: true };
  } finally {
    // fengari does not expose lua_close in all builds; rely on GC
    if (L && typeof L === 'object') {
      L.L = null;
    }
  }
}

function checkGlobals(code) {
  const warnings = [];
  for (const name of BLOCKED_GLOBALS) {
    const escaped = name.replace(/\./g, '\\.');
    const regex = new RegExp(`\\b${escaped}\\s*\\(`);
    if (regex.test(code)) {
      warnings.push({
        level: 'error',
        message: `Blocked API call detected: ${name}`,
      });
    }
  }

  // Detect direct access like js.window or interop.push
  const accessRegex = /\b(js|interop|window|document)\s*\.\s*\w+/;
  if (accessRegex.test(code)) {
    warnings.push({
      level: 'error',
      message: 'Direct JavaScript/DOM access is not allowed',
    });
  }

  // require() is only allowed for documented native modules.
  const requireRegex = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  const allowedRequires = ['capability', 'json', 'system', 'storage', 'delay'];
  for (const m of code.matchAll(requireRegex)) {
    if (!allowedRequires.includes(m[1])) {
      warnings.push({
        level: 'error',
        message: `Blocked require module: ${m[1]}`,
      });
    }
  }

  return warnings;
}

function checkPatterns(code) {
  const warnings = [];
  for (const { pattern, level, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push({ level, message });
    }
  }
  return warnings;
}

function checkDelayInLoops(code) {
  // Very basic heuristic: if there is a busy loop without pop_event or delay, warn
  const warnings = [];
  const whileMatches = [...code.matchAll(/\bwhile\b/g)];
  const hasPopEvent = code.includes('claw.display.pop_event');
  const hasDelay = code.includes('delay.delay_ms');
  if (whileMatches.length > 0 && !hasPopEvent && !hasDelay) {
    warnings.push({
      level: 'warn',
      message: 'Busy loop detected without pop_event() or delay.delay_ms(ms); the script may freeze the UI',
    });
  }
  return warnings;
}

function checkApiUsage(code) {
  const warnings = [];
  const apiCalls = [
    ...code.matchAll(/\b(claw\.\w+\.\w+|delay\.\w+|sys\.\w+|net\.\w+|storage\.\w+|system\.\w+|system\.heap\.\w+|capability\.\w+|json\.\w+)\s*\(/g),
  ];
  for (const match of apiCalls) {
    const call = match[1];
    if (!isKnownApi(call)) {
      warnings.push({
        level: 'warn',
        message: `Unknown API call: ${call}`,
      });
    }
  }
  return warnings;
}

function isKnownApi(call) {
  const known = [
    'claw.display.create_page',
    'claw.display.clear_page',
    'claw.display.delete_page',
    'claw.display.button',
    'claw.display.label',
    'claw.display.container',
    'claw.display.image',
    'claw.display.pop_event',
    'claw.display.get_size',
    'claw.display.change_page',
    'claw.rgb.set',
    'claw.rgb.set_mode',
    'claw.rgb.set_zone',
    'claw.rgb.effect',
    'claw.rgb.off',
    'claw.rgb.get_color',
    'delay.delay_ms',
    'sys.log',
    'sys.millis',
    'sys.time',
    'sys.date',
    'net.get',
    'net.post',
    'net.put',
    'net.delete',
    'net.parse_json',
    'net.url_encode',
    'net.get_network_stats',
    'net.get_coin_price',
    'net.get_local_ip',
    'storage.get_root_dir',
    'storage.join_path',
    'storage.exists',
    'storage.read_file',
    'storage.write_file',
    'storage.listdir',
    'storage.get_free_space',
    'system.time',
    'system.date',
    'system.millis',
    'system.uptime',
    'system.ip',
    'system.info',
    'system.heap.get_info',
    'capability.call',
    'json.decode',
    'json.encode',
  ];
  return known.includes(call);
}

export function validateSkillCode(code) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return { ok: false, errors: ['Skill code is empty'], warnings: [] };
  }

  const syntax = checkSyntax(code);
  if (!syntax.ok) {
    return { ok: false, errors: [syntax.error], warnings: [] };
  }

  const warnings = [
    ...checkGlobals(code),
    ...checkPatterns(code),
    ...checkDelayInLoops(code),
    ...checkApiUsage(code),
  ];

  return { ok: true, errors: [], warnings };
}

export function hasBlockingError(warnings) {
  return warnings.some((w) => w.level === 'error');
}
