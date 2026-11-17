-- =====================================================================
-- ShoppingList — Catálogo de artigos conhecidos (a folha "Adicionar
-- artigos", onde se adiciona com um toque em vez de escrever).
-- IDEMPOTENTE e sem DROP/DELETE/REVOKE. Correr depois do categorias.sql.
-- Já aplicado (migração shoppinglist_catalogo).
--
-- `catalogo` guarda o NOME como se escreve (com acentos); a categoria de
-- cada um continua a vir da memória `artigo_categorias`, pela mesma chave.
-- Nasce com artigos típicos de casa e cresce sozinho: tudo o que alguém
-- escreve na barra entra aqui (a app faz o upsert). Tira-se um artigo do
-- catálogo no modo "Gerir" da folha.
-- =====================================================================

create table if not exists shoppinglist.catalogo (
  artigo_key text primary key check (char_length(artigo_key) between 1 and 120),
  nome       text not null check (char_length(nome) between 1 and 120),
  criado_em  timestamptz not null default now(),
  ultimo_uso timestamptz not null default now()
);

alter table shoppinglist.catalogo enable row level security;

do $pol$
begin
  if exists (select 1 from pg_policies where schemaname = 'shoppinglist' and tablename = 'catalogo') then
    raise notice 'policies do catálogo já existem — nada a fazer';
    return;
  end if;
  create policy cg_select on shoppinglist.catalogo for select to authenticated
    using (shoppinglist.is_allowed());
  create policy cg_insert on shoppinglist.catalogo for insert to authenticated
    with check (shoppinglist.is_allowed());
  create policy cg_update on shoppinglist.catalogo for update to authenticated
    using (shoppinglist.is_allowed()) with check (shoppinglist.is_allowed());
  create policy cg_delete on shoppinglist.catalogo for delete to authenticated
    using (shoppinglist.is_allowed());
end $pol$;

grant select, insert, update, delete on shoppinglist.catalogo to authenticated;
grant all on shoppinglist.catalogo to service_role;

with base(k, nome, cat) as (values
      ('macas','Maçãs','Fruta'), ('bananas','Bananas','Fruta'), ('laranjas','Laranjas','Fruta'), ('peras','Peras','Fruta'),
      ('limoes','Limões','Fruta'), ('morangos','Morangos','Fruta'), ('uvas','Uvas','Fruta'), ('melao','Melão','Fruta'),
      ('melancia','Melancia','Fruta'), ('ananas','Ananás','Fruta'), ('kiwis','Kiwis','Fruta'), ('tangerinas','Tangerinas','Fruta'),
      ('abacates','Abacates','Fruta'), ('manga','Manga','Fruta'), ('batatas','Batatas','Legumes'), ('cebolas','Cebolas','Legumes'),
      ('alhos','Alhos','Legumes'), ('tomate','Tomate','Legumes'), ('alface','Alface','Legumes'), ('cenouras','Cenouras','Legumes'),
      ('courgette','Courgette','Legumes'), ('brocolos','Brócolos','Legumes'), ('cogumelos','Cogumelos','Legumes'), ('pepino','Pepino','Legumes'),
      ('pimentos','Pimentos','Legumes'), ('espinafres','Espinafres','Legumes'), ('couve','Couve','Legumes'), ('batata doce','Batata doce','Legumes'),
      ('feijao verde','Feijão verde','Legumes'), ('salsa','Salsa','Legumes'), ('coentros','Coentros','Legumes'), ('frango','Frango','Talho'),
      ('peito de frango','Peito de frango','Talho'), ('bifes','Bifes','Talho'), ('carne picada','Carne picada','Talho'), ('costeletas','Costeletas','Talho'),
      ('febras','Febras','Talho'), ('entrecosto','Entrecosto','Talho'), ('bifes de peru','Bifes de peru','Talho'), ('hamburgueres','Hambúrgueres','Talho'),
      ('salmao','Salmão','Peixaria'), ('pescada','Pescada','Peixaria'), ('bacalhau','Bacalhau','Peixaria'), ('camarao','Camarão','Peixaria'),
      ('dourada','Dourada','Peixaria'), ('polvo','Polvo','Peixaria'), ('fiambre','Fiambre','Charcutaria'), ('presunto','Presunto','Charcutaria'),
      ('bacon','Bacon','Charcutaria'), ('chourico','Chouriço','Charcutaria'), ('salsichas','Salsichas','Charcutaria'), ('leite','Leite','Laticínios'),
      ('iogurtes','Iogurtes','Laticínios'), ('queijo','Queijo','Laticínios'), ('queijo fresco','Queijo fresco','Laticínios'), ('queijo ralado','Queijo ralado','Laticínios'),
      ('ovos','Ovos','Laticínios'), ('manteiga','Manteiga','Laticínios'), ('natas','Natas','Laticínios'), ('requeijao','Requeijão','Laticínios'),
      ('pao','Pão','Padaria'), ('pao de forma','Pão de forma','Padaria'), ('tostas','Tostas','Padaria'), ('broa','Broa','Padaria'),
      ('wraps','Wraps','Padaria'), ('cereais','Cereais','Mercearia'), ('bolachas','Bolachas','Mercearia'), ('farinha','Farinha','Mercearia'),
      ('esparguete','Esparguete','Mercearia'), ('grao','Grão','Mercearia'), ('feijao','Feijão','Mercearia'), ('chocolate','Chocolate','Mercearia'),
      ('mel','Mel','Mercearia'), ('compota','Compota','Mercearia'), ('aveia','Aveia','Mercearia'), ('lentilhas','Lentilhas','Mercearia'),
      ('frutos secos','Frutos secos','Mercearia'), ('arroz','Arroz','Acompanhamentos'), ('massa','Massa','Acompanhamentos'), ('batatas fritas','Batatas fritas','Acompanhamentos'),
      ('pure de batata','Puré de batata','Acompanhamentos'), ('atum','Atum','Conservas'), ('polpa de tomate','Polpa de tomate','Conservas'), ('azeitonas','Azeitonas','Conservas'),
      ('milho','Milho','Conservas'), ('feijao em lata','Feijão em lata','Conservas'), ('azeite','Azeite','Molhos e Temperos'), ('sal','Sal','Molhos e Temperos'),
      ('acucar','Açúcar','Molhos e Temperos'), ('vinagre','Vinagre','Molhos e Temperos'), ('oleo','Óleo','Molhos e Temperos'), ('pimenta','Pimenta','Molhos e Temperos'),
      ('maionese','Maionese','Molhos e Temperos'), ('ketchup','Ketchup','Molhos e Temperos'), ('mostarda','Mostarda','Molhos e Temperos'), ('louro','Louro','Molhos e Temperos'),
      ('oregaos','Orégãos','Molhos e Temperos'), ('colorau','Colorau','Molhos e Temperos'), ('pizza','Pizza','Congelados'), ('douradinhos','Douradinhos','Congelados'),
      ('ervilhas congeladas','Ervilhas congeladas','Congelados'), ('legumes congelados','Legumes congelados','Congelados'), ('gelado','Gelado','Congelados'), ('agua','Água','Bebidas não Alcoólicas'),
      ('agua com gas','Água com gás','Bebidas não Alcoólicas'), ('sumo','Sumo','Bebidas não Alcoólicas'), ('coca-cola','Coca-Cola','Bebidas não Alcoólicas'), ('ice tea','Ice Tea','Bebidas não Alcoólicas'),
      ('cerveja','Cerveja','Cerveja, Sidra ou Vinho'), ('vinho tinto','Vinho tinto','Cerveja, Sidra ou Vinho'), ('vinho branco','Vinho branco','Cerveja, Sidra ou Vinho'), ('cafe','Café','Café'),
      ('capsulas de cafe','Cápsulas de café','Café'), ('cha','Chá','Café'), ('gelatina','Gelatina','Sobremesas'), ('leite condensado','Leite condensado','Sobremesas'),
      ('papel higienico','Papel higiénico','Higiene'), ('champo','Champô','Higiene'), ('gel de banho','Gel de banho','Higiene'), ('pasta de dentes','Pasta de dentes','Higiene'),
      ('sabonete','Sabonete','Higiene'), ('desodorizante','Desodorizante','Higiene'), ('fraldas','Fraldas','Higiene'), ('toalhitas','Toalhitas','Higiene'),
      ('cotonetes','Cotonetes','Higiene'), ('escova de dentes','Escova de dentes','Higiene'), ('lencos de papel','Lenços de papel','Higiene'), ('detergente da loica','Detergente da loiça','Produtos Limpeza'),
      ('detergente da roupa','Detergente da roupa','Produtos Limpeza'), ('lixivia','Lixívia','Produtos Limpeza'), ('sacos do lixo','Sacos do lixo','Produtos Limpeza'), ('esponjas','Esponjas','Produtos Limpeza'),
      ('amaciador','Amaciador','Produtos Limpeza'), ('papel de cozinha','Papel de cozinha','Produtos Limpeza'), ('pastilhas da maquina','Pastilhas da máquina','Produtos Limpeza'), ('limpa-vidros','Limpa-vidros','Produtos Limpeza'),
      ('esfregao','Esfregão','Produtos Limpeza'), ('guardanapos','Guardanapos','Utensílios Refeição'), ('papel de aluminio','Papel de alumínio','Utensílios Refeição'), ('pelicula aderente','Película aderente','Utensílios Refeição'),
      ('papel vegetal','Papel vegetal','Utensílios Refeição')
), cat_ins as (
  insert into shoppinglist.catalogo (artigo_key, nome)
    select k, nome from base
  on conflict (artigo_key) do nothing
  returning 1
)
insert into shoppinglist.artigo_categorias (artigo_key, categoria_id, origem)
  select b.k, c.id, 'base'
    from base b join shoppinglist.categorias c on c.nome = b.cat
  on conflict (artigo_key) do nothing;

-- Símbolo escolhido à mão para um artigo (um emoji). Vazio = automático: a app
-- tira-o do nome (ART_ICO) ou, à falta disso, da categoria.
-- (migração shoppinglist_catalogo_emoji)
alter table shoppinglist.catalogo
  add column if not exists emoji text check (emoji is null or char_length(emoji) <= 16);
