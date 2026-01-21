-- Bước 1: Tạo hàm bọc unaccent đánh dấu là IMMUTABLE
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text AS
$func$
    -- Lưu ý: 'unaccent' là tên dictionary thường đi kèm với extension
    SELECT public.unaccent('public.unaccent', $1)
$func$ LANGUAGE sql IMMUTABLE;

-- Bước 2: Tạo INDEX sử dụng hàm f_unaccent
-- Thêm COALESCE để tránh lỗi nếu note hoặc category bị NULL
CREATE INDEX "search_idx" ON "expenses" USING gin (
  to_tsvector('simple',
    f_unaccent(COALESCE("note", '')) || ' ' || f_unaccent(COALESCE("category", ''))
  )
);