-- =============================================================================
-- 0012 - Storage das imagens de produto
-- Bucket publico (a foto aparece no portal sem login), escrita amarrada nas
-- permissoes produtos.criar / produtos.editar.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "produtos_imagens_leitura" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'produtos');

create policy "produtos_imagens_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and ((select public.has_permission('produtos.criar'))
         or (select public.has_permission('produtos.editar')))
  );

create policy "produtos_imagens_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (select public.has_permission('produtos.editar')))
  with check (bucket_id = 'produtos' and (select public.has_permission('produtos.editar')));

create policy "produtos_imagens_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (select public.has_permission('produtos.editar')));
