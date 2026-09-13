/**
 * Tipos de la base de datos. Escritos a mano a partir de la migración para no
 * depender de Docker (supabase gen types). Si cambia el esquema, actualizar aquí.
 */
import type { TipoMovimiento } from "./inventario";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type RolUsuario = "propietaria" | "ayudante";
export type CategoriaProducto = "areta" | "collar" | "pulsera" | "anillo" | "otro";
export type TipoContacto = "cliente" | "vendedora" | "mayorista" | "proveedor";
export type TipoPrecio = "base" | "publico" | "mayorista" | "costo";
export type AccionAuditoria = "crear" | "editar" | "borrar" | "restaurar";
export type MedioPago = "efectivo" | "transferencia" | "nequi" | "daviplata" | "tarjeta" | "otro";
export type EstadoConsignacion = "abierta" | "parcial" | "cerrada";
export type EstadoCuenta = "abierta" | "pagada";
export type OrigenCuenta = "venta" | "consignacion";

export const MEDIOS_PAGO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export const ESTADOS_CONSIGNACION: Record<EstadoConsignacion, string> = {
  abierta: "Abierta",
  parcial: "Parcialmente liquidada",
  cerrada: "Cerrada",
};

export const CATEGORIAS: Record<CategoriaProducto, string> = {
  areta: "Aretas",
  collar: "Collares",
  pulsera: "Pulseras",
  anillo: "Anillos",
  otro: "Otros",
}

export const CATEGORIA_SINGULAR: Record<CategoriaProducto, string> = {
  areta: "Areta",
  collar: "Collar",
  pulsera: "Pulsera",
  anillo: "Anillo",
  otro: "Otro",
}

export const TIPOS_CONTACTO: Record<TipoContacto, string> = {
  cliente: "Cliente final",
  vendedora: "Vendedora en consignación",
  mayorista: "Mayorista",
  proveedor: "Proveedor",
}

/** Materiales o líneas sugeridos (la usuaria puede escribir otros). */
export const MATERIALES_SUGERIDOS = [
  "Mallorca",
  "Perla",
  "Coral",
  "Shell",
  "Ágata",
  "Murano",
  "Plata ley 925",
  "Dorado",
  "Plateado",
  "Topo gancho",
  "Topo presión",
];

export type Perfil = {
  id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

export type Ajustes = {
  id: number;
  nombre_negocio: string;
  telefono_negocio: string;
  prefijo_general: string;
  prefijo_pulsera: string;
  regla_precio_publico: "manual" | "multiplicador";
  factor_precio_publico: number;
  redondeo_precio_publico: "ninguno" | "centena" | "mil" | "terminacion_900";
  stock_minimo_predeterminado: number;
  impresora_modelo: string;
  etiqueta_ancho_mm: number;
  etiqueta_alto_mm: number;
  etiqueta_dpi: number;
  etiqueta_mostrar_precio_miles: boolean;
  etiqueta_lineas: string[];
  catalogo_publico_activo: boolean;
  catalogo_slug: string;
  respaldo_destino: "ninguno" | "r2" | "drive";
  ultimo_respaldo_en: string | null;
  ultimo_respaldo_detalle: string | null;
  actualizado_en: string;
};

export type Contacto = {
  id: string;
  nombre: string;
  telefono: string;
  tipo: TipoContacto;
  direccion: string;
  notas: string;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  eliminado_en: string | null;
};

export type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaProducto;
  subcategoria: string;
  material: string;
  color: string;
  precio_base: number;
  precio_publico: number;
  precio_mayorista: number | null;
  costo_compra: number | null;
  stock_actual: number;
  stock_minimo: number;
  proveedor_id: string | null;
  activo: boolean;
  visible_catalogo: boolean;
  notas: string;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  eliminado_en: string | null;
};

export type ProductoFoto = {
  id: string;
  producto_id: string;
  ruta: string;
  ruta_miniatura: string;
  principal: boolean;
  orden: number;
  ancho: number | null;
  alto: number | null;
  bytes: number | null;
  creado_por: string | null;
  creado_en: string;
};

