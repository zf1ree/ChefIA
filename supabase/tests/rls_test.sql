-- Teste de RLS / autorização. Executar no SQL Editor (ou via MCP) como postgres.
-- Tudo roda dentro de um DO block que SEMPRE termina com exceção, portanto
-- nenhum dado (inclusive os usuários de teste) é persistido.
-- Resultado esperado: ERROR "RLS_TESTS_PASSED (n verificações)".
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  v_recipe uuid;
  v_list uuid;
  v_count int;
  v_checks int := 0;
  v_failed boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid', '{"display_name":"A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid', '{}', now(), now());

  -- trigger criou os perfis
  select count(*) into v_count from public.profiles where id in (a, b);
  if v_count <> 2 then raise exception 'FALHA: trigger de profiles'; end if;
  v_checks := v_checks + 1;

  -- receita de A (inserida como service role/postgres, como a Edge Function faz)
  insert into public.recipes (user_id, title, data, model) values (a, 'Omelete', '{}', 'test') returning id into v_recipe;

  -- ===== Usuário A =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.user_ingredients (name) values ('Ovo');
  insert into public.favorites (recipe_id) values (v_recipe);
  insert into public.shopping_lists default values returning id into v_list;
  insert into public.shopping_list_items (list_id, name, normalized_name) values (v_list, 'Leite', 'leite');

  select count(*) into v_count from public.user_ingredients;
  if v_count <> 1 then raise exception 'FALHA: A não vê o próprio ingrediente'; end if;
  v_checks := v_checks + 1;

  -- A não pode promover o próprio plano
  v_failed := false;
  begin
    update public.profiles set plan = 'premium' where id = a;
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALHA: usuário alterou o próprio plano'; end if;
  v_checks := v_checks + 1;

  -- A pode editar preferências
  update public.profiles set allergies = '{amendoim}' where id = a;
  v_checks := v_checks + 1;

  -- A não pode inserir uso de IA diretamente
  v_failed := false;
  begin
    insert into public.ai_usage_events (user_id, kind) values (a, 'scan');
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALHA: insert direto em ai_usage_events'; end if;
  v_checks := v_checks + 1;

  -- A não pode chamar refund
  v_failed := false;
  begin
    perform public.refund_ai_quota(1);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALHA: refund_ai_quota executável por usuário'; end if;
  v_checks := v_checks + 1;

  -- cota: free = 5 scans/24h
  for i in 1..5 loop perform public.consume_ai_quota('scan'); end loop;
  v_failed := false;
  begin
    perform public.consume_ai_quota('scan');
  exception when others then
    if sqlerrm = 'quota_exceeded' then v_failed := true; else raise; end if;
  end;
  if not v_failed then raise exception 'FALHA: cota não bloqueou a 6ª análise'; end if;
  v_checks := v_checks + 1;

  select used into v_count from public.get_ai_usage() where kind = 'scan';
  if v_count <> 5 then raise exception 'FALHA: get_ai_usage retornou %', v_count; end if;
  v_checks := v_checks + 1;

  -- ===== Usuário B =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_count from public.user_ingredients;
  if v_count <> 0 then raise exception 'FALHA: B vê ingredientes de A'; end if;
  select count(*) into v_count from public.recipes;
  if v_count <> 0 then raise exception 'FALHA: B vê receitas de A'; end if;
  select count(*) into v_count from public.favorites;
  if v_count <> 0 then raise exception 'FALHA: B vê favoritos de A'; end if;
  select count(*) into v_count from public.shopping_list_items;
  if v_count <> 0 then raise exception 'FALHA: B vê lista de A'; end if;
  select count(*) into v_count from public.profiles;
  if v_count <> 1 then raise exception 'FALHA: B vê % perfis', v_count; end if;
  v_checks := v_checks + 5;

  -- B não consegue alterar/excluir dados de A (0 linhas afetadas)
  update public.user_ingredients set name = 'hack';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FALHA: B alterou dados de A'; end if;
  delete from public.shopping_list_items;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FALHA: B excluiu dados de A'; end if;
  v_checks := v_checks + 2;

  -- B não pode favoritar receita de A
  v_failed := false;
  begin
    insert into public.favorites (recipe_id) values (v_recipe);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALHA: B favoritou receita de A'; end if;
  v_checks := v_checks + 1;

  -- B não pode inserir item na lista de A
  v_failed := false;
  begin
    insert into public.shopping_list_items (list_id, name, normalized_name) values (v_list, 'X', 'x');
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALHA: B inseriu na lista de A'; end if;
  v_checks := v_checks + 1;

  -- B não pode se passar por A
  v_failed := false;
  begin
    insert into public.user_ingredients (user_id, name) values (a, 'Injetado');
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALHA: B inseriu linha com user_id de A'; end if;
  v_checks := v_checks + 1;

  -- ===== Anônimo =====
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into v_count from public.user_ingredients;
  if v_count <> 0 then raise exception 'FALHA: anon vê dados privados'; end if;
  select count(*) into v_count from public.ingredients;
  if v_count = 0 then raise exception 'FALHA: anon não lê catálogo'; end if;
  v_checks := v_checks + 2;

  execute 'reset role';
  raise exception 'RLS_TESTS_PASSED (% verificações)', v_checks;
end;
$$;
