import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua, lauxlib, to_luastring } = fengari;

function pushLuaTable(L, value) {
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
      pushLuaTable(L, item);
      lua.lua_rawseti(L, -2, i + 1);
    });
  } else if (typeof value === 'object') {
    const entries = Object.entries(value);
    lua.lua_createtable(L, 0, entries.length);
    for (const [k, v] of entries) {
      lua.lua_pushstring(L, to_luastring(k));
      pushLuaTable(L, v);
      lua.lua_rawset(L, -3);
    }
  } else {
    lua.lua_pushnil(L);
  }
}

export function createJsonApi() {
  return {
    register(L) {
      lua.lua_createtable(L, 0, 2);

      lua.lua_pushjsfunction(L, (LL) => {
        const text = String(interop.tojs(LL, 1) || '{}');
        try {
          const data = JSON.parse(text);
          pushLuaTable(LL, data);
        } catch (err) {
          lua.lua_pushnil(LL);
          lua.lua_pushstring(LL, to_luastring(err.message || 'json decode error'));
          return 2;
        }
        return 1;
      });
      lua.lua_setfield(L, -2, 'decode');

      lua.lua_pushjsfunction(L, (LL) => {
        const value = interop.tojs(LL, 1);
        try {
          const text = JSON.stringify(value);
          lua.lua_pushstring(LL, to_luastring(text));
        } catch (err) {
          lua.lua_pushnil(LL);
          lua.lua_pushstring(LL, to_luastring(err.message || 'json encode error'));
          return 2;
        }
        return 1;
      });
      lua.lua_setfield(L, -2, 'encode');
    },
  };
}
