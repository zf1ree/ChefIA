-- ChefIA — esquema inicial
-- Todas as tabelas privadas têm RLS: cada usuário só acessa as próprias linhas.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.storage_location as enum ('fridge', 'freezer', 'pantry');
create type public.ingredient_source as enum ('scan', 'manual', 'catalog');
create type public.plan_tier as enum ('free', 'premium');
create type public.ai_usage_kind as enum ('scan', 'recipes');

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Planos e limites (configuráveis no backend, nunca só no app)
-- ---------------------------------------------------------------------------
create table public.plan_limits (
  plan plan_tier primary key,
  scans_per_day integer not null check (scans_per_day >= 0),
  recipe_generations_per_day integer not null check (recipe_generations_per_day >= 0)
);

insert into public.plan_limits (plan, scans_per_day, recipe_generations_per_day) values
  ('free', 5, 15),
  ('premium', 40, 120);

alter table public.plan_limits enable row level security;
create policy "plan_limits são públicos para leitura"
  on public.plan_limits for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  plan plan_tier not null default 'free',
  allergies text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  disliked_ingredients text[] not null default '{}',
  cuisine_preferences text[] not null default '{}',
  -- Itens básicos que o usuário CONFIRMOU ter (sal, óleo...). Nunca presumidos.
  pantry_staples text[] not null default '{}',
  max_cooking_minutes integer check (max_cooking_minutes between 5 and 600),
  default_servings integer not null default 2 check (default_servings between 1 and 20),
  image_processing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: atualizar o próprio" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- O usuário não pode alterar o próprio plano: permissão de UPDATE apenas por coluna.
revoke update on public.profiles from authenticated, anon;
grant update (
  display_name, allergies, dietary_restrictions, disliked_ingredients, cuisine_preferences,
  pantry_staples, max_cooking_minutes, default_servings, image_processing_consent_at
) on public.profiles to authenticated;

-- Cria o perfil automaticamente no cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ingredients: catálogo público (seleção em lista)
-- ---------------------------------------------------------------------------
create table public.ingredients (
  id bigint generated always as identity primary key,
  name text not null unique,
  category text not null,
  default_location storage_location not null default 'fridge'
);

create index ingredients_name_trgm on public.ingredients using gin (name extensions.gin_trgm_ops);

alter table public.ingredients enable row level security;
create policy "ingredients: leitura pública" on public.ingredients
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- user_ingredients: Minha Geladeira
-- ---------------------------------------------------------------------------
create table public.user_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingredient_id bigint references public.ingredients (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  quantity text check (char_length(quantity) <= 40),
  category text not null default 'outros' check (char_length(category) <= 40),
  location storage_location not null default 'fridge',
  expires_on date,
  notes text check (char_length(notes) <= 500),
  source ingredient_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_ingredients_user_idx on public.user_ingredients (user_id, location);
create index user_ingredients_expiry_idx on public.user_ingredients (user_id, expires_on)
  where expires_on is not null;
create index user_ingredients_ingredient_idx on public.user_ingredients (ingredient_id);

create trigger user_ingredients_updated_at before update on public.user_ingredients
  for each row execute function public.set_updated_at();

alter table public.user_ingredients enable row level security;
create policy "user_ingredients: select próprio" on public.user_ingredients
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_ingredients: insert próprio" on public.user_ingredients
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_ingredients: update próprio" on public.user_ingredients
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_ingredients: delete próprio" on public.user_ingredients
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- scans: histórico das análises. A FOTO NÃO É ARMAZENADA (minimização / LGPD).
-- ---------------------------------------------------------------------------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_usable boolean not null,
  image_issue text,
  model text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index scans_user_idx on public.scans (user_id, created_at desc);

alter table public.scans enable row level security;
create policy "scans: select próprio" on public.scans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "scans: delete próprio" on public.scans
  for delete to authenticated using ((select auth.uid()) = user_id);
-- Inserção apenas pela Edge Function (service role).

create table public.scan_ingredients (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  quantity_estimate text,
  confidence real check (confidence between 0 and 1),
  needs_confirmation boolean not null default false
);

create index scan_ingredients_scan_idx on public.scan_ingredients (scan_id);
create index scan_ingredients_user_idx on public.scan_ingredients (user_id);

alter table public.scan_ingredients enable row level security;
create policy "scan_ingredients: select próprio" on public.scan_ingredients
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- recipes: receitas geradas (documento validado em jsonb)
-- Decisão: ingredientes ficam em `data` (jsonb) em vez de recipe_ingredients,
-- porque receitas geradas são documentos imutáveis lidos inteiros.
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  title text not null,
  meal_type text,
  difficulty text,
  total_minutes integer,
  servings integer,
  data jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index recipes_user_idx on public.recipes (user_id, created_at desc);
create index recipes_scan_idx on public.recipes (scan_id);

alter table public.recipes enable row level security;
create policy "recipes: select próprio" on public.recipes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recipes: delete próprio" on public.recipes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index favorites_recipe_idx on public.favorites (recipe_id);

alter table public.favorites enable row level security;
create policy "favorites: select próprio" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorites: insert próprio" on public.favorites
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
  );
create policy "favorites: delete próprio" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- shopping_lists / shopping_list_items
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Minha lista' check (char_length(name) <= 60),
  created_at timestamptz not null default now()
);

