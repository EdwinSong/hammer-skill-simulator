import * as fengari from 'fengari';
import * as interop from 'fengari-interop';
import { SCR_W, SCR_H } from '../core/LuaRuntime.js';

const { lua } = fengari;

function checkPage(runtime, pageId) {
  return runtime.pages.get(pageId) || { title: '', controls: [] };
}

// Upsert: replace an existing control with the same id, or append if new.
function upsertControl(runtime, pageId, control) {
  const page = checkPage(runtime, pageId);
  const idx = page.controls.findIndex((c) => c.id === control.id);
  if (idx >= 0) {
    const next = [...page.controls];
    next[idx] = control;
    runtime.setPage(pageId, { ...page, controls: next });
  } else {
    runtime.setPage(pageId, { ...page, controls: [...page.controls, control] });
  }
}

export function createClawDisplayApi(runtime) {
  const api = {
    create_page: (L) => {
      const pageId = interop.tojs(L, 1);
      const title = interop.tojs(L, 2);
      runtime.setPage(pageId, { title: String(title), controls: [] });
      return 0;
    },

    clear_page: (L) => {
      const pageId = interop.tojs(L, 1);
      const page = checkPage(runtime, pageId);
      runtime.setPage(pageId, { ...page, controls: [] });
      return 0;
    },

    delete_page: (L) => {
      const pageId = interop.tojs(L, 1);
      runtime.deletePage(pageId);
      return 0;
    },

    button: (L) => {
      const pageId = interop.tojs(L, 1);
      const control = {
        type: 'button',
        id: interop.tojs(L, 2),
        x: interop.tojs(L, 3) || 0,
        y: interop.tojs(L, 4) || 0,
        w: interop.tojs(L, 5) || 0,
        h: interop.tojs(L, 6) || 0,
        text: String(interop.tojs(L, 7) || ''),
        color: Number(interop.tojs(L, 8) || 0),
      };
      upsertControl(runtime, pageId, control);
      return 0;
    },

    label: (L) => {
      const pageId = interop.tojs(L, 1);
      const control = {
        type: 'label',
        id: interop.tojs(L, 2),
        x: interop.tojs(L, 3) || 0,
        y: interop.tojs(L, 4) || 0,
        text: String(interop.tojs(L, 5) || ''),
        color: Number(interop.tojs(L, 6) || 0),
        font_size: Number(interop.tojs(L, 7) || 24),
      };
      upsertControl(runtime, pageId, control);
      return 0;
    },

    container: (L) => {
      const pageId = interop.tojs(L, 1);
      const control = {
        type: 'container',
        id: interop.tojs(L, 2),
        x: interop.tojs(L, 3) || 0,
        y: interop.tojs(L, 4) || 0,
        w: interop.tojs(L, 5) || 0,
        h: interop.tojs(L, 6) || 0,
        color: Number(interop.tojs(L, 7) || 0),
        radius: Number(interop.tojs(L, 8) || 0),
      };
      upsertControl(runtime, pageId, control);
      return 0;
    },

    image: (L) => {
      const pageId = interop.tojs(L, 1);
      const control = {
        type: 'image',
        id: interop.tojs(L, 2),
        x: interop.tojs(L, 3) || 0,
        y: interop.tojs(L, 4) || 0,
        w: interop.tojs(L, 5) || 0,
        h: interop.tojs(L, 6) || 0,
        path: String(interop.tojs(L, 7) || ''),
      };
      upsertControl(runtime, pageId, control);
      return 0;
    },

    pop_event: (L) => {
      const ev = runtime.eventQueue.shift();
      if (ev) {
        interop.push(L, ev[0]);
        interop.push(L, ev[1]);
      } else {
        lua.lua_pushnil(L);
        lua.lua_pushnil(L);
      }
      return 2;
    },

    get_size: (L) => {
      interop.push(L, SCR_W);
      interop.push(L, SCR_H);
      return 2;
    },

    change_page: (L) => {
      const pageId = interop.tojs(L, 1);
      runtime.changePage(Number(pageId));
      return 0;
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
