import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua } = fengari;

export function createStorageApi() {
  const files = new Map();

  const api = {
    get_root_dir: (L) => {
      interop.push(L, '/bc08');
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
