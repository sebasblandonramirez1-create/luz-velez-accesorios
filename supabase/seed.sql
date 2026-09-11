-- Datos de prueba realistas para explorar la aplicación antes de cargar el
-- catálogo real. Se aplican con `supabase db reset` en local o pegando este
-- archivo en el editor SQL del proyecto (Supabase → SQL Editor).
--
-- Para borrarlos después: delete from public.movimientos_inventario; delete from
-- public.productos; delete from public.contactos;  (o usar la papelera).

-- Contactos
insert into public.contactos (id, nombre, telefono, tipo, notas) values
  ('11111111-1111-4111-8111-111111111101', 'Marcela Ríos',     '3001234567', 'vendedora', 'Vende en la oficina; liquida cada quincena.'),
  ('11111111-1111-4111-8111-111111111102', 'Paola Gómez',      '3109876543', 'vendedora', ''),
  ('11111111-1111-4111-8111-111111111103', 'Clara Vélez',      '3155551212', 'cliente', 'Prefiere plateado.'),
  ('11111111-1111-4111-8111-111111111104', 'Boutique La Perla','3204445566', 'mayorista', 'Pide por docenas.'),
  ('11111111-1111-4111-8111-111111111105', 'Distribuidora San Victorino', '6013334455', 'proveedor', 'Centro, local 214.')
on conflict (id) do nothing;

-- Productos (código, nombre, categoría, subcategoría, material, color, base, público, costo, mínimo)
insert into public.productos (id, codigo, nombre, categoria, subcategoria, material, color, precio_base, precio_publico, costo_compra, stock_minimo, proveedor_id, visible_catalogo) values
  ('22222222-2222-4222-8222-222222222201', 'SLA013', 'Aretas perla de Mallorca topo gancho', 'areta', 'Topo gancho', 'Mallorca', 'Blanco', 40000, 118900, 22000, 2, '11111111-1111-4111-8111-111111111105', true),
  ('22222222-2222-4222-8222-222222222202', 'SLA014', 'Aretas perla de Mallorca topo presión', 'areta', 'Topo presión', 'Mallorca', 'Blanco', 38000, 112900, 20000, 2, '11111111-1111-4111-8111-111111111105', true),
  ('22222222-2222-4222-8222-222222222203', 'SLA020', 'Aretas coral rojo dorado', 'areta', 'Topo gancho', 'Coral', 'Rojo', 35000, 104900, 18000, 2, null, true),
  ('22222222-2222-4222-8222-222222222204', 'SLA021', 'Aretas shell plateado', 'areta', 'Topo gancho', 'Shell', 'Plateado', 28000, 82900, 14000, 3, null, false),
  ('22222222-2222-4222-8222-222222222205', 'SLA030', 'Collar perla de Mallorca 45 cm', 'collar', '', 'Mallorca', 'Blanco', 65000, 192900, 36000, 1, '11111111-1111-4111-8111-111111111105', true),
  ('22222222-2222-4222-8222-222222222206', 'SLA031', 'Collar ágata verde', 'collar', '', 'Ágata', 'Verde', 55000, 162900, 30000, 1, null, true),
  ('22222222-2222-4222-8222-222222222207', 'SLA040', 'Anillo plata ley 925 con circón', 'anillo', '', 'Plata ley 925', 'Plateado', 48000, 142900, 26000, 2, null, true),
  ('22222222-2222-4222-8222-222222222208', 'SLA041', 'Anillo murano azul', 'anillo', '', 'Murano', 'Azul', 30000, 88900, 15000, 2, null, false),
  ('22222222-2222-4222-8222-222222222209', 'SLAP026', 'Pulsera perla de Mallorca', 'pulsera', '', 'Mallorca', 'Blanco', 42000, 124900, 23000, 2, '11111111-1111-4111-8111-111111111105', true),
  ('22222222-2222-4222-8222-222222222210', 'SLAP037', 'Pulsera coral y dorado', 'pulsera', '', 'Coral', 'Rojo', 36000, 106900, 19000, 2, null, true),
  ('22222222-2222-4222-8222-222222222211', 'SLAP038', 'Pulsera shell multicolor', 'pulsera', '', 'Shell', 'Multicolor', 25000, 74900, 12000, 3, null, false),
  ('22222222-2222-4222-8222-222222222212', 'SLA050', 'Aretas dorado topo presión (agotadas)', 'areta', 'Topo presión', 'Dorado', 'Dorado', 22000, 64900, 11000, 2, null, false)
on conflict (id) do nothing;

-- Entradas de inventario (el stock se calcula solo a partir de estos movimientos)
insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, fecha, nota) values
  ('entrada_compra', '22222222-2222-4222-8222-222222222201', 12, 22000, now() - interval '40 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222202', 10, 20000, now() - interval '40 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222203', 8,  18000, now() - interval '35 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222204', 6,  14000, now() - interval '35 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222205', 4,  36000, now() - interval '30 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222206', 3,  30000, now() - interval '30 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222207', 5,  26000, now() - interval '25 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222208', 4,  15000, now() - interval '25 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222209', 9,  23000, now() - interval '20 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222210', 7,  19000, now() - interval '20 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222211', 6,  12000, now() - interval '15 days', 'Compra inicial'),
  ('entrada_compra', '22222222-2222-4222-8222-222222222212', 3,  11000, now() - interval '60 days', 'Compra inicial'),
  -- algunas salidas para que haya stock bajo y agotados
  ('perdida',        '22222222-2222-4222-8222-222222222204', 1, 0, now() - interval '10 days', 'Se rompió el gancho'),
  ('obsequio',       '22222222-2222-4222-8222-222222222208', 3, 0, now() - interval '8 days', 'Regalo cumpleaños'),
  ('ajuste_salida',  '22222222-2222-4222-8222-222222222212', 3, 0, now() - interval '5 days', 'Conteo físico: no aparecen'),
  ('ajuste_salida',  '22222222-2222-4222-8222-222222222206', 2, 0, now() - interval '3 days', 'Conteo físico');