create index shopping_lists_user_idx on public.shopping_lists (user_id);

alter table public.shopping_lists enable row level security;
create policy "shopping_lists: select próprio" on public.shopping_lists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "shopping_lists: insert próprio" on public.shopping_lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "shopping_lists: update próprio" on public.shopping_lists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "shopping_lists: delete próprio" on public.shopping_lists
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Nome normalizado (minúsculas, sem acento) para evitar duplicidades.
  normalized_name text not null,
  quantity text check (char_length(quantity) <= 40),
  category text not null default 'outros',
  checked boolean not null default false,
  recipe_titles text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (list_id, normalized_name)
);

create index shopping_list_items_user_idx on public.shopping_list_items (user_id);

alter table public.shopping_list_items enable row level security;
create policy "shopping_list_items: select próprio" on public.shopping_list_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "shopping_list_items: insert próprio" on public.shopping_list_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );
create policy "shopping_list_items: update próprio" on public.shopping_list_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "shopping_list_items: delete próprio" on public.shopping_list_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- cooking_history / recipe_feedback
-- ---------------------------------------------------------------------------
create table public.cooking_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cooked_at timestamptz not null default now()
);

create index cooking_history_user_idx on public.cooking_history (user_id, cooked_at desc);
create index cooking_history_recipe_idx on public.cooking_history (recipe_id);

alter table public.cooking_history enable row level security;
create policy "cooking_history: select próprio" on public.cooking_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cooking_history: insert próprio" on public.cooking_history
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
  );
create policy "cooking_history: delete próprio" on public.cooking_history
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.recipe_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  worked boolean,
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index recipe_feedback_recipe_idx on public.recipe_feedback (recipe_id);

create trigger recipe_feedback_updated_at before update on public.recipe_feedback
  for each row execute function public.set_updated_at();

alter table public.recipe_feedback enable row level security;
create policy "recipe_feedback: select próprio" on public.recipe_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recipe_feedback: insert próprio" on public.recipe_feedback
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
  );
create policy "recipe_feedback: update próprio" on public.recipe_feedback
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recipe_feedback: delete próprio" on public.recipe_feedback
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Limites de uso de IA (proteção de custo e contra abuso)
-- ---------------------------------------------------------------------------
create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind ai_usage_kind not null,
  created_at timestamptz not null default now()
);

create index ai_usage_events_user_kind_idx on public.ai_usage_events (user_id, kind, created_at desc);

alter table public.ai_usage_events enable row level security;
create policy "ai_usage_events: select próprio" on public.ai_usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
-- Sem políticas de escrita: só as funções abaixo (security definer) gravam.

-- Consome 1 unidade da cota diária (janela móvel de 24h). Retorna o id do evento.
-- Chamada pela Edge Function com o JWT do usuário.
create or replace function public.consume_ai_quota(p_kind ai_usage_kind)
returns table (event_id bigint, used integer, quota integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plan_tier;
  v_quota integer;
  v_used integer;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Serializa chamadas concorrentes do mesmo usuário.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_kind::text, 0));

  select p.plan into v_plan from public.profiles p where p.id = v_user;
  v_plan := coalesce(v_plan, 'free');

  select case when p_kind = 'scan' then l.scans_per_day else l.recipe_generations_per_day end
    into v_quota from public.plan_limits l where l.plan = v_plan;

  select count(*) into v_used from public.ai_usage_events e
   where e.user_id = v_user and e.kind = p_kind and e.created_at > now() - interval '24 hours';

  if v_used >= v_quota then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = format('%s/%s', v_used, v_quota);
  end if;

  insert into public.ai_usage_events (user_id, kind) values (v_user, p_kind) returning id into v_id;
  return query select v_id, v_used + 1, v_quota;
end;
$$;

revoke execute on function public.consume_ai_quota(ai_usage_kind) from public, anon;
grant execute on function public.consume_ai_quota(ai_usage_kind) to authenticated;

-- Devolve a cota quando a IA falha por erro nosso/do provedor. Apenas service role.
create or replace function public.refund_ai_quota(p_event_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ai_usage_events where id = p_event_id;
$$;

revoke execute on function public.refund_ai_quota(bigint) from public, anon, authenticated;
grant execute on function public.refund_ai_quota(bigint) to service_role;

-- Uso atual (para exibir no app).
create or replace function public.get_ai_usage()
returns table (kind ai_usage_kind, used integer, quota integer, plan plan_tier)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select coalesce((select p.plan from public.profiles p where p.id = auth.uid()), 'free'::public.plan_tier) as plan
  )
  select k.kind,
         (select count(*)::int from public.ai_usage_events e
           where e.user_id = auth.uid() and e.kind = k.kind and e.created_at > now() - interval '24 hours'),
         case when k.kind = 'scan' then l.scans_per_day else l.recipe_generations_per_day end,
         me.plan
    from me
    join public.plan_limits l on l.plan = me.plan
    cross join (values ('scan'::public.ai_usage_kind), ('recipes'::public.ai_usage_kind)) as k(kind)
   where auth.uid() is not null;
$$;

revoke execute on function public.get_ai_usage() from public, anon;
grant execute on function public.get_ai_usage() to authenticated;

-- Exclusão da conta pelo próprio usuário (LGPD: direito à eliminação).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- set_updated_at / handle_new_user não devem ser chamadas via API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
