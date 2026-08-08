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
    interop.push(L, value);
  }
}

async function fetchWithTimeout(url, options = {}, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function readOptions(L, idx) {
  const val = interop.tojs(L, idx);
  return val && typeof val === 'object' ? val : {};
}

function storeCallback(L) {
  lua.lua_pushvalue(L, -1);
  return lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
}

export function createNetApi(runtime) {
  const api = {
    get: (L) => {
      const url = String(interop.tojs(L, 1) || '');
      const options = readOptions(L, 2);
      const ref = storeCallback(L);
      runtime.netFetch('GET', url, options, ref);
      return 0;
    },

    post: (L) => {
      const url = String(interop.tojs(L, 1) || '');
      const body = interop.tojs(L, 2);
      const options = readOptions(L, 3);
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
      const ref = storeCallback(L);
      runtime.netFetch('POST', url, options, ref);
      return 0;
    },

    put: (L) => {
      const url = String(interop.tojs(L, 1) || '');
      const body = interop.tojs(L, 2);
      const options = readOptions(L, 3);
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
      const ref = storeCallback(L);
      runtime.netFetch('PUT', url, options, ref);
      return 0;
    },

    delete: (L) => {
      const url = String(interop.tojs(L, 1) || '');
      const options = readOptions(L, 2);
      const ref = storeCallback(L);
      runtime.netFetch('DELETE', url, options, ref);
      return 0;
    },

    parse_json: (L) => {
      const text = String(interop.tojs(L, 1) || '{}');
      try {
        const data = JSON.parse(text);
        pushLuaTable(L, data);
      } catch (err) {
        lua.lua_pushnil(L);
      }
      return 1;
    },

    url_encode: (L) => {
      const text = String(interop.tojs(L, 1) || '');
      interop.push(L, encodeURIComponent(text));
      return 1;
    },

    get_network_stats: (L) => {
      pushLuaTable(L, {
        hashrate_ths: 12,
        unit: 'TH/s',
        source: 'default',
      });
      return 1;
    },

    get_coin_price: (L) => {
      const coin = String(interop.tojs(L, 1) || 'BTC').toUpperCase();
      const callbackRef = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);

      const defaults = {
        BTC: 65000,
        ETH: 3500,
        LTC: 75,
        DOGE: 0.12,
      };

      function resolve(usd, source) {
        runtime.invokeCallback(callbackRef, [{ coin, usd, source }]);
      }

      async function fetchMempool() {
        if (coin !== 'BTC') {
          fetchCoinGecko();
          return;
        }
        try {
          const res = await fetchWithTimeout('/api/mempool/v1/prices');
          if (!res.ok) throw new Error('mempool http ' + res.status);
          const data = await res.json();
          const usd = data && data.USD;
          if (typeof usd !== 'number') throw new Error('mempool invalid response');
          resolve(usd, 'mempool');
        } catch {
          fetchCoinGecko();
        }
      }

      async function fetchCoinGecko() {
        try {
          const id = coin === 'BTC' ? 'bitcoin' : coin === 'ETH' ? 'ethereum' : coin === 'LTC' ? 'litecoin' : coin === 'DOGE' ? 'dogecoin' : '';
          if (!id) throw new Error('unsupported coin for coingecko');
          const res = await fetchWithTimeout(`/api/coingecko/simple/price?ids=${id}&vs_currencies=usd`);
          if (!res.ok) throw new Error('coingecko http ' + res.status);
          const data = await res.json();
          const usd = data && data[id] && data[id].usd;
          if (typeof usd !== 'number') throw new Error('coingecko invalid response');
          resolve(usd, 'coingecko');
        } catch {
          resolve(defaults[coin] || 0, 'default');
        }
      }

      fetchMempool();
      return 0;
    },

    get_local_ip: (L) => {
      interop.push(L, '192.168.1.100');
      return 1;
    },
  };

  return {
    register(L) {
      lua.lua_createtable(L, 0, Object.keys(api).length);
      for (const [name, fn] of Object.entries(api)) {
        lua.lua_pushjsfunction(L, fn);
        lua.lua_setfield(L, -2, name);
      }
    }
  };
}
