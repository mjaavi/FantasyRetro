"use strict";
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config();

const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: leagues } = await supabase.from('fantasy_leagues').select('*').order('id', {ascending: false}).limit(1);
  console.log('League:', leagues);

  const league = leagues[0];

  // let's mimic getSeasonReferenceTimestamp
  const match = league.season.match(/^(\d{4})(?:\/(\d{4}))?$/);
  const startYear = Number(match[1]);
  console.log('TARGET TIMESTAMP:', new Date(Date.UTC(startYear, 6, 1)));
  process.exit();
}
test();
