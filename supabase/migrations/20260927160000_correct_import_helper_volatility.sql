-- Date and timestamp parsing depend on PostgreSQL locale/timezone settings and
-- therefore must not be declared immutable.
alter function public.homecare_text_to_date(text) stable;
alter function public.homecare_text_to_timestamptz(text) stable;
