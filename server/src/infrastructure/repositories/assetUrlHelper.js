"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClubLogoUrl = buildClubLogoUrl;
const supabase_client_1 = require("../supabase.client");
function buildClubLogoUrl(teamFifaApiId) {
    if (!teamFifaApiId) {
        return null;
    }
    const fileName = `${Math.trunc(teamFifaApiId)}.webp`;
    return supabase_client_1.supabaseAdmin.storage.from('clubs').getPublicUrl(fileName).data.publicUrl;
}
