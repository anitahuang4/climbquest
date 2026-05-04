import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xyocwmfcfoisxqqxprpi.supabase.co";
const SUPABASE_KEY = "sb_publishable_T0j-7LSk51M5H9qCELSbRA_x7yMLOXA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
