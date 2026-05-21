-- ==============================================================================
-- 🛡️ RETROFANTASY — CORRECCIÓN DE POLÍTICAS DE ALMACENAMIENTO (STORAGE RLS)
-- ==============================================================================
-- INSTRUCCIONES:
-- 1. Copia todo este código SQL.
-- 2. Ve a tu panel de Supabase: https://supabase.com
-- 3. Entra en tu proyecto y navega a: "SQL Editor" (menú lateral izquierdo, icono de consola '>_').
-- 4. Haz clic en "New Query", pega este código y pulsa "Run" (ejecutar).
-- ==============================================================================

-- 1. Asegurar que el bucket 'avatars' esté creado y configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars', 
    'avatars', 
    true, 
    5242880, -- 5 MB de límite
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

-- 2. Eliminar políticas antiguas del bucket 'avatars' (para evitar colisiones de nombres)
DROP POLICY IF EXISTS "Permitir lectura pública de avatares" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de avatares a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de avatares a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir borrado de avatares a usuarios autenticados" ON storage.objects;

-- 3. Crear política para permitir la lectura pública de imágenes en el bucket 'avatars'
-- (Cualquier usuario o visitante puede ver las fotos de perfil)
CREATE POLICY "Permitir lectura pública de avatares"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 4. Crear política para permitir la subida (insert) de imágenes a usuarios autenticados
-- (Cada usuario autenticado puede subir archivos al bucket 'avatars')
CREATE POLICY "Permitir subida de avatares a usuarios autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 5. Crear política para permitir la actualización (update) de imágenes a usuarios autenticados
-- (Cada usuario puede sobrescribir o actualizar sus avatares)
CREATE POLICY "Permitir actualización de avatares a usuarios autenticados"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- 6. Crear política para permitir el borrado (delete) de imágenes a usuarios autenticados
-- (Los usuarios pueden borrar sus avatares si así lo desean)
CREATE POLICY "Permitir borrado de avatares a usuarios autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- ==============================================================================
-- ¡Listo! Una vez ejecutado esto en el SQL Editor de tu panel, la subida de
-- fotos de perfil (avatars) funcionará de forma impecable sin errores de RLS.
-- ==============================================================================
