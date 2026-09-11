import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua, to_luastring } = fengari;

export function createStorageApi() {
  const files = new Map();

  const api = {
    get_root_dir: (L) => {
      // API_REFERENCE.md: persistent flash storage is mounted under /fatfs.
      interop.push(L, '/fatfs');
      return 1;
    },

    join_path: (L) => {
      const n = lua.lua_gettop(L);
      const parts = [];
      for (let i = 1; i <= n; i++) {
        parts.push(String(interop.tojs(L, i) || ''));
      }
      const joined = parts.join('/').replace(/\/+/g, '/');
      interop.push(L, joined);
      return 1;
    },

    exists: (L) => {
      const path = interop.tojs(L, 1);
      interop.push(L, files.has(path));
      return 1;
    },

    read_file: (L) => {
      const path = interop.tojs(L, 1);
      if (!files.has(path)) {
        return lua.luaL_error(L, `File not found: ${path}`);
      }
      interop.push(L, files.get(path));
      return 1;
    },

    write_file: (L) => {
      const path = interop.tojs(L, 1);
      const content = interop.tojs(L, 2);
      files.set(path, String(content));
      return 0;
    },

    listdir: (L) => {
      const dir = String(interop.tojs(L, 1) || '');
      const prefix = dir.endsWith('/') ? dir : dir + '/';
      const seen = new Set();
      const entries = [];
      for (const p of files.keys()) {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          const name = rest.split('/')[0];
          if (name && !seen.has(name)) {
            seen.add(name);
            entries.push(name);
          }
        }
      }
      lua.lua_createtable(L, entries.length, 0);
      entries.forEach((name, i) => {
        lua.lua_pushstring(L, to_luastring(name));
        lua.lua_rawseti(L, -2, i + 1);
      });
      return 1;
    },

    get_free_space: (L) => {
      const used = Array.from(files.values()).reduce((sum, c) => sum + c.length, 0);
      const total = 8 * 1024 * 1024;
      const free = Math.max(0, total - used);
      lua.lua_pushnumber(L, total);
      lua.lua_pushnumber(L, free);
      lua.lua_pushnumber(L, used);
      return 3;
    },
  };

  return {
    register(L) {
      lua.lua_createtable(L, 0, 5);

      for (const [name, fn] of Object.entries(api)) {
        lua.lua_pushjsfunction(L, fn);
        lua.lua_setfield(L, -2, name);
      }
    },
  };
}
