import * as fengari from 'fengari';
import { createClawDisplayApi } from '../apis/clawDisplayApi.js';
import { createClawRgbApi } from '../apis/clawRgbApi.js';
import { createDelayApi } from '../apis/delayApi.js';
import { createNetApi } from '../apis/netApi.js';
import { createStorageApi } from '../apis/storageApi.js';
import { createSysApi } from '../apis/sysApi.js';

const { lua } = fengari;

export function createApiRegistry(runtime) {
  return {
    register(L) {
      lua.lua_createtable(L, 0, 2);

      createClawDisplayApi(runtime).register(L);
      lua.lua_setfield(L, -2, 'display');

      createClawRgbApi(runtime).register(L);
      lua.lua_setfield(L, -2, 'rgb');

      lua.lua_setglobal(L, 'claw');

      createDelayApi(runtime).register(L);
      lua.lua_setglobal(L, 'delay');

      createNetApi(runtime).register(L);
      lua.lua_setglobal(L, 'net');

      createStorageApi().register(L);
      lua.lua_setglobal(L, 'storage');

      createSysApi(runtime).register(L);
      lua.lua_setglobal(L, 'sys');

      lua.lua_pushliteral(L, '0.1');
      lua.lua_setglobal(L, 'BC08_SIM_API');
    }
  };
}
