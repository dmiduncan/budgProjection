create or replace function get_or_fix_user_streak(p_user_id uuid)
returns lu_user_streak
language plpgsql
security definer
as $$
declare
  v_streak lu_user_streak;
  v_today_et date;
  v_yesterday_et date;

  v_media_type text;
  v_media_types text[] := ARRAY['anime','manga','book','tvshow','movie'];
  v_dates date[];
  v_count int;
  v_latest date;
begin
  -- Eastern Time reference
  v_today_et := (now() at time zone 'America/New_York')::date;
  v_yesterday_et := v_today_et - 1;

  -- Lock streak row if it exists
  select *
  into v_streak
  from lu_user_streak
  where user_id = p_user_id
  for update;

  -- Create row if missing
  if v_streak is null then
    insert into lu_user_streak (user_id)
    values (p_user_id)
    returning * into v_streak;
  end if;

  -- Loop media types
  foreach v_media_type in array v_media_types
  loop
    -- Pull distinct ET dates
    select array_agg(d order by d desc)
    into v_dates
    from (
      select distinct
        (je.date_created at time zone 'America/New_York')::date as d
      from lu_journal_entry je
      join lu_media_status ms on ms.id = je.media_status_id
      join lu_media m on m.id = ms.media_id
      where je.user_id = p_user_id
        and m.media_type = v_media_type
    ) t;

    -- No history
    if v_dates is null or array_length(v_dates, 1) = 0 then
      v_count := 0;
      v_latest := v_today_et;
    else
      v_latest := v_dates[1];

      -- Latest entry too old → reset
      if v_latest < v_yesterday_et then
        v_count := 0;
        v_latest := v_today_et;
      else
        -- Count consecutive days
        v_count := 1;
        for i in 2 .. array_length(v_dates, 1) loop
          exit when v_dates[i] <> v_dates[i-1] - 1;
          v_count := v_count + 1;
        end loop;
      end if;
    end if;

    -- Apply updates per media type
    execute format(
      'update lu_user_streak
       set %I = $1,
           %I = $2
       where user_id = $3',
      v_media_type || '_streak_count',
      v_media_type || '_streak_latest_date'
    )
    using v_count, v_latest, p_user_id;
  end loop;

  -- Return final state
  select *
    into v_streak
    from lu_user_streak
    where user_id = p_user_id;

return v_streak;
end;
$$;
