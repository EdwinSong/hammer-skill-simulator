import * as fengari from 'fengari';
import * as interop from 'fengari-interop';
import { createApiRegistry } from './ApiRegistry.js';
import { validateSkillCode, hasBlockingError } from '../utils/skillValidator.js';

const { lua, lauxlib, lualib, to_luastring } = fengari;

export const SCR_W = 720;
export const SCR_H = 1280;

const RUN_TIMEOUT_MS = Number.POSITIVE_INFINITY;

export class LuaRuntime {
  constructor(opts = {}) {
    this.onLog = opts.onLog || (() => {});
    this.onScreenUpdate = opts.onScreenUpdate || (() => {});
    this.onRgbUpdate = opts.onRgbUpdate || (() => {});
    this.onStateChange = opts.onStateChange || (() => {});
    this.allowedHosts = opts.allowedHosts || [];

    this.L = null;
    this.co = null;
    this.running = false;
    this.timer = null;
    this.startTime = Date.now();
    this.eventQueue = [];
    this.pages = new Map();
    this.rgbState = {
      mode: 'solid',
      color: 0x000000,
      zones: [0, 0, 0, 0],
      effect: null,
      effectParams: {},
    };
    this.apiRegistry = createApiRegistry(this);
  }

  log(level, message) {
    this.onLog({ level, message: String(message), time: Date.now() });
  }

  pushEvent(pageId, objId) {
    this.eventQueue.push([pageId, objId]);
    if (this.co && this.running && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.resume(0);
    }
  }

  setPage(pageId, page) {
    this.pages.set(pageId, page);
    this.onScreenUpdate(this.getScreenState());
  }

  deletePage(pageId) {
    this.pages.delete(pageId);
    this.onScreenUpdate(this.getScreenState());
  }

  clearPages() {
    this.pages.clear();
    this.onScreenUpdate(this.getScreenState());
  }

  getScreenState() {
    return {
      pages: Array.from(this.pages.entries()).map(([id, p]) => ({ id, ...p })),
    };
  }

  setRgbState(state) {
    Object.assign(this.rgbState, state);
    this.onRgbUpdate({ ...this.rgbState });
  }

  getRgbState() {
    return { ...this.rgbState };
  }

  run(code) {
    this.stop();

    const validation = validateSkillCode(code);
    if (validation.warnings.length > 0) {
      for (const w of validation.warnings) {
        this.log(w.level, `[Skill check] ${w.message}`);
      }
    }
    if (!validation.ok || hasBlockingError(validation.warnings)) {
      this.log('error', `Skill validation failed: ${validation.errors.join('; ')}`);
      return;
    }

    this.running = true;
    this.startTime = Date.now();
    this.eventQueue = [];
    this.pages.clear();
    this.rgbState = {
      mode: 'solid',
      color: 0x000000,
      zones: [0, 0, 0, 0],
      effect: null,
      effectParams: {},
    };
    this.onRgbUpdate(this.getRgbState());
    this.onScreenUpdate(this.getScreenState());
    this.onStateChange('running');

    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);
    lauxlib.luaL_requiref(this.L, to_luastring('js'), interop.luaopen_js, 1);
    lua.lua_pop(this.L, 1);

    // Provide require() for documented native modules so skills that use
    // `local capability = require("capability")` (as in API_REFERENCE.md) work.
    const requireStub = (L2) => {
      const name = String(interop.tojs(L2, 1) || '');
      const allowed = ['capability', 'json', 'system', 'storage', 'delay'];
      if (!allowed.includes(name)) {
        lua.lua_pushnil(L2);
        lua.lua_pushstring(L2, to_luastring(`module '${name}' not found`));
        return 2;
      }
      lua.lua_getglobal(L2, name);
      if (lua.lua_isnil(L2, -1)) {
        lua.lua_pop(L2, 1);
        lua.lua_createtable(L2, 0, 0);
        lua.lua_pushvalue(L2, -1);
        lua.lua_setglobal(L2, name);
      }
      return 1;
    };
    lua.lua_pushjsfunction(this.L, requireStub);
    lua.lua_setglobal(this.L, 'require');

    lua.lua_atnativeerror(this.L, (L2) => {
      const err = interop.tojs(L2, 1);
      this.log('error', `Native error: ${err && err.stack ? err.stack : err}`);
      interop.push(L2, String(err));
      return 1;
    });

    this.apiRegistry.register(this.L);

    this.co = lua.lua_newthread(this.L);

    const loadStatus = lauxlib.luaL_loadstring(this.co, to_luastring(code));
    if (loadStatus !== lua.LUA_OK) {
      const msg = interop.tojs(this.co, lua.lua_gettop(this.co));
      this.log('error', `Load error: ${msg}`);
      this.stop();
      return;
    }

