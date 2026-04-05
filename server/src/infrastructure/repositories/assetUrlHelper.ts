import { supabaseAdmin } from '../supabase.client';

export function buildClubLogoUrl(teamFifaApiId: number | null): string | null {
    if (!teamFifaApiId) {
        return null;
    }

    const fileName = `${Math.trunc(teamFifaApiId)}.webp`;
    return supabaseAdmin.storage.from('clubs').getPublicUrl(fileName).data.publicUrl;
}
