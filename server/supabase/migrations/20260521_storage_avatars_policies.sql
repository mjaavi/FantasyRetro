-- =====================================================================
-- MIGRACIÓN DE BD: Políticas RLS para el Bucket de Avatares ('avatars')
-- =====================================================================
-- Ejecuta este script en el SQL Editor de tu panel de Supabase
-- para habilitar la subida de fotos de perfil de forma segura y persistente.
-- =====================================================================

-- 1. Habilitar RLS en la tabla de almacenamiento (por si no estuviera ya activo)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Asegurar que existe el bucket 'avatars' (fallback en BD)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  5242880, -- limit 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[];

-- 3. Eliminar políticas antiguas si existieran para evitar duplicados
DROP POLICY IF EXISTS "Permitir lectura pública de avatares" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados subir avatares" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados actualizar sus avatares" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados borrar sus avatares" ON storage.objects;

-- 4. Crear política SELECT: Cualquiera (público) puede leer imágenes en el bucket 'avatars'
CREATE POLICY "Permitir lectura pública de avatares" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'avatars');

-- 5. Crear política INSERT: Los usuarios autenticados pueden subir su propio archivo.
-- La convención es que el nombre del archivo empieza con su UID (auth.uid()::text)
CREATE POLICY "Permitir a usuarios autenticados subir avatares" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'avatars' 
  AND name LIKE (auth.uid()::text || '.%')
);

-- 6. Crear política UPDATE: Los usuarios autenticados pueden actualizar/sobrescribir su propio avatar (upsert)
CREATE POLICY "Permitir a usuarios autenticados actualizar sus avatares" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'avatars' 
  AND name LIKE (auth.uid()::text || '.%')
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND name LIKE (auth.uid()::text || '.%')
);

-- 7. Crear política DELETE: Los usuarios autenticados pueden borrar su propio avatar
CREATE POLICY "Permitir a usuarios autenticados borrar sus avatares" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'avatars' 
  AND name LIKE (auth.uid()::text || '.%')
);
