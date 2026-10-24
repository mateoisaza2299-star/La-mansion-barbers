-- Política de datos, autorización y tope de citas.
-- Pégalo completo en el editor SQL de Supabase (rol postgres) y ejecútalo una vez.
-- La clave pública del sitio no puede aplicar este DDL.
--
-- No crea otra función de reserva: toma el cuerpo actual de public.crear_reserva,
-- le agrega la trampa, normaliza el celular, baja el tope a 2 citas activas
-- y deja la misma lógica de horarios. Al insertar, el trigger guarda
-- autorizacion_datos y autorizacion_fecha. Si autorizacion_datos no es true, rechaza.

begin;

alter table public.reservas
  add column if not exists autorizacion_datos boolean,
  add column if not exists autorizacion_fecha timestamptz;

comment on column public.reservas.autorizacion_datos is
  'True cuando el titular autorizó el tratamiento al reservar.';
comment on column public.reservas.autorizacion_fecha is
  'Momento en que quedó registrada la autorización.';

create or replace function public.reservas_exigir_autorizacion()
returns trigger
language plpgsql
set search_path = public
as $autoriza$
begin
  if current_setting('lamansion.autoriza', true) = 'true' then
    new.autorizacion_datos := true;
    if new.autorizacion_fecha is null then
      new.autorizacion_fecha := now();
    end if;
  end if;
  if new.autorizacion_datos is distinct from true then
    raise exception 'falta autorizacion';
  end if;
  return new;
end;
$autoriza$;

drop trigger if exists reservas_exigir_autorizacion on public.reservas;
create trigger reservas_exigir_autorizacion
  before insert on public.reservas
  for each row
  execute procedure public.reservas_exigir_autorizacion();

do $patch$
declare
  def text;
  lower_def text;
  objetivo oid;
  firma text;
  vieja record;
  resultado text;
  retorno text;
  cuerpo_en int;
  cursor int;
  relativo int;
  absoluto int;
  inicio_begin int := 0;
  fin_begin int;
  antes text;
  despues text;
  aviso int;
  desde int;
  ventana text;
  prefijo text;
  sufijo text;
  firma_ini int;
  profundidad int;
  i int;
  caracter text;
  cierre int := 0;
  inyeccion text;
