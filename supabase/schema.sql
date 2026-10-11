-- WattFigures · Esquema Supabase (proyecto dedicado "wattfigures")
-- Pegar íntegro en el SQL Editor del proyecto Supabase "wattfigures".
-- Espeja el esquema multi-sitio de breachfolio (sites + articles) para que
-- el flujo n8n "WattFigures · Guías" funcione con los mismos patrones.
--
-- Solo DDL + la fila de `sites`. El contenido del sitio vive en
-- supabase/seed-content.sql (generado por tools/gen-supabase-seed.mjs);
-- aplícalo DESPUÉS de este fichero.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  domain text not null,
  status text not null default 'active',
  deploy_hook_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  section text not null default 'guides',
  slug text not null,
  lang text not null check (lang in ('en','es')),
  title text not null,
  description text,
  url text not null,
  image_url text,
  status text not null default 'published',
  published_at timestamptz not null default now()
  -- La clave única va más abajo, como índice (ver "Unicidad").
);

create index if not exists articles_site_section_lang_idx
  on public.articles (site_id, section, lang, status, published_at desc);

-- ---------------------------------------------------------------------------
-- Unicidad: (site_id, section, lang, slug)
--
-- `section` va DENTRO de la clave a propósito: una guía y un electrodoméstico
-- pueden compartir slug porque viven en URLs distintas (/guides/refrigerator/
-- vs /appliances/refrigerator/). Sin `section`, una guía nueva con un slug ya
-- usado por un electrodoméstico fallaría al insertar DESPUÉS de que n8n haya
-- creado los ficheros en GitHub, dejando la publicación a medias.
--
-- Se declara como índice (no como constraint inline) para que este fichero sea
-- re-ejecutable tanto en un proyecto nuevo como en uno ya creado con la clave
-- antigua `(site_id, lang, slug)`. El `drop constraint` de abajo la retira.
-- ---------------------------------------------------------------------------

alter table public.articles
  drop constraint if exists articles_site_id_lang_slug_key;

create unique index if not exists articles_site_section_lang_slug_key
  on public.articles (site_id, section, lang, slug);

-- ---------------------------------------------------------------------------
-- RLS: lectura pública solo de contenido publicado; escritura solo service_role
-- ---------------------------------------------------------------------------

alter table public.sites enable row level security;
alter table public.articles enable row level security;

drop policy if exists "public read active sites" on public.sites;
create policy "public read active sites"
  on public.sites for select
  using (status = 'active');

drop policy if exists "public read published articles" on public.articles;
create policy "public read published articles"
  on public.articles for select
  using (status = 'published');

-- (no hay políticas de insert/update/delete: solo el service_role key de n8n
--  puede escribir, porque el service_role se salta RLS)

-- ---------------------------------------------------------------------------
-- Seed del sitio (el contenido va en supabase/seed-content.sql)
-- ---------------------------------------------------------------------------

insert into public.sites (slug, domain, status)
values ('wattfigures', 'wattfigures.com', 'active')
on conflict (slug) do nothing;
