import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua, to_luastring } = fengari;

export function createSystemApi(runtime) {
  function pushInfo(L, info) {
    lua.lua_createtable(L, 0, Object.keys(info).length);
    for (const [k, v] of Object.entries(info)) {
      lua.lua_pushstring(L, to_luastring(k));
      if (typeof v === 'number') {
        lua.lua_pushnumber(L, v);
      } else if (typeof v === 'boolean') {
        lua.lua_pushboolean(L, v);
      } else {
        lua.lua_pushstring(L, to_luastring(String(v)));
      }
      lua.lua_rawset(L, -3);
    }
  }

  const api = {
    time: () => {
      return Math.floor(Date.now() / 1000);
    },

    date: (fmt) => {
      // API_REFERENCE.md: system.date() returns a formatted local date
      // string (default "%Y-%m-%d %H:%M:%S"). "*t" is kept as an extension
      // returning a broken-down table for convenience.
      const d = new Date();
      if (fmt === '*t') {
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour: d.getHours(),
          min: d.getMinutes(),
          sec: d.getSeconds(),
          wday: d.getDay() + 1,
          yday: 0,
        };
      }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    },

    millis: () => {
      return Date.now() - runtime.startTime;
    },

    uptime: () => {
      return Math.floor((Date.now() - runtime.startTime) / 1000);
    },

    ip: () => {
      return '192.168.1.100';
    },

    info: () => {
      return {
        wifi_ssid: 'MyHome_WiFi',
        wifi_rssi: -42,
        sram_free: 320000,
        psram_free: 4200000,
      };
    },

    heap: {
      caps: {
        DEFAULT: 0,
        INTERNAL: 1,
        PSRAM: 2,
      },
      get_info: (cap) => {
        return {
          total_free_bytes: cap === 2 ? 4200000 : 320000,
          minimum_free_bytes: cap === 2 ? 3800000 : 280000,
          largest_free_block: cap === 2 ? 2000000 : 120000,
        };
      },
    },
  };

  function bindApi(obj, targetL) {
    lua.lua_createtable(targetL, 0, Object.keys(obj).length);
    for (const [name, value] of Object.entries(obj)) {
      if (typeof value === 'function') {
        lua.lua_pushjsfunction(targetL, (LL) => {
          const n = lua.lua_gettop(LL);
          const args = [];
          for (let i = 1; i <= n; i++) {
            args.push(interop.tojs(LL, i));
          }
          const result = value(...args);
          if (result && typeof result === 'object' && !Array.isArray(result)) {
            pushInfo(LL, result);
          } else if (typeof result === 'number') {
            lua.lua_pushnumber(LL, result);
          } else if (typeof result === 'boolean') {
            lua.lua_pushboolean(LL, result);
          } else {
            lua.lua_pushstring(LL, to_luastring(result === null || result === undefined ? '' : String(result)));
          }
          return 1;
        });
        lua.lua_setfield(targetL, -2, name);
      } else if (value && typeof value === 'object') {
        bindApi(value, targetL);
        lua.lua_setfield(targetL, -2, name);
      } else {
        if (typeof value === 'number') {
          lua.lua_pushnumber(targetL, value);
        } else if (typeof value === 'boolean') {
          lua.lua_pushboolean(targetL, value);
        } else {
          lua.lua_pushstring(targetL, to_luastring(value === null || value === undefined ? '' : String(value)));
        }
        lua.lua_setfield(targetL, -2, name);
      }
    }
  }

  return {
    register(L) {
      bindApi(api, L);
    },
  };
}
