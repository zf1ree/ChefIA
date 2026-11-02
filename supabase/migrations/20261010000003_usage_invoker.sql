-- get_ai_usage só lê dados do próprio usuário, já liberados por RLS:
-- não precisa de SECURITY DEFINER.
alter function public.get_ai_usage() security invoker;