    this.resume(0);
  }

  resume(delayMs) {
    if (!this.running || !this.co) return;
    if (delayMs > 0) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.doResume();
      }, delayMs);
    } else {
      this.doResume();
    }
  }

  doResume() {
    if (!this.running || !this.co) return;

    if (Date.now() - this.startTime > RUN_TIMEOUT_MS) {
      this.log('error', `Script timeout (${RUN_TIMEOUT_MS / 1000}s)`);
      this.stop();
      return;
    }

    const status = lua.lua_resume(this.co, this.L, 0);
    if (status === lua.LUA_OK) {
      this.log('info', 'Script finished');
      this.stop();
    } else if (status !== lua.LUA_YIELD) {
      const top = lua.lua_gettop(this.co);
      const type = lua.lua_type(this.co, top);
      const msg = interop.tojs(this.co, top);
      this.log('error', `Runtime error (${status}, type=${type}): ${msg}`);
      this.stop();
    }
  }

  delay(ms, L, k) {
    if (!this.running) return 0;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.doResume();
    }, ms);
    return lua.lua_yieldk(L, 0, 0, k || null);
  }

  pushValue(L, value) {
    if (value === null || value === undefined) {
      lua.lua_pushnil(L);
    } else if (typeof value === 'number') {
      lua.lua_pushnumber(L, value);
    } else if (typeof value === 'string') {
      lua.lua_pushstring(L, to_luastring(value));
    } else if (typeof value === 'boolean') {
      lua.lua_pushboolean(L, value);
    } else if (Array.isArray(value)) {
      lua.lua_createtable(L, value.length, 0);
      value.forEach((item, i) => {
        this.pushValue(L, item);
        lua.lua_rawseti(L, -2, i + 1);
      });
    } else if (typeof value === 'object') {
      const entries = Object.entries(value);
      lua.lua_createtable(L, 0, entries.length);
      for (const [k, v] of entries) {
        lua.lua_pushstring(L, to_luastring(k));
        this.pushValue(L, v);
        lua.lua_rawset(L, -3);
      }
    } else {
      interop.push(L, value);
    }
  }

  netFetch(method, url, options, callbackRef) {
    if (!this.running) return;

    const isRelative = url.startsWith('/');
    const isAbsolute = /^https?:\/\//i.test(url);

    if (isAbsolute) {
      try {
        const parsed = new URL(url);
        if (this.allowedHosts.length > 0 && !this.allowedHosts.some(h => parsed.hostname.endsWith(h))) {
          this.log('warn', `[net] blocked: ${method} ${url} (host not allowed)`);
          this.invokeCallback(callbackRef, [0, `Host not allowed: ${parsed.hostname}`, {}]);
          return;
        }
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          this.log('warn', `[net] blocked: ${method} ${url} (protocol ${parsed.protocol})`);
          this.invokeCallback(callbackRef, [0, 'Only http/https allowed', {}]);
          return;
        }
      } catch {
        this.log('error', `[net] invalid URL: ${method} ${url}`);
        this.invokeCallback(callbackRef, [0, 'Invalid URL', {}]);
        return;
      }
    } else if (!isRelative) {
      this.log('error', `[net] invalid URL: ${method} ${url}`);
      this.invokeCallback(callbackRef, [0, 'Invalid URL', {}]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Route absolute external URLs through the Vite dev-server CORS proxy
    // so Lua scripts can fetch any http/https endpoint in the browser.
    // Relative URLs (e.g. /api/coingecko/...) are served by the dev-server proxy.
    // In Node.js test runners there is no base URL, so fetch directly.
    const isBrowser = typeof window !== 'undefined' && window.location != null;
    const fetchUrl = isAbsolute && isBrowser
      ? `/api/proxy?url=${encodeURIComponent(url)}`
      : url;

    this.log('info', `[net] start: ${method} ${url} (fetching ${fetchUrl})`);

    fetch(fetchUrl, { method, ...options, signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeout);
        const body = await res.text();
        this.log('info', `[net] done: ${method} ${url} -> status=${res.status}, body=${body.length} bytes`);
        this.invokeCallback(callbackRef, [res.status, body, {}]);
      })
      .catch((err) => {
        clearTimeout(timeout);
        let message = err.message || String(err);
        const isTimeout = err.name === 'AbortError' || message.includes('timed out') || message.includes('timeout');
        if (isTimeout) {
          message += ` (timeout after 10000ms)`;
        } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
          message += ' (possible CORS block; use Nginx/Vite proxy for external APIs)';
        }
        this.log('error', `[net] failed: ${method} ${url} -> ${message}`);
        this.invokeCallback(callbackRef, [0, message, {}]);
      });
  }

  invokeCallback(ref, args) {
    if (!this.L) return;
    lua.lua_rawgeti(this.L, lua.LUA_REGISTRYINDEX, ref);
    lauxlib.luaL_unref(this.L, lua.LUA_REGISTRYINDEX, ref);
    if (lua.lua_isnil(this.L, -1)) {
      lua.lua_pop(this.L, 1);
      return;
    }
    for (const arg of args) {
      this.pushValue(this.L, arg);
    }
    const status = lua.lua_pcall(this.L, args.length, 0, 0);
    if (status !== lua.LUA_OK) {
      const msg = interop.tojs(this.L, lua.lua_gettop(this.L));
      this.log('error', `Callback error: ${msg}`);
      lua.lua_pop(this.L, 1);
    }
  }

  invokeCapabilityCallback(ref, ok, out, err) {
    this.invokeCallback(ref, [ok, out, err]);
  }

  changePage(pageId) {
    this.onScreenUpdate({ activePage: pageId, pages: this.getScreenState().pages });
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.L = null;
    this.co = null;
    this.onStateChange('stopped');
  }

  isRunning() {
    return this.running;
  }
}