export type PrecioHistorial = {
  id: number;
  producto_id: string;
  tipo: TipoPrecio;
  valor_anterior: number | null;
  valor_nuevo: number | null;
  cambiado_por: string | null;
  cambiado_en: string;
};

export type MovimientoInventario = {
  id: string;
  tipo: TipoMovimiento;
  producto_id: string;
  cantidad: number;
  valor_unitario: number;
  documento_tipo: string | null;
  documento_id: string | null;
  fecha: string;
  nota: string;
  registrado_por: string | null;
  creado_en: string;
  eliminado_en: string | null;
};

export type Auditoria = {
  id: number;
  tabla: string;
  registro_id: string;
  accion: AccionAuditoria;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  usuario_id: string | null;
  fecha: string;
};

export type Venta = {
  id: string;
  numero: number;
  fecha: string;
  contacto_id: string | null;
  subtotal: number;
  descuento_total: number;
  total: number;
  medio_pago: MedioPago;
  nota: string;
  registrado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  eliminado_en: string | null;
};

export type VentaLinea = {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  creado_en: string;
};

export type Consignacion = {
  id: string;
  numero: number;
  contacto_id: string;
  fecha_entrega: string;
  estado: EstadoConsignacion;
  total_entregado: number;
  total_vendido: number;
  total_devuelto: number;
  total_pendiente: number;
  nota: string;
  registrado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  eliminado_en: string | null;
};

export type ConsignacionLinea = {
  id: string;
  consignacion_id: string;
  producto_id: string;
  cantidad_entregada: number;
  valor_unitario: number;
  cantidad_vendida: number;
  cantidad_devuelta: number;
  cantidad_pendiente: number;
  creado_en: string;
};

export type Liquidacion = {
  id: string;
  consignacion_id: string;
  fecha: string;
  total_vendido: number;
  nota: string;
  registrado_por: string | null;
  creado_en: string;
  eliminado_en: string | null;
};

export type LiquidacionLinea = {
  id: string;
  liquidacion_id: string;
  consignacion_linea_id: string;
  cantidad_vendida: number;
  cantidad_devuelta: number;
};

export type CuentaPorCobrar = {
  id: string;
  contacto_id: string | null;
  origen_tipo: OrigenCuenta;
  origen_id: string;
  fecha: string;
  valor_total: number;
  abonado: number;
  saldo: number;
  estado: EstadoCuenta;
  creado_en: string;
  actualizado_en: string;
  eliminado_en: string | null;
};

export type Abono = {
  id: string;
  cuenta_id: string;
  fecha: string;
  valor: number;
  medio_pago: MedioPago;
  nota: string;
  registrado_por: string | null;
  creado_en: string;
  eliminado_en: string | null;
};

export type SaldoPorContacto = {
  contacto_id: string;
  nombre: string;
  telefono: string;
  tipo: TipoContacto;
  saldo: number;
  cuentas_abiertas: number;
  desde: string;
  dias: number;
};

export type FilaPapelera = {
  tabla: string;
  id: string;
  descripcion: string;
  eliminado_en: string;
};

type Insertable<T, Opcionales extends keyof T> = Omit<T, Opcionales> & Partial<Pick<T, Opcionales>>;

type Relacion = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

export type { Relacion };

