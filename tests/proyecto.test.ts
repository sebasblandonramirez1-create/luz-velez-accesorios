import { describe, expect, it } from "vitest";
import { enlacePanelSupabase, estadoEnGestion, interpretarEstado, pedirReactivacion, refDelProyecto, sondearApi } from "@/lib/supabase/proyecto";

type Falso = (entrada: string | URL | Request, init?: RequestInit) => Promise<Response>;

describe("refDelProyecto", () => {
  it("saca la referencia de la URL del proyecto", () => {
    expect(refDelProyecto("https://tklopxvtbwzdgseacqyw.supabase.co")).toBe("tklopxvtbwzdgseacqyw");
    expect(refDelProyecto("https://abc123.supabase.co/rest/v1/")).toBe("abc123");
    expect(refDelProyecto("http://localhost:54321")).toBeNull();
    expect(refDelProyecto(undefined)).toBeNull();
  });
  it("enlaza al panel", () => {
    expect(enlacePanelSupabase("abc")).toBe("https://supabase.com/dashboard/project/abc");
    expect(enlacePanelSupabase(null)).toBeNull();
  });
});

describe("interpretarEstado", () => {
  it("traduce los estados de Supabase", () => {
    expect(interpretarEstado("ACTIVE_HEALTHY")).toBe("activa");
    expect(interpretarEstado("INACTIVE")).toBe("dormida");
    expect(interpretarEstado("RESTORING")).toBe("despertando");
    expect(interpretarEstado("COMING_UP")).toBe("despertando");
    expect(interpretarEstado("algo-raro")).toBe("desconocido");
    expect(interpretarEstado(null)).toBe("desconocido");
  });
});

describe("sondearApi", () => {
  it("activo cuando la API responde, aunque sea con error de cliente", async () => {
    const ok: Falso = async () => new Response("{}", { status: 200 });
    const noAutorizado: Falso = async () => new Response("", { status: 401 });
    expect(await sondearApi("https://x.supabase.co/", "clave", 1000, ok as typeof fetch)).toBe(true);
    expect(await sondearApi("https://x.supabase.co", "clave", 1000, noAutorizado as typeof fetch)).toBe(true);
  });
  it("dormido cuando no responde nada o falla la conexión", async () => {
    const caido: Falso = async () => {
      throw new TypeError("fetch failed");
    };
    const servidorRoto: Falso = async () => new Response("", { status: 503 });
    expect(await sondearApi("https://x.supabase.co", "clave", 1000, caido as typeof fetch)).toBe(false);
    expect(await sondearApi("https://x.supabase.co", "clave", 1000, servidorRoto as typeof fetch)).toBe(false);
  });
  it("se rinde al vencer el tiempo", async () => {
    const lento: Falso = (_e, init) =>
      new Promise((_resolver, rechazar) => {
        init?.signal?.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
      });
    const inicio = Date.now();
    expect(await sondearApi("https://x.supabase.co", "clave", 50, lento as typeof fetch)).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(2000);
  });
});

describe("API de gestión", () => {
  it("lee el estado y manda el token", async () => {
    let cabecera = "";
    const falso: Falso = async (_e, init) => {
      cabecera = String((init?.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({ status: "INACTIVE" }), { status: 200 });
    };
    expect(await estadoEnGestion("abc", "tok", falso as typeof fetch)).toBe("INACTIVE");
    expect(cabecera).toBe("Bearer tok");
  });
  it("pide la reactivación y explica los errores", async () => {
    let url = "";
    let metodo = "";
    const ok: Falso = async (e, init) => {
      url = String(e);
      metodo = init?.method ?? "";
      return new Response("{}", { status: 200 });
    };
    const r = await pedirReactivacion("abc", "tok", ok as typeof fetch);
    expect(r.ok).toBe(true);
    expect(url).toBe("https://api.supabase.com/v1/projects/abc/restore");
    expect(metodo).toBe("POST");
    const prohibido: Falso = async () => new Response("", { status: 403 });
    expect((await pedirReactivacion("abc", "tok", prohibido as typeof fetch)).ok).toBe(false);
    const caido: Falso = async () => {
      throw new Error("red");
    };
    expect((await pedirReactivacion("abc", "tok", caido as typeof fetch)).mensaje).toMatch(/internet/);
  });
});
