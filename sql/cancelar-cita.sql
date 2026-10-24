begin;

alter table public.reservas
  add column if not exists cancel_token uuid;

update public.reservas
set cancel_token = gen_random_uuid()
where cancel_token is null;

alter table public.reservas
  alter column cancel_token set default gen_random_uuid();

alter table public.reservas
  alter column cancel_token set not null;

create unique index if not exists reservas_cancel_token_key
  on public.reservas (cancel_token);

create or replace function public.cancelar_cita(p_token uuid, p_confirmar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cita public.reservas%rowtype;
  nombre_servicio text;
  inicio timestamptz;
  situacion text;
begin
  if p_token is null then
    if coalesce(p_confirmar, false) then
      raise exception 'cita no encontrada';
    end if;
    return jsonb_build_object('situacion', 'no_encontrada');
  end if;

  if coalesce(p_confirmar, false) then
    select * into cita
    from public.reservas
    where cancel_token = p_token
    for update;
  else
    select * into cita
    from public.reservas
    where cancel_token = p_token;
  end if;

  if not found then
    if coalesce(p_confirmar, false) then
      raise exception 'cita no encontrada';
    end if;
    return jsonb_build_object('situacion', 'no_encontrada');
  end if;

  select s.nombre into nombre_servicio
  from public.servicios s
  where s.id = cita.servicio_id;

  inicio := (cita.fecha::timestamp + cita.hora::text::time) at time zone 'America/Bogota';

  if cita.estado = 'cancelada' then
    situacion := 'cancelada';
  elsif inicio <= now() or cita.estado not in ('pendiente', 'confirmada') then
    situacion := 'pasada';
  else
    situacion := 'vigente';
  end if;

  if coalesce(p_confirmar, false) then
    if situacion = 'cancelada' then
      raise exception 'Esta cita ya fue cancelada';
    end if;
    if situacion = 'pasada' then
      raise exception 'Esta cita ya pasó';
    end if;
    update public.reservas
    set estado = 'cancelada'
    where id = cita.id
      and estado in ('pendiente', 'confirmada');
    if not found then
      raise exception 'Esta cita ya fue cancelada';
    end if;
    situacion := 'cancelada';
  end if;

  return jsonb_build_object(
    'situacion', situacion,
    'servicio', coalesce(nombre_servicio, ''),
    'fecha', to_char(cita.fecha, 'YYYY-MM-DD'),
    'hora', to_char(cita.hora::text::time, 'HH24:MI')
  );
end;
$$;

revoke all on function public.cancelar_cita(uuid, boolean) from public;
revoke all on function public.cancelar_cita(uuid, boolean) from anon;
revoke all on function public.cancelar_cita(uuid, boolean) from authenticated;
grant execute on function public.cancelar_cita(uuid, boolean) to anon;

revoke select, insert, update, delete, truncate, references, trigger on table public.reservas from anon;

commit;
