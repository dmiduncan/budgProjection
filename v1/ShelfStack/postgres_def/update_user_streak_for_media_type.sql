create or replace function update_user_streak_for_media_type(
  p_user_id uuid,
  p_media_type text
)
returns void
language plpgsql
security definer
as $$
declare
  v_today_et date;
  v_yesterday_et date;

  v_count int;
  v_latest date;
  v_streak lu_user_streak;
begin
  -- Eastern Time reference
  v_today_et := (now() at time zone 'America/New_York')::date;
  v_yesterday_et := v_today_et - 1;

  -- Lock row
  select *
  into v_streak
  from lu_user_streak
  where user_id = p_user_id
  for update;

  -- Safety: streak row must exist
   if v_streak is null then
    insert into lu_user_streak (user_id)
    values (p_user_id)
    returning * into v_streak;
  end if;

  -- Pull current values dynamically
  execute format(
    'select %I, %I
     from lu_user_streak
     where user_id = $1',
    p_media_type || '_streak_count',
    p_media_type || '_streak_latest_date'
  )
  into v_count, v_latest
  using p_user_id;

  -- Case 1: already updated today → do nothing
  if v_latest = v_today_et and v_count > 0 then
    return;
  end if;

  -- Case 2: before yesterday → reset then increment
  if v_latest < v_yesterday_et then
    v_count := 1;
    v_latest := v_today_et;

  -- Case 3: yesterday → increment
  elsif v_latest = v_yesterday_et then
    v_count := v_count + 1;
    v_latest := v_today_et;
  end if;

  -- Apply update
  execute format(
    'update lu_user_streak
     set %I = $1,
         %I = $2
     where user_id = $3',
    p_media_type || '_streak_count',
    p_media_type || '_streak_latest_date'
  )
  using v_count, v_latest, p_user_id;
end;
$$;