/** Forma que espera supabase-js para tipar el cliente. */
export type Database = {
  public: {
    Tables: {
      perfiles: { Row: Perfil; Insert: Insertable<Perfil, "creado_en" | "actualizado_en" | "activo" | "nombre" | "correo" | "rol">; Update: Partial<Perfil>; Relationships: [] };
      ajustes: { Row: Ajustes; Insert: Partial<Ajustes>; Update: Partial<Ajustes>; Relationships: [] };
      contactos: {
        Row: Contacto;
        Insert: Insertable<Contacto, "id" | "telefono" | "tipo" | "direccion" | "notas" | "creado_por" | "creado_en" | "actualizado_en" | "eliminado_en">;
        Update: Partial<Contacto>;
        Relationships: [];
      };
      productos: {
        Row: Producto;
        Relationships: [
          { foreignKeyName: "productos_proveedor_id_fkey"; columns: ["proveedor_id"]; isOneToOne: false; referencedRelation: "contactos"; referencedColumns: ["id"] },
          { foreignKeyName: "productos_creado_por_fkey"; columns: ["creado_por"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ];
        Insert: Insertable<
          Producto,
          | "id" | "subcategoria" | "material" | "color" | "precio_base" | "precio_publico" | "precio_mayorista" | "costo_compra"
          | "stock_actual" | "stock_minimo" | "proveedor_id" | "activo" | "visible_catalogo" | "notas" | "creado_por" | "creado_en"
          | "actualizado_en" | "eliminado_en" | "categoria"
        >;
        Update: Partial<Producto>;
      };
      producto_fotos: {
        Row: ProductoFoto;
        Relationships: [{ foreignKeyName: "producto_fotos_producto_id_fkey"; columns: ["producto_id"]; isOneToOne: false; referencedRelation: "productos"; referencedColumns: ["id"] }];
        Insert: Insertable<ProductoFoto, "id" | "principal" | "orden" | "ancho" | "alto" | "bytes" | "creado_por" | "creado_en">;
        Update: Partial<ProductoFoto>;
      };
      precio_historial: {
        Row: PrecioHistorial;
        Insert: never;
        Update: never;
        Relationships: [{ foreignKeyName: "precio_historial_producto_id_fkey"; columns: ["producto_id"]; isOneToOne: false; referencedRelation: "productos"; referencedColumns: ["id"] }];
      };
      movimientos_inventario: {
        Row: MovimientoInventario;
        Relationships: [
          { foreignKeyName: "movimientos_inventario_producto_id_fkey"; columns: ["producto_id"]; isOneToOne: false; referencedRelation: "productos"; referencedColumns: ["id"] },
          { foreignKeyName: "movimientos_inventario_registrado_por_fkey"; columns: ["registrado_por"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ];
        Insert: Insertable<MovimientoInventario, "id" | "valor_unitario" | "documento_tipo" | "documento_id" | "fecha" | "nota" | "registrado_por" | "creado_en" | "eliminado_en">;
        Update: Partial<MovimientoInventario>;
      };
      auditoria: { Row: Auditoria; Insert: never; Update: never; Relationships: [] };
      ventas: {
        Row: Venta;
        Insert: Partial<Venta>;
        Update: Partial<Venta>;
        Relationships: [{ foreignKeyName: "ventas_contacto_id_fkey"; columns: ["contacto_id"]; isOneToOne: false; referencedRelation: "contactos"; referencedColumns: ["id"] }];
      };
      venta_lineas: {
        Row: VentaLinea;
        Insert: Partial<VentaLinea>;
        Update: Partial<VentaLinea>;
        Relationships: [
          { foreignKeyName: "venta_lineas_venta_id_fkey"; columns: ["venta_id"]; isOneToOne: false; referencedRelation: "ventas"; referencedColumns: ["id"] },
          { foreignKeyName: "venta_lineas_producto_id_fkey"; columns: ["producto_id"]; isOneToOne: false; referencedRelation: "productos"; referencedColumns: ["id"] },
        ];
      };
      consignaciones: {
        Row: Consignacion;
        Insert: Partial<Consignacion>;
        Update: Partial<Consignacion>;
        Relationships: [{ foreignKeyName: "consignaciones_contacto_id_fkey"; columns: ["contacto_id"]; isOneToOne: false; referencedRelation: "contactos"; referencedColumns: ["id"] }];
      };
      consignacion_lineas: {
        Row: ConsignacionLinea;
        Insert: Partial<ConsignacionLinea>;
        Update: Partial<ConsignacionLinea>;
        Relationships: [
          { foreignKeyName: "consignacion_lineas_consignacion_id_fkey"; columns: ["consignacion_id"]; isOneToOne: false; referencedRelation: "consignaciones"; referencedColumns: ["id"] },
          { foreignKeyName: "consignacion_lineas_producto_id_fkey"; columns: ["producto_id"]; isOneToOne: false; referencedRelation: "productos"; referencedColumns: ["id"] },
        ];
      };
      liquidaciones: {
        Row: Liquidacion;
        Insert: Partial<Liquidacion>;
        Update: Partial<Liquidacion>;
        Relationships: [{ foreignKeyName: "liquidaciones_consignacion_id_fkey"; columns: ["consignacion_id"]; isOneToOne: false; referencedRelation: "consignaciones"; referencedColumns: ["id"] }];
      };
      liquidacion_lineas: {
        Row: LiquidacionLinea;
        Insert: Partial<LiquidacionLinea>;
        Update: Partial<LiquidacionLinea>;
        Relationships: [
          { foreignKeyName: "liquidacion_lineas_liquidacion_id_fkey"; columns: ["liquidacion_id"]; isOneToOne: false; referencedRelation: "liquidaciones"; referencedColumns: ["id"] },
          { foreignKeyName: "liquidacion_lineas_consignacion_linea_id_fkey"; columns: ["consignacion_linea_id"]; isOneToOne: false; referencedRelation: "consignacion_lineas"; referencedColumns: ["id"] },
        ];
      };
      cuentas_por_cobrar: {
        Row: CuentaPorCobrar;
        Insert: never;
        Update: never;
        Relationships: [{ foreignKeyName: "cuentas_por_cobrar_contacto_id_fkey"; columns: ["contacto_id"]; isOneToOne: false; referencedRelation: "contactos"; referencedColumns: ["id"] }];
      };
      abonos: {
        Row: Abono;
        Insert: Partial<Abono>;
        Update: Partial<Abono>;
        Relationships: [{ foreignKeyName: "abonos_cuenta_id_fkey"; columns: ["cuenta_id"]; isOneToOne: false; referencedRelation: "cuentas_por_cobrar"; referencedColumns: ["id"] }];
      };
    };
    Views: {
      papelera: { Row: FilaPapelera; Relationships: [] };
      saldos_por_contacto: { Row: SaldoPorContacto; Relationships: [] };
      productos_sin_movimiento: { Row: Producto & { ultimo_movimiento: string | null }; Relationships: [] };
      catalogo_publico: {
        Row: Pick<Producto, "id" | "codigo" | "nombre" | "categoria" | "material" | "color" | "precio_publico"> & { foto: string | null; miniatura: string | null };
        Relationships: [];
      };
    };
    Functions: {
      siguiente_codigo: { Args: { prefijo: string; digitos?: number }; Returns: string };
      stock_calculado: { Args: { p_producto_id: string }; Returns: number };
      recalcular_stock: { Args: { p_producto_id: string }; Returns: undefined };
      recalcular_todo_el_stock: { Args: Record<string, never>; Returns: number };
      purgar_papelera: { Args: { dias?: number }; Returns: number };
      es_propietaria: { Args: Record<string, never>; Returns: boolean };
      rol_actual: { Args: Record<string, never>; Returns: RolUsuario | null };
      registrar_venta: { Args: { p: Json }; Returns: string };
      registrar_consignacion: { Args: { p: Json }; Returns: string };
      registrar_liquidacion: { Args: { p: Json }; Returns: string };
      registrar_abono: { Args: { p: Json }; Returns: string };
    };
    Enums: {
      rol_usuario: RolUsuario;
      categoria_producto: CategoriaProducto;
      tipo_contacto: TipoContacto;
      tipo_movimiento: TipoMovimiento;
      tipo_precio: TipoPrecio;
      accion_auditoria: AccionAuditoria;
      medio_pago: MedioPago;
      estado_consignacion: EstadoConsignacion;
      estado_cuenta: EstadoCuenta;
      origen_cuenta: OrigenCuenta;
    };
    CompositeTypes: Record<string, never>;
  };
}
