-- Repair the published statement whose closing dollar was accidentally
-- preceded by two backslashes, leaving a literal dollar visible to learners.

update public.problems
set statement_en = replace(statement_en, E'\\\\$', '$'),
    updated_at = now()
where id = 'aea2bfb0-01d8-483f-911f-dacec4f9cf81'
  and statement_en like E'%\\\\$%';
