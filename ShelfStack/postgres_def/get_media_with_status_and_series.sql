CREATE OR REPLACE FUNCTION get_media_with_status_and_series(
  p_user_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
    id bigint,
    status_id bigint,
    title text,
    writer text,
    media_type text,
    total_pages bigint,
    current_page bigint,
    percentage_complete bigint,
    status text,
    image_url text,
    date_updated timestamp without time zone,
    series_id bigint,
    series_name text,
    series_description text,
    series_total_units bigint,
    series_total_current_units bigint
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        ms.id AS status_id,
        m.title,
        m.writer,
        m.media_type,
        m.num_units AS total_pages,
        ms.current_units AS current_page,
        ms.percentage_complete,
        ms.status,
        m.cover_art_url AS image_url,
        ms.date_updated,
        s.id AS series_id,
        s.name AS series_name,
        rsm.description AS series_description,
        COALESCE(series_totals.total_units, 0)::bigint AS series_total_units,
        COALESCE(series_totals.total_current_units, 0)::bigint AS series_total_current_units
    FROM lu_media_status ms
    INNER JOIN lu_media m ON ms.media_id = m.id
    LEFT JOIN rel_series_media rsm ON m.id = rsm.media_id
    LEFT JOIN lu_series s ON rsm.series_id = s.id
    LEFT JOIN LATERAL (
        SELECT 
            SUM(m2.num_units)::bigint AS total_units,
            SUM(COALESCE(ms2.current_units, 0))::bigint AS total_current_units
        FROM rel_series_media rsm2
        INNER JOIN lu_media m2 ON rsm2.media_id = m2.id
        LEFT JOIN lu_media_status ms2 ON m2.id = ms2.media_id 
            AND ms2.user_id = p_user_id
        WHERE rsm2.series_id = s.id
    ) AS series_totals ON s.id IS NOT NULL
    WHERE 
        (p_user_id IS NULL OR ms.user_id = p_user_id)
        AND (p_status IS NULL OR ms.status = p_status)
    ORDER BY ms.date_updated DESC;
END;
$$;