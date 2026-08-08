import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua } = fengari;

export function createClawRgbApi(runtime) {
  const api = {
    set: (L) => {
      const color = Number(interop.tojs(L, 1) || 0);
      runtime.setRgbState({ mode: 'solid', color, effect: null });
      return 0;
    },

    set_mode: (L) => {
      const mode = String(interop.tojs(L, 1) || 'solid');
      const value = interop.tojs(L, 2);
      if (mode === 'solid') {
        runtime.setRgbState({ mode: 'solid', color: Number(value || 0), effect: null });
      } else if (mode === 'zone') {
        runtime.setRgbState({ mode: 'zone', zones: Array.isArray(value) ? value : runtime.rgbState.zones, effect: null });
      } else if (mode === 'effect') {
        runtime.setRgbState({ mode: 'effect', effect: String(value || ''), effectParams: {} });
      } else {
        runtime.setRgbState({ mode, color: Number(value || 0), effect: null });
      }
      return 0;
    },

    set_zone: (L) => {
      const zone = Number(interop.tojs(L, 1) || 1);
      const color = Number(interop.tojs(L, 2) || 0);
      const zones = [...runtime.rgbState.zones];
      if (zone >= 1 && zone <= zones.length) {
        zones[zone - 1] = color;
      }
      runtime.setRgbState({ mode: 'zone', zones, effect: null });
      return 0;
    },

    effect: (L) => {
      const name = String(interop.tojs(L, 1) || '');
      const params = interop.tojs(L, 2) || {};
      runtime.setRgbState({ mode: 'effect', effect: name, effectParams: params });
      return 0;
    },

    off: () => {
      runtime.setRgbState({ mode: 'solid', color: 0, effect: null });
      return 0;
    },

    get_color: (L) => {
      interop.push(L, runtime.rgbState.color);
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