begin
  select p.oid
    into objetivo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'crear_reserva'
    and pg_get_function_identity_arguments(p.oid) like '%p_telefono%'
  order by case
    when pg_get_function_identity_arguments(p.oid) like '%p_trampa%' then 0
    else 1
  end
  limit 1;

  if objetivo is null then
    raise exception 'No encontré public.crear_reserva. No creé otra función.';
  end if;

  def := pg_get_functiondef(objetivo);
  resultado := pg_get_function_result(objetivo);

  if position('lamansion-datos' in def) = 0 then
    aviso := position('limite de citas' in lower(def));
    if aviso = 0 then
      raise exception 'crear_reserva no avisa "limite de citas". No cambié el tope.';
    end if;
    desde := greatest(1, aviso - 500);
    ventana := substr(def, desde, aviso - desde);
    if ventana ~ '>=[[:space:]]*3' or ventana ~ '>[[:space:]]*2([^0-9]|$)' then
      ventana := regexp_replace(ventana, '>=[[:space:]]*3', '>= 2', 'g');
      ventana := regexp_replace(ventana, '>[[:space:]]*2([^0-9]|$)', '> 1\1', 'g');
    elsif ventana !~ '>=[[:space:]]*2' and ventana !~ '>[[:space:]]*1([^0-9]|$)' then
      raise exception 'No encontré el tope de 3 citas junto a "limite de citas". Fragmento: %', ventana;
    end if;
    prefijo := substr(def, 1, desde - 1);
    sufijo := substr(def, aviso);
    def := prefijo || ventana || sufijo;

    if position('p_trampa' in pg_get_function_identity_arguments(objetivo)) = 0
       and position('p_trampa' in def) = 0 then
      firma_ini := position('crear_reserva(' in def);
      if firma_ini = 0 then
        raise exception 'No encontré la firma de crear_reserva.';
      end if;
      profundidad := 0;
      for i in firma_ini + length('crear_reserva') .. length(def) loop
        caracter := substr(def, i, 1);
        if caracter = '(' then
          profundidad := profundidad + 1;
        elsif caracter = ')' then
          profundidad := profundidad - 1;
          if profundidad = 0 then
            cierre := i;
            exit;
          end if;
        end if;
      end loop;
      if cierre = 0 then
        raise exception 'No cerré la lista de argumentos de crear_reserva.';
      end if;
      def := substr(def, 1, cierre - 1)
        || ', p_trampa text DEFAULT NULL::text'
        || substr(def, cierre);
    end if;

    if lower(resultado) = 'jsonb' then
      retorno := 'return jsonb_build_object(''token'', gen_random_uuid(), ''numero'', '''');';
    elsif lower(resultado) = 'json' then
      retorno := 'return json_build_object(''token'', gen_random_uuid(), ''numero'', '''');';
    elsif lower(resultado) = 'void' or resultado ~* '^(setof|table)([^a-z]|$)' then
      retorno := 'return;';
    else
      retorno := 'return null;';
    end if;

    inyeccion := E'\n'
      || '  -- lamansion-datos' || E'\n'
      || '  if coalesce(btrim(p_trampa), '''') <> '''' then' || E'\n'
      || '    ' || retorno || E'\n'
      || '  end if;' || E'\n'
      || '  perform set_config(''lamansion.autoriza'', case when p_autoriza is true then ''true'' else ''false'' end, true);' || E'\n'
      || '  p_telefono := regexp_replace(coalesce(p_telefono, ''''), ''[^0-9]'', '''', ''g'');' || E'\n'
      || '  if char_length(p_telefono) = 12 and left(p_telefono, 2) = ''57'' then' || E'\n'
      || '    p_telefono := substr(p_telefono, 3);' || E'\n'
      || '  end if;' || E'\n';

    lower_def := lower(def);
    cuerpo_en := position('$function$' in lower_def);
    if cuerpo_en = 0 then
      cuerpo_en := position('as $' in lower_def);
    end if;
    if cuerpo_en = 0 then
      raise exception 'No encontré el cuerpo de crear_reserva.';
    end if;
    cursor := cuerpo_en;
    loop
      relativo := position('begin' in substr(lower_def, cursor));
      exit when relativo = 0;
      absoluto := cursor + relativo - 1;
      antes := case when absoluto = 1 then ' ' else substr(lower_def, absoluto - 1, 1) end;
      despues := substr(lower_def, absoluto + 5, 1);
      if antes !~ '[a-z0-9_]' and coalesce(despues, '') !~ '[a-z0-9_]' then
        inicio_begin := absoluto;
        exit;
      end if;
      cursor := absoluto + 5;
    end loop;
    if inicio_begin = 0 then
      raise exception 'No encontré el BEGIN de crear_reserva.';
    end if;
    fin_begin := inicio_begin + 4;
    def := substr(def, 1, fin_begin) || inyeccion || substr(def, fin_begin + 1);
    execute def;
  end if;

  for vieja in
    select p.oid::regprocedure as proc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'crear_reserva'
      and pg_get_function_identity_arguments(p.oid) not like '%p_trampa%'
  loop
    execute 'drop function ' || vieja.proc::text;
  end loop;

  select p.oid::regprocedure::text
    into firma
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'crear_reserva'
    and pg_get_function_identity_arguments(p.oid) like '%p_trampa%';

  if firma is null then
    raise exception 'Después del cambio no quedó public.crear_reserva(p_trampa).';
  end if;

  execute 'revoke all on function ' || firma || ' from public';
  execute 'revoke all on function ' || firma || ' from anon';
  execute 'revoke all on function ' || firma || ' from authenticated';
  execute 'grant execute on function ' || firma || ' to anon, authenticated';

  raise notice 'Listo: %', firma;
end;
$patch$;

commit;